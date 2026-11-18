// Inicio: qué hay que hacer hoy y cómo viene el embudo de ventas.
import { el, irA, poner, vaciar, sesion, barra, moneda, fechaHora, filaTarea, tonoEtapa, iniciales, aviso, TIPO_ACTIVIDAD } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) await irA('/clientes');
barra(s, '/inicio');
const app = vaciar(document.getElementById('app'));
const r = await api('GET', '/crm/inicio');
const vendedor = s.usuario.rol === 'vendedor';
const escribe = ['admin', 'consultor', 'vendedor'].includes(s.usuario.rol);

// ---------- Saludo ----------
const hora = Number(new Date().toLocaleString('es-AR', { hour: 'numeric', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' }));
const saludo = hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
const hoyTexto = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Argentina/Buenos_Aires' });
const nombre = s.usuario.nombre.split(' ')[0];

// ---------- Indicadores ----------
const t = r.tareas;
const indicador = (href, cifra, que, clase = '') => el('a', { class: `indicador ${clase}`, href }, el('span', { class: 'cifra' }, cifra), el('span', { class: 'que' }, que));
const indicadores = el('div', { class: 'indicadores' },
  indicador('/pipeline', moneda(r.pipeline.totales.total), `en juego en ${r.pipeline.totales.cantidad} oportunidad${r.pipeline.totales.cantidad === 1 ? '' : 'es'}`),
  indicador('/pipeline', moneda(r.pipeline.totales.ponderado), 'esperado según la probabilidad de cada etapa'),
  indicador('/pipeline', moneda(r.ganadas30.valor), `ganado en los últimos 30 días (${r.ganadas30.cantidad} venta${r.ganadas30.cantidad === 1 ? '' : 's'})`, r.ganadas30.cantidad ? 'ganado' : ''),
  indicador('/tareas', String(t.vencidas + t.hoy), t.vencidas ? `tareas para hoy, ${t.vencidas} vencida${t.vencidas === 1 ? '' : 's'}` : 'tareas para hoy', t.vencidas ? 'vencido' : t.hoy ? 'hoy' : ''));

// ---------- Flujo de ventas ----------
function seccionFlujo() {
  const etapas = r.pipeline.etapas.filter((e) => e.codigo !== '_sin_etapa');
  const total = etapas.reduce((a, e) => a + e.total, 0);
  const barraFlujo = el('div', { class: 'flujo', role: 'img', 'aria-label': `Flujo de ventas: ${etapas.map((e) => `${e.nombre} ${moneda(e.total)}`).join(', ')}` },
    etapas.map((e, i) => {
      const tramo = el('div', { class: `tramo${e.total ? '' : ' vacio-tramo'}`, title: `${e.nombre}: ${moneda(e.total)} en ${e.cantidad}` });
      if (e.total) { tramo.style.flex = `${e.total / total} 1 0`; tramo.style.backgroundColor = tonoEtapa(i, etapas.length); }
      return tramo;
    }));
  const leyenda = el('div', { class: 'flujo-leyenda' }, etapas.map((e, i) => {
    const punto = el('i');
    punto.style.background = tonoEtapa(i, etapas.length);
    return el('div', {}, el('strong', {}, moneda(e.total)), punto, `${e.nombre} (${e.cantidad})`);
  }));
  return el('section', { class: 'seccion' },
    el('div', { class: 'encabezado' }, el('h2', {}, 'Flujo de ventas'), el('a', { href: '/pipeline' }, 'Abrir el pipeline')),
    total ? [barraFlujo, leyenda] : el('p', { class: 'vacio' }, 'Todavía no hay oportunidades abiertas. Creá la primera desde la ficha de un contacto o desde el pipeline.'));
}

// ---------- Para hoy ----------
async function completar(tarea, check) {
  try { await api('PATCH', `/crm/tareas/${tarea._id}/estado`, { estado: 'completada' }); aviso('Tarea completada.'); check.closest('li').classList.add('hecha'); } catch (e) { aviso(e.message, 'error'); check.checked = false; }
}
const seccionHoy = el('section', { class: 'seccion' },
  el('div', { class: 'encabezado' }, el('h2', {}, 'Para hoy'), el('a', { href: '/tareas' }, t.proximas ? `Ver todas (${t.proximas} próximas)` : 'Ver todas')),
  t.lista.length ? el('ul', { class: 'lista-tareas' }, t.lista.map((x) => filaTarea(x, { alCambiar: escribe ? completar : null })))
    : el('p', { class: 'vacio' }, 'No tenés tareas para hoy ni vencidas.'));

// ---------- Dormidos y actividad ----------
const seccionDormidos = el('section', { class: 'seccion' },
  el('div', { class: 'encabezado' }, el('h2', {}, 'Sin contacto hace 60 días'), r.dormidos.total ? el('a', { href: '/contactos?vista=dormidos' }, `Ver los ${r.dormidos.total}`) : null),
  r.dormidos.total
    ? el('ul', { class: 'lista-tareas' }, r.dormidos.lista.map((c) => {
      const n = [c.nombre, c.apellido].filter(Boolean).join(' ');
      return el('li', {}, el('span', { class: 'iniciales' }, iniciales(n)),
        el('div', { class: 'info' }, el('a', { href: `/contacto?id=${c._id}` }, n), el('div', { class: 'suave chico-texto' }, [c.segmento, c.localidad].filter(Boolean).join(', ') || 'Sin datos de zona')),
        c.telefono ? el('a', { href: `tel:${c.telefono.replace(/[^\d+]/g, '')}`, class: 'chico-texto' }, 'Llamar') : null);
    }))
    : el('p', { class: 'vacio' }, r.contactos ? 'Todos tus contactos tuvieron alguna interacción reciente.' : 'Todavía no hay contactos cargados.'),
  !r.contactos && !vendedor ? el('div', { class: 'acciones' }, el('a', { class: 'boton', href: '/importar' }, 'Importar contactos')) : null);

const seccionActividad = el('section', { class: 'seccion' }, el('h2', {}, 'Última actividad'),
  r.actividad.length ? el('ul', { class: 'linea-tiempo' }, r.actividad.map((a) => el('li', {},
    el('div', { class: 'cabecera' }, el('strong', {}, `${TIPO_ACTIVIDAD[a.tipo]}: ${a.asunto}`)),
    el('div', { class: 'suave chico-texto' }, `${fechaHora(a.fecha)}, ${a.ownerNombre}`))))
    : el('p', { class: 'vacio' }, 'Las llamadas y visitas que registre el equipo van a aparecer acá.'));

poner(app,
  el('div', { class: 'saludo' }, el('h1', {}, `${saludo}, ${nombre}`),
    el('p', { class: 'sub' }, `${hoyTexto[0].toUpperCase()}${hoyTexto.slice(1)}. ${s.esSuperadmin ? `Estás trabajando en ${s.organizacion.nombre} como consultor.` : vendedor ? 'Esto es lo tuyo para hoy.' : `Así viene ${s.organizacion.nombre}.`}`)),
  indicadores,
  seccionFlujo(),
  el('div', { class: 'columnas-inicio' }, seccionHoy, el('div', {}, seccionDormidos, seccionActividad)),
);
