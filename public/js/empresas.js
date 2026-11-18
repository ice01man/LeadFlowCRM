// Empresas: listado con búsqueda, alta y edición en la misma pantalla.
import { el, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (s.usuario.rol === 'superadmin') location.replace('/plataforma');
barra(s, '/empresas');

const escribe = ['admin', 'consultor', 'vendedor'].includes(s.usuario.rol);
const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const app = vaciar(document.getElementById('app'));
const opciones = await api('GET', '/crm/contactos/opciones');

let editando = null; // id de la empresa en edición
const buscador = el('input', { type: 'search', placeholder: 'Buscar por razón social, CUIT o localidad…', 'aria-label': 'Buscar empresas' });
const tabla = el('div', { class: 'tabla-scroll' });
const resumen = el('p', { class: 'suave' });

const f = {
  razonSocial: el('input', { id: 'e-razon', required: true, maxlength: 150 }),
  cuit: el('input', { id: 'e-cuit', maxlength: 13, placeholder: '30-12345678-9' }),
  segmento: selector({ id: 'e-segmento' }, [['', 'Sin definir'], ...opciones.segmentos.map((x) => [x, x])]),
  telefono: el('input', { id: 'e-telefono', type: 'tel', maxlength: 40 }),
  direccion: el('input', { id: 'e-direccion', maxlength: 200 }),
  municipio: el('input', { id: 'e-municipio', maxlength: 80, list: 'municipios' }),
  localidad: el('input', { id: 'e-localidad', maxlength: 80 }),
  sitioWeb: el('input', { id: 'e-web', maxlength: 200 }),
};
const titulo = el('h2', {}, 'Nueva empresa');
const guardar = el('button', { type: 'submit' }, 'Crear empresa');
const cancelar = el('button', { type: 'button', class: 'secundario oculto' }, 'Cancelar edición');
const archivar = el('button', { type: 'button', class: 'peligro oculto' }, 'Archivar');
const form = el('form', { novalidate: true },
  el('div', { class: 'campos' },
    campo('Razón social', f.razonSocial), campo('CUIT', f.cuit), campo('Tipo de cliente', f.segmento), campo('Teléfono', f.telefono),
    campo('Dirección', f.direccion), campo('Municipio / partido', f.municipio), campo('Localidad', f.localidad), campo('Sitio web', f.sitioWeb)),
  el('datalist', { id: 'municipios' }, opciones.municipios.map((m) => el('option', { value: m }))),
  el('div', { class: 'acciones' }, guardar, cancelar, gestiona ? archivar : null));

poner(app, 
  el('div', { class: 'encabezado' }, el('div', {}, el('h1', {}, 'Empresas'), resumen)),
  escribe ? el('section', { class: 'seccion', id: 'form-empresa' }, titulo, form) : null,
  el('section', { class: 'seccion' }, buscador, tabla),
);

function modoAlta() {
  editando = null;
  form.reset();
  titulo.textContent = 'Nueva empresa';
  guardar.textContent = 'Crear empresa';
  cancelar.classList.add('oculto');
  archivar.classList.add('oculto');
}

function editar(e) {
  editando = e._id;
  for (const [k, n] of Object.entries(f)) n.value = e[k] ?? '';
  titulo.textContent = `Editar ${e.razonSocial}`;
  guardar.textContent = 'Guardar cambios';
  cancelar.classList.remove('oculto');
  archivar.classList.remove('oculto');
  document.getElementById('form-empresa').scrollIntoView({ behavior: 'smooth' });
}

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(guardar, async () => {
    const datos = Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value]));
    if (editando) { await api('PATCH', `/crm/empresas/${editando}`, datos); aviso('Empresa actualizada.'); } else { await api('POST', '/crm/empresas', datos); aviso('Empresa creada.'); }
    modoAlta();
    await cargar();
  });
});
cancelar.addEventListener('click', modoAlta);
archivar.addEventListener('click', () => {
  if (!confirm('¿Archivar esta empresa? Sus contactos se mantienen.')) return;
  conBoton(archivar, async () => { await api('DELETE', `/crm/empresas/${editando}`); aviso('Empresa archivada.'); modoAlta(); await cargar(); });
});

let espera;
buscador.addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(cargar, 300); });

async function cargar() {
  const r = await api('GET', `/crm/empresas?porPagina=100&q=${encodeURIComponent(buscador.value)}`);
  resumen.textContent = `${r.total} empresa${r.total === 1 ? '' : 's'}${r.total > r.items.length ? ` (se muestran ${r.items.length}; usá el buscador)` : ''}`;
  vaciar(tabla);
  if (!r.items.length) { tabla.append(el('p', { class: 'vacio' }, buscador.value ? 'Sin resultados.' : 'Todavía no hay empresas.')); return; }
  tabla.append(el('table', {},
    el('thead', {}, el('tr', {}, ['Razón social', 'CUIT', 'Tipo', 'Municipio', 'Localidad', ''].map((t) => el('th', {}, t)))),
    el('tbody', {}, r.items.map((e) => el('tr', {},
      el('td', {}, el('a', { href: `/contactos?empresa=${e._id}` }, e.razonSocial)),
      el('td', {}, e.cuit || '—'), el('td', {}, e.segmento || '—'), el('td', {}, e.municipio || '—'), el('td', {}, e.localidad || '—'),
      el('td', { class: 'num' }, escribe ? el('button', { type: 'button', class: 'icono', onclick: () => editar(e) }, 'Editar') : null))))));
}
await cargar();
