// Tablero del pipeline: columnas por etapa, arrastrar y soltar para mover, ganar o perder desde la tarjeta.
// En el celular (donde arrastrar es incómodo) cada tarjeta tiene un selector "Mover a…".
import { el, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector, moneda, fecha, buscadorContacto } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) location.replace('/clientes');
barra(s, '/pipeline');

const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const escribe = gestiona || s.usuario.rol === 'vendedor';
const app = vaciar(document.getElementById('app'));
const opciones = await api('GET', '/crm/contactos/opciones');

let filtroOwner = '';
let etapas = [];
const totales = el('div', { class: 'totales' });
const tablero = el('div', { class: 'tablero', 'aria-label': 'Tablero de oportunidades' });
const fOwner = selector({ 'aria-label': 'Vendedor' }, [['', 'Todo el equipo'], ['yo', 'Mis oportunidades'], ...opciones.vendedores.map((v) => [v._id, v.nombre])]);
fOwner.addEventListener('change', () => { filtroOwner = fOwner.value === 'yo' ? s.usuario._id : fOwner.value; cargar(); });

// ---------- Nueva oportunidad ----------
const formNueva = (() => {
  if (!escribe) return null;
  const contacto = buscadorContacto({ id: 'op-contacto' });
  const titulo = el('input', { id: 'op-titulo', maxlength: 120, placeholder: 'Ej.: Malbec para la carta de verano' });
  const valor = el('input', { id: 'op-valor', type: 'number', min: 0, step: 1000, placeholder: '0' });
  const cierre = el('input', { id: 'op-cierre', type: 'date' });
  const etapa = el('select', { id: 'op-etapa' });
  const crear = el('button', { type: 'submit' }, 'Crear oportunidad');
  const form = el('form', { novalidate: true },
    el('div', { class: 'campos' }, contacto.nodo, campo('Título', titulo), campo('Valor estimado ($)', valor), campo('Cierre esperado', cierre), campo('Etapa inicial', etapa)),
    el('div', { class: 'acciones' }, crear, el('button', { type: 'button', class: 'secundario', onclick: () => seccion.classList.add('oculto') }, 'Cancelar')));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    conBoton(crear, async () => {
      const c = contacto.valor();
      if (!c) throw new Error('Elegí un contacto de la lista.');
      await api('POST', '/crm/oportunidades', { contactoId: c._id, titulo: titulo.value, valorEstimado: valor.value || 0, fechaCierreEsperada: cierre.value || null, etapa: etapa.value });
      form.reset(); contacto.limpiar(); seccion.classList.add('oculto');
      aviso('Oportunidad creada.');
      await cargar();
    });
  });
  const seccion = el('section', { class: 'seccion oculto', id: 'nueva' }, el('h2', {}, 'Nueva oportunidad'), form);
  seccion.etapa = etapa;
  return seccion;
})();

poner(app, 
  el('div', { class: 'encabezado' },
    el('div', {}, el('h1', {}, 'Pipeline'), totales),
    el('div', { class: 'acciones' }, gestiona ? fOwner : null,
      escribe ? el('button', { type: 'button', onclick: () => { formNueva.classList.remove('oculto'); document.getElementById('op-contacto').focus(); } }, 'Nueva oportunidad') : null)),
  formNueva, tablero,
  el('p', { class: 'suave' }, escribe ? 'Arrastrá una tarjeta a otra columna para cambiarla de etapa. En el celular usá "Mover a…".' : 'Vista de consulta.'),
);

// ---------- Acciones ----------
async function mover(id, etapa) {
  try { await api('PATCH', `/crm/oportunidades/${id}/etapa`, { etapa }); } catch (e) { aviso(e.message, 'error'); }
  await cargar();
}

async function cerrar(o, resultado, boton) {
  let motivo;
  if (resultado === 'perdida') {
    motivo = prompt(`¿Por qué se perdió "${o.titulo}"? (precio, competencia, sin respuesta…)`);
    if (!motivo) return;
  } else if (!confirm(`¿Marcar "${o.titulo}" como ganada? El contacto pasa a cliente.`)) return;
  await conBoton(boton, async () => {
    await api('POST', `/crm/oportunidades/${o._id}/cerrar`, { resultado, motivo });
    aviso(resultado === 'ganada' ? '¡Oportunidad ganada!' : 'Oportunidad marcada como perdida.');
    await cargar();
  });
}

// ---------- Tablero ----------
function tarjeta(o) {
  const t = el('article', { class: 'op', draggable: escribe ? 'true' : 'false', 'data-id': o._id },
    el('a', { class: 'titulo', href: `/contacto?id=${o.contactoId}` }, o.titulo),
    el('div', { class: 'meta' }, [o.contactoNombre, o.empresaNombre].filter(Boolean).join(' · ')),
    el('div', {}, el('span', { class: 'valor' }, moneda(o.valorEstimado)), el('span', { class: 'meta' }, ` · ${o.probabilidad} %`)),
    o.fechaCierreEsperada ? el('div', { class: 'meta' }, `Cierre esperado ${fecha(o.fechaCierreEsperada)}`) : null);
  if (escribe) {
    const mov = selector({ 'aria-label': `Mover ${o.titulo} a otra etapa` }, [['', 'Mover a…'], ...etapas.filter((e) => e.codigo !== o.etapa).map((e) => [e.codigo, e.nombre])]);
    mov.addEventListener('change', () => mov.value && mover(o._id, mov.value));
    const ganar = el('button', { type: 'button', class: 'ganar', title: 'Marcar como ganada' }, 'Ganada');
    const perder = el('button', { type: 'button', class: 'peligro', title: 'Marcar como perdida' }, 'Perdida');
    ganar.addEventListener('click', () => cerrar(o, 'ganada', ganar));
    perder.addEventListener('click', () => cerrar(o, 'perdida', perder));
    t.append(el('div', { class: 'acciones-op' }, mov, ganar, perder));
    t.addEventListener('dragstart', (ev) => { ev.dataTransfer.setData('text/plain', o._id); ev.dataTransfer.effectAllowed = 'move'; t.classList.add('arrastrando'); });
    t.addEventListener('dragend', () => t.classList.remove('arrastrando'));
  }
  return t;
}

function columna(c) {
  const cuerpo = el('div', { class: 'tarjetas-col' }, c.items.length ? c.items.map(tarjeta) : el('p', { class: 'vacio' }, 'Sin oportunidades'));
  const col = el('section', { class: `columna${c.codigo === '_sin_etapa' ? ' huerfana' : ''}`, 'aria-label': c.nombre },
    el('header', {}, el('strong', {}, c.nombre), el('span', {}, `${c.cantidad} · ${moneda(c.total)}${c.codigo === '_sin_etapa' ? ' · etapa eliminada de la configuración' : ` · ${c.probabilidad} %`}`)),
    cuerpo);
  if (escribe && c.codigo !== '_sin_etapa') {
    col.addEventListener('dragover', (ev) => { ev.preventDefault(); col.classList.add('sobre'); });
    col.addEventListener('dragleave', (ev) => { if (!col.contains(ev.relatedTarget)) col.classList.remove('sobre'); });
    col.addEventListener('drop', (ev) => {
      ev.preventDefault();
      col.classList.remove('sobre');
      const id = ev.dataTransfer.getData('text/plain');
      if (id && !c.items.some((i) => i._id === id)) mover(id, c.codigo);
    });
  }
  return col;
}

async function cargar() {
  const r = await api('GET', `/crm/oportunidades/pipeline${filtroOwner ? `?owner=${filtroOwner}` : ''}`).catch((e) => { aviso(e.message, 'error'); return null; });
  if (!r) return;
  etapas = r.columnas.filter((c) => c.codigo !== '_sin_etapa');
  if (formNueva && !formNueva.etapa.options.length) formNueva.etapa.append(...etapas.map((e) => el('option', { value: e.codigo }, `${e.nombre} (${e.probabilidad} %)`)));
  poner(vaciar(totales), 
    el('div', {}, el('strong', {}, String(r.totales.cantidad)), 'oportunidades abiertas'),
    el('div', {}, el('strong', {}, moneda(r.totales.total)), 'en juego'),
    el('div', {}, el('strong', {}, moneda(r.totales.ponderado)), 'esperado (según probabilidad)'));
  poner(vaciar(tablero), ...r.columnas.map(columna));
}

await cargar();
if (location.hash === '#nueva' && formNueva) formNueva.classList.remove('oculto');
