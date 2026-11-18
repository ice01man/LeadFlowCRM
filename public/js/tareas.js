// Tareas: agrupadas por vencimiento, con prioridad, dependencias y alta rápida.
import { el, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector, fecha, PRIORIDAD } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) location.replace('/clientes');
barra(s, '/tareas');

const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const escribe = gestiona || s.usuario.rol === 'vendedor';
const app = vaciar(document.getElementById('app'));
const opciones = await api('GET', '/crm/contactos/opciones');
const nombre = new Map(opciones.vendedores.map((v) => [v._id, v.nombre]));

let filtroOwner = 'yo';
let abiertas = [];
const contenido = el('div');
const fOwner = selector({ 'aria-label': 'Responsable' }, [['yo', 'Mis tareas'], ['', 'Todo el equipo'], ...opciones.vendedores.map((v) => [v._id, v.nombre])], 'yo');
fOwner.addEventListener('change', () => { filtroOwner = fOwner.value; cargar(); });

// ---------- Alta ----------
const titulo = el('input', { id: 't-titulo', maxlength: 150, placeholder: 'Ej.: Llamar a la vinoteca El Corcho' });
const vence = el('input', { id: 't-vence', type: 'date' });
const prioridad = selector({ id: 't-prioridad' }, Object.entries(PRIORIDAD), 'media');
const responsable = gestiona ? selector({ id: 't-owner' }, opciones.vendedores.map((v) => [v._id, v.nombre]), s.usuario._id) : null;
const depende = el('select', { id: 't-depende', multiple: true, size: 3 });
const crear = el('button', { type: 'submit' }, 'Crear tarea');
const form = el('form', { novalidate: true },
  el('div', { class: 'campos' }, campo('Qué hay que hacer', titulo), campo('Vence', vence), campo('Prioridad', prioridad),
    responsable ? campo('Responsable', responsable) : null,
    campo('Espera a que terminen (opcional)', depende, 'Ctrl o Cmd + clic para elegir varias.')),
  el('div', { class: 'acciones' }, crear));
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(crear, async () => {
    await api('POST', '/crm/tareas', { titulo: titulo.value, fechaVencimiento: vence.value || null, prioridad: prioridad.value, owner: responsable?.value, dependeDe: [...depende.selectedOptions].map((o) => o.value) });
    form.reset(); prioridad.value = 'media'; if (responsable) responsable.value = s.usuario._id;
    aviso('Tarea creada.');
    await cargar();
  });
});

poner(app, 
  el('div', { class: 'encabezado' }, el('div', {}, el('h1', {}, 'Tareas'), el('p', { class: 'sub' }, 'Lo pendiente, ordenado por vencimiento.')),
    gestiona ? el('div', { class: 'acciones' }, fOwner) : null),
  escribe ? el('section', { class: 'seccion' }, el('h2', {}, 'Nueva tarea'), form) : null,
  el('section', { class: 'seccion' }, contenido),
);

// ---------- Listado ----------
async function cambiarEstado(t, estado, check) {
  try {
    await api('PATCH', `/crm/tareas/${t._id}/estado`, { estado });
    aviso(estado === 'completada' ? 'Tarea completada.' : 'Tarea reabierta.');
  } catch (e) {
    aviso(e.message, 'error');
    if (check) check.checked = !check.checked;
  }
  await cargar();
}

function item(t, hecha = false) {
  const check = el('input', { type: 'checkbox', 'aria-label': `Completar ${t.titulo}`, checked: hecha, disabled: !escribe || (!hecha && t.bloqueadaPor?.length > 0) });
  check.addEventListener('change', () => cambiarEstado(t, check.checked ? 'completada' : 'pendiente', check));
  return el('li', { class: hecha ? 'hecha' : '' }, check,
    el('div', { class: 'info' },
      el('strong', {}, t.titulo),
      el('div', { class: 'suave chico-texto' },
        [t.fechaVencimiento ? `Vence ${fecha(t.fechaVencimiento)}` : 'Sin fecha', filtroOwner !== 'yo' ? nombre.get(String(t.owner)) : null].filter(Boolean).join(' · '),
        t.contactoId ? [' · ', el('a', { href: `/contacto?id=${t.contactoId}` }, t.contactoNombre || 'ver contacto')] : null),
      t.bloqueadaPor?.length ? el('div', { class: 'bloqueo' }, `Espera a: ${t.bloqueadaPor.map((b) => b.titulo).join(', ')}`) : null),
    hecha ? null : el('span', { class: `etiqueta ${t.prioridad}` }, PRIORIDAD[t.prioridad]));
}

function grupo(clase, titulo, lista, vacio, hechas = false) {
  if (!lista.length && !vacio) return null;
  return el('div', {},
    el('div', { class: `grupo-titulo ${clase}` }, el('h3', {}, titulo), el('span', { class: 'suave' }, String(lista.length))),
    lista.length ? el('ul', { class: 'lista-tareas' }, lista.map((t) => item(t, hechas))) : el('p', { class: 'vacio' }, vacio));
}

async function cargar() {
  const r = await api('GET', `/crm/tareas${filtroOwner ? `?owner=${filtroOwner}` : ''}`);
  abiertas = [...r.vencidas, ...r.hoy, ...r.proximas, ...r.sinFecha];
  poner(vaciar(depende), ...abiertas.map((t) => el('option', { value: t._id }, t.titulo)));
  poner(vaciar(contenido), 
    grupo('vencidas', 'Vencidas', r.vencidas),
    grupo('', 'Hoy', r.hoy, 'Nada para hoy.'),
    grupo('', 'Próximas', r.proximas),
    grupo('', 'Sin fecha', r.sinFecha),
    grupo('', 'Completadas en los últimos 7 días', r.completadas, null, true),
    abiertas.length || r.completadas.length ? null : el('p', { class: 'vacio' }, 'No hay tareas. Las que generes desde la ficha de un contacto también aparecen acá.'),
  );
}
await cargar();
