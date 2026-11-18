// Listado de contactos: búsqueda, filtros, vistas guardadas, asignación masiva y exportación.
import { el, poner, vaciar, sesion, barra, aviso, conBoton, selector, parametro, ETAPA } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (s.usuario.rol === 'superadmin') location.replace('/plataforma');
barra(s, '/contactos');

const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const escribe = gestiona || s.usuario.rol === 'vendedor';
const app = vaciar(document.getElementById('app'));

const [opciones, vistas] = await Promise.all([api('GET', '/crm/contactos/opciones'), api('GET', '/crm/vistas')]);
const nombreVendedor = new Map(opciones.vendedores.map((v) => [v._id, v.nombre]));

// ---------- Estado ----------
const estado = { vista: 'todos', q: '', segmento: '', municipio: '', lifecycleStage: '', owner: '', empresaId: parametro('empresa') || '', pagina: 1, orden: 'recientes' };
const seleccion = new Set();

// ---------- Controles ----------
const buscador = el('input', { id: 'buscar', type: 'search', placeholder: 'Buscar por nombre, empresa, email, teléfono…', 'aria-label': 'Buscar contactos' });
const fSegmento = selector({ 'aria-label': 'Tipo de cliente' }, [['', 'Todos los tipos'], ...opciones.segmentos.map((x) => [x, x])]);
const fMunicipio = selector({ 'aria-label': 'Municipio' }, [['', 'Todos los municipios'], ...opciones.municipios.map((x) => [x, x])]);
const fEtapa = selector({ 'aria-label': 'Etapa' }, [['', 'Todas las etapas'], ['clientes', 'Clientes y fidelizados'], ...Object.entries(ETAPA)]);
const fOwner = selector({ 'aria-label': 'Vendedor' }, [['', 'Todos los vendedores'], ['sin', 'Sin asignar'], ...opciones.vendedores.map((v) => [v._id, v.nombre])]);
if (!gestiona) fOwner.classList.add('oculto');

const selVista = el('select', { 'aria-label': 'Vista' });
function cargarVistas(lista) {
  poner(vaciar(selVista), 
    el('optgroup', { label: 'Vistas del sistema' }, lista.predefinidas.map((v) => el('option', { value: v.codigo }, v.nombre))),
    lista.guardadas.length ? el('optgroup', { label: 'Vistas guardadas' }, lista.guardadas.map((v) => el('option', { value: v._id }, `${v.nombre}${v.compartida ? ' (equipo)' : ''}`))) : null,
  );
  selVista.value = estado.vista;
  btnBorrarVista.classList.toggle('oculto', !lista.guardadas.some((v) => v._id === estado.vista && (v.propia || s.usuario.rol === 'admin')));
}
let listaVistas = vistas;
const btnGuardarVista = el('button', { type: 'button', class: 'secundario' }, 'Guardar filtros como vista');
const btnBorrarVista = el('button', { type: 'button', class: 'peligro oculto' }, 'Borrar vista');

const linkExportar = el('a', { class: 'boton secundario', href: '#' }, 'Exportar CSV');
const resumen = el('p', { class: 'suave' });
const tabla = el('div', { class: 'tabla-scroll' });
const paginado = el('div', { class: 'paginado' });
const barraSel = el('div', { class: 'barra-seleccion oculto' });

poner(app, 
  el('div', { class: 'encabezado' },
    el('div', {}, el('h1', {}, 'Contactos'), resumen),
    el('div', { class: 'acciones' },
      gestiona ? el('a', { class: 'boton secundario', href: '/importar' }, 'Importar CSV') : null,
      linkExportar,
      escribe ? el('a', { class: 'boton', href: '/contacto?nuevo=1' }, 'Nuevo contacto') : null)),
  el('section', { class: 'seccion' },
    el('div', { class: 'fila-vistas' }, el('label', { for: 'vista', class: 'suave' }, 'Vista'), selVista, btnGuardarVista, btnBorrarVista),
    el('div', { class: 'filtros' }, buscador, fSegmento, fMunicipio, fEtapa, fOwner),
    barraSel, tabla, paginado),
);
selVista.id = 'vista';
cargarVistas(listaVistas);

// ---------- Eventos ----------
let espera;
buscador.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => { estado.q = buscador.value; estado.pagina = 1; cargar(); }, 300); });
for (const [ctrl, clave] of [[fSegmento, 'segmento'], [fMunicipio, 'municipio'], [fEtapa, 'lifecycleStage'], [fOwner, 'owner']]) {
  ctrl.addEventListener('change', () => { estado[clave] = ctrl.value; estado.pagina = 1; cargar(); });
}
selVista.addEventListener('change', () => {
  estado.vista = selVista.value;
  estado.empresaId = '';
  for (const k of ['q', 'segmento', 'municipio', 'lifecycleStage', 'owner']) estado[k] = '';
  buscador.value = ''; fSegmento.value = ''; fMunicipio.value = ''; fEtapa.value = ''; fOwner.value = '';
  estado.pagina = 1;
  cargarVistas(listaVistas);
  cargar();
});
btnGuardarVista.addEventListener('click', () => conBoton(btnGuardarVista, async () => {
  const filtros = Object.fromEntries(['q', 'segmento', 'municipio', 'lifecycleStage', 'owner'].filter((k) => estado[k]).map((k) => [k, estado[k]]));
  if (!Object.keys(filtros).length) { aviso('Elegí al menos un filtro antes de guardar la vista.', 'error'); return; }
  const nombre = prompt('Nombre de la vista (por ejemplo "Zona Oeste"):');
  if (!nombre) return;
  const compartida = gestiona && confirm('¿Compartir esta vista con todo el equipo?');
  const v = await api('POST', '/crm/vistas', { nombre, filtros, compartida });
  listaVistas = await api('GET', '/crm/vistas');
  estado.vista = v._id;
  for (const k of Object.keys(filtros)) estado[k] = '';
  buscador.value = ''; fSegmento.value = ''; fMunicipio.value = ''; fEtapa.value = ''; fOwner.value = '';
  cargarVistas(listaVistas);
  aviso(`Vista "${v.nombre}" guardada.`);
  await cargar();
}));
btnBorrarVista.addEventListener('click', () => conBoton(btnBorrarVista, async () => {
  if (!confirm('¿Borrar esta vista? Los contactos no se tocan.')) return;
  await api('DELETE', `/crm/vistas/${estado.vista}`);
  listaVistas = await api('GET', '/crm/vistas');
  estado.vista = 'todos';
  cargarVistas(listaVistas);
  aviso('Vista borrada.');
  await cargar();
}));

// ---------- Datos ----------
function consulta(extra = {}) {
  const p = new URLSearchParams();
  for (const k of ['vista', 'q', 'segmento', 'municipio', 'lifecycleStage', 'owner', 'empresaId', 'pagina', 'orden']) if (estado[k]) p.set(k, estado[k]);
  for (const [k, v] of Object.entries(extra)) p.set(k, v);
  return p.toString();
}

async function cargar() {
  const r = await api('GET', `/crm/contactos?${consulta()}`).catch((e) => { aviso(e.message, 'error'); return null; });
  if (!r) return;
  linkExportar.href = `/api/crm/contactos/exportar?${consulta()}`;
  resumen.textContent = `${r.total} contacto${r.total === 1 ? '' : 's'}${estado.empresaId && r.items[0] ? ` de ${r.items[0].empresaNombre}` : ''}`;
  seleccion.clear();
  dibujarSeleccion();
  vaciar(tabla);
  if (!r.items.length) {
    tabla.append(el('p', { class: 'vacio' }, estado.q || estado.vista !== 'todos' ? 'No hay contactos con estos filtros.' : 'Todavía no hay contactos. Cargá el primero o importá un CSV.'));
    vaciar(paginado);
    return;
  }
  const todos = el('input', { type: 'checkbox', 'aria-label': 'Seleccionar todos' });
  todos.addEventListener('change', () => {
    tabla.querySelectorAll('tbody input[type=checkbox]').forEach((c) => { c.checked = todos.checked; c.dispatchEvent(new Event('change')); });
  });
  tabla.append(el('table', {},
    el('thead', {}, el('tr', {}, gestiona ? el('th', {}, todos) : null,
      [['Nombre'], ['Empresa', 'sec'], ['Teléfono'], ['Tipo', 'sec'], ['Municipio', 'sec'], ['Etapa', 'sec'], gestiona ? ['Vendedor', 'sec'] : null].filter(Boolean).map(([t, c]) => el('th', { class: c }, t)))),
    el('tbody', {}, r.items.map((c) => {
      const check = el('input', { type: 'checkbox', 'aria-label': `Seleccionar ${c.nombre}` });
      check.addEventListener('change', () => { if (check.checked) seleccion.add(c._id); else seleccion.delete(c._id); dibujarSeleccion(); });
      return el('tr', {},
        gestiona ? el('td', {}, check) : null,
        el('td', {}, el('a', { href: `/contacto?id=${c._id}` }, [c.nombre, c.apellido].filter(Boolean).join(' ')), c.email ? el('div', { class: 'suave chico-texto' }, c.email) : null, c.empresaNombre ? el('div', { class: 'suave chico-texto solo-movil' }, c.empresaNombre) : null),
        el('td', { class: 'sec' }, c.empresaNombre || '—'),
        el('td', { class: 'sin-corte' }, c.telefono ? el('a', { href: `tel:${c.telefono.replace(/[^\d+]/g, '')}` }, c.telefono) : el('span', { class: 'suave' }, '—')),
        el('td', { class: 'sec' }, c.segmento || '—'),
        el('td', { class: 'sec' }, c.municipio || '—'),
        el('td', { class: 'sec' }, el('span', { class: 'etiqueta' }, ETAPA[c.lifecycleStage] || c.lifecycleStage)),
        gestiona ? el('td', { class: 'sec' }, c.owner ? nombreVendedor.get(c.owner) || '—' : el('span', { class: 'suave' }, 'Sin asignar')) : null);
    }))));
  const paginas = Math.max(1, Math.ceil(r.total / r.porPagina));
  const ant = el('button', { type: 'button', class: 'secundario', disabled: r.pagina <= 1 }, '← Anterior');
  const sig = el('button', { type: 'button', class: 'secundario', disabled: r.pagina >= paginas }, 'Siguiente →');
  ant.addEventListener('click', () => { estado.pagina -= 1; cargar(); });
  sig.addEventListener('click', () => { estado.pagina += 1; cargar(); });
  poner(vaciar(paginado), ant, el('span', { class: 'suave' }, `Página ${r.pagina} de ${paginas}`), sig);
}

function dibujarSeleccion() {
  barraSel.classList.toggle('oculto', !gestiona || seleccion.size === 0);
  if (!gestiona || !seleccion.size) return;
  const destino = selector({ 'aria-label': 'Asignar a' }, [['', 'Sin asignar'], ...opciones.vendedores.map((v) => [v._id, v.nombre])]);
  const boton = el('button', { type: 'button' }, 'Asignar');
  boton.addEventListener('click', () => conBoton(boton, async () => {
    const r = await api('POST', '/crm/contactos/asignar', { ids: [...seleccion], owner: destino.value || null });
    aviso(`${r.actualizados} contacto${r.actualizados === 1 ? '' : 's'} asignado${r.actualizados === 1 ? '' : 's'}.`);
    await cargar();
  }));
  poner(vaciar(barraSel), el('strong', {}, `${seleccion.size} seleccionado${seleccion.size === 1 ? '' : 's'}`), el('span', { class: 'suave' }, 'Asignar a'), destino, boton);
}

await cargar();
