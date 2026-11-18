// Ficha de contacto: alta y edición. /contacto?nuevo=1  o  /contacto?id=...
import { el, irA, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector, parametro, fecha, fechaHora, moneda, ETAPA, TIPO_ACTIVIDAD, RESULTADO, PRIORIDAD, filaTarea } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) await irA('/clientes');
barra(s, '/contactos');

const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const escribe = gestiona || s.usuario.rol === 'vendedor';
const id = parametro('id');
const nuevo = !id;
if (nuevo && !escribe) await irA('/contactos');

const app = vaciar(document.getElementById('app'));
const [opciones, empresas, c] = await Promise.all([
  api('GET', '/crm/contactos/opciones'),
  api('GET', '/crm/empresas?porPagina=100'),
  nuevo ? Promise.resolve({ lifecycleStage: 'lead', etiquetas: [] }) : api('GET', `/crm/contactos/${id}`).catch(() => null),
]);
if (!c) { poner(app, el('p', { class: 'vacio' }, 'El contacto no existe o no tenés acceso.'), el('a', { href: '/contactos' }, '← Volver a contactos')); throw new Error('sin acceso'); }

const input = (idCampo, valor, attrs = {}) => el('input', { id: idCampo, value: valor ?? '', disabled: !escribe, ...attrs });
const f = {
  nombre: input('c-nombre', c.nombre, { required: true, maxlength: 80 }),
  apellido: input('c-apellido', c.apellido, { maxlength: 80 }),
  email: input('c-email', c.email, { type: 'email', maxlength: 120 }),
  telefono: input('c-telefono', c.telefono, { type: 'tel', maxlength: 40 }),
  cargo: input('c-cargo', c.cargo, { maxlength: 80 }),
  empresaId: selector({ id: 'c-empresa', disabled: !escribe }, [['', 'Sin empresa'], ...empresas.items.map((e) => [e._id, e.razonSocial])], c.empresaId || ''),
  segmento: selector({ id: 'c-segmento', disabled: !escribe }, [['', 'Sin definir'], ...opciones.segmentos.map((x) => [x, x])], c.segmento || ''),
  lifecycleStage: selector({ id: 'c-etapa', disabled: !escribe }, Object.entries(ETAPA), c.lifecycleStage),
  direccion: input('c-direccion', c.direccion, { maxlength: 200 }),
  municipio: input('c-municipio', c.municipio, { maxlength: 80, list: 'municipios' }),
  localidad: input('c-localidad', c.localidad, { maxlength: 80 }),
  etiquetas: input('c-etiquetas', (c.etiquetas || []).join(', '), { placeholder: 'Separadas por coma' }),
  notas: el('textarea', { id: 'c-notas', rows: 4, disabled: !escribe }, c.notas || ''),
};
const owner = gestiona ? selector({ id: 'c-owner' }, [['', 'Sin asignar'], ...opciones.vendedores.map((v) => [v._id, v.nombre])], c.owner || '') : null;
// Si la empresa del contacto no está entre las primeras 100, se agrega para no perderla.
if (c.empresaId && !empresas.items.some((e) => e._id === c.empresaId)) f.empresaId.append(el('option', { value: c.empresaId }, c.empresaNombre));
f.empresaId.value = c.empresaId || '';

const guardar = el('button', { type: 'submit' }, nuevo ? 'Crear contacto' : 'Guardar cambios');
const archivar = !nuevo && escribe ? el('button', { type: 'button', class: 'peligro' }, 'Archivar') : null;

const form = el('form', { novalidate: true },
  el('div', { class: 'campos' },
    campo('Nombre', f.nombre), campo('Apellido', f.apellido),
    campo('Email', f.email), campo('Teléfono', f.telefono),
    campo('Empresa', f.empresaId, escribe ? el('a', { href: '/empresas' }, 'Crear una empresa nueva') : null), campo('Cargo', f.cargo),
    campo('Tipo de cliente', f.segmento), campo('Etapa', f.lifecycleStage),
    campo('Dirección', f.direccion), campo('Municipio / partido', f.municipio),
    campo('Localidad', f.localidad), campo('Etiquetas', f.etiquetas),
    owner ? campo('Vendedor asignado', owner) : null),
  campo('Notas', f.notas),
  el('datalist', { id: 'municipios' }, opciones.municipios.map((m) => el('option', { value: m }))),
  escribe ? el('div', { class: 'acciones' }, guardar, archivar) : null);

poner(app, 
  el('a', { href: '/contactos', class: 'suave' }, '← Contactos'),
  el('h1', {}, nuevo ? 'Nuevo contacto' : [c.nombre, c.apellido].filter(Boolean).join(' ')),
  nuevo ? null : el('p', { class: 'sub' }, `${c.empresaNombre ? `${c.empresaNombre} · ` : ''}Alta ${fecha(c.createdAt)} · ${c.origen === 'importacion' ? 'importado' : 'cargado a mano'} · última interacción ${fecha(c.fechaUltimaInteraccion)}`),
  el('section', { class: 'seccion' }, form),
);

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  conBoton(guardar, async () => {
    const datos = Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value]));
    datos.etiquetas = datos.etiquetas.split(',').map((x) => x.trim()).filter(Boolean);
    datos.empresaId = datos.empresaId || null;
    if (owner) datos.owner = owner.value || null;
    if (nuevo) {
      const r = await api('POST', '/crm/contactos', datos);
      location.replace(`/contacto?id=${r._id}&creado=1`);
    } else {
      if (!gestiona) delete datos.owner;
      await api('PATCH', `/crm/contactos/${id}`, datos);
      aviso('Cambios guardados.');
    }
  });
});
archivar?.addEventListener('click', () => {
  if (!confirm('¿Archivar este contacto? Deja de aparecer en los listados, pero su historia se conserva.')) return;
  conBoton(archivar, async () => { await api('DELETE', `/crm/contactos/${id}`); location.replace('/contactos'); });
});
if (parametro('creado')) aviso('Contacto creado.');

// =====================  Actividad comercial del contacto (Fase 2B)  =====================

const cajaOps = el('div');
const cajaLinea = el('ul', { class: 'linea-tiempo' });
const cajaTareas = el('ul', { class: 'lista-tareas' });
let etapasNombre = new Map();

function seccionOportunidades() {
  const sec = el('section', { class: 'seccion' }, el('div', { class: 'encabezado' }, el('h2', {}, 'Oportunidades'),
    escribe ? el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'secundario chico', onclick: () => formOp.classList.toggle('oculto') }, 'Nueva oportunidad')) : null));
  const titulo = el('input', { id: 'nop-titulo', maxlength: 120 });
  const valor = el('input', { id: 'nop-valor', type: 'number', min: 0, step: 1000 });
  const crear = el('button', { type: 'submit' }, 'Crear');
  const formOp = el('form', { class: 'oculto', novalidate: true }, el('div', { class: 'campos' }, campo('Título', titulo), campo('Valor estimado ($)', valor)), el('div', { class: 'acciones' }, crear));
  formOp.addEventListener('submit', (ev) => {
    ev.preventDefault();
    conBoton(crear, async () => {
      await api('POST', '/crm/oportunidades', { contactoId: id, titulo: titulo.value, valorEstimado: valor.value || 0 });
      formOp.reset(); formOp.classList.add('oculto');
      aviso('Oportunidad creada. La ves también en el Pipeline.');
      await cargarOps();
    });
  });
  sec.append(formOp, cajaOps);
  return sec;
}

function seccionRegistrar() {
  if (!escribe) return null;
  const tipo = selector({ id: 'a-tipo' }, Object.entries(TIPO_ACTIVIDAD), 'llamada');
  const resultado = selector({ id: 'a-resultado' }, [['', 'Sin indicar'], ...Object.entries(RESULTADO)]);
  const asunto = el('input', { id: 'a-asunto', maxlength: 150, placeholder: 'Ej.: Le presenté la línea de espumantes' });
  const descripcion = el('textarea', { id: 'a-desc', rows: 3 });
  const proximo = el('input', { id: 'a-proximo', maxlength: 200, placeholder: 'Ej.: Enviar propuesta con precios' });
  const fechaProx = el('input', { id: 'a-fecha-prox', type: 'date' });
  const crearTarea = el('input', { id: 'a-tarea', type: 'checkbox', checked: true });
  const guardar = el('button', { type: 'submit' }, 'Registrar');
  const form = el('form', { novalidate: true },
    el('div', { class: 'campos' }, campo('Tipo', tipo), campo('Resultado', resultado), campo('Asunto', asunto), campo('Próximo paso', proximo), campo('Fecha del próximo paso', fechaProx)),
    campo('Detalle (opcional)', descripcion),
    el('label', { class: 'check-linea', for: 'a-tarea' }, crearTarea, 'Crear una tarea con el próximo paso'),
    el('div', { class: 'acciones' }, guardar));
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    conBoton(guardar, async () => {
      const r = await api('POST', '/crm/actividades', { contactoId: id, tipo: tipo.value, resultado: resultado.value, asunto: asunto.value, descripcion: descripcion.value, proximoPaso: proximo.value, fechaProximoPaso: fechaProx.value || null, crearTarea: crearTarea.checked });
      form.reset(); tipo.value = 'llamada'; crearTarea.checked = true;
      aviso(r.tareaId ? 'Actividad registrada y tarea creada.' : 'Actividad registrada.');
      await Promise.all([cargarLinea(), cargarTareas()]);
    });
  });
  return el('section', { class: 'seccion' }, el('h2', {}, 'Registrar actividad'), el('p', { class: 'sub' }, 'Llamada, visita, email o WhatsApp: queda en la historia del contacto.'), form);
}

const seccionLinea = () => el('section', { class: 'seccion' }, el('h2', {}, 'Historia'), cajaLinea);
const seccionTareas = () => el('section', { class: 'seccion' }, el('h2', {}, 'Tareas pendientes'), cajaTareas, el('a', { href: '/tareas' }, 'Ver todas las tareas'));

async function cargarOps() {
  const r = await api('GET', `/crm/oportunidades?contactoId=${id}&porPagina=50`);
  vaciar(cajaOps);
  if (!r.items.length) { cajaOps.append(el('p', { class: 'vacio' }, 'Sin oportunidades.')); return; }
  const estado = (o) => (o.estado === 'abierta' ? etapasNombre.get(o.etapa) || o.etapa : o.estado === 'ganada' ? 'Ganada' : `Perdida: ${o.motivoPerdida}`);
  cajaOps.append(el('div', { class: 'tabla-scroll' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Oportunidad', 'Valor', 'Estado', 'Actualizada'].map((t) => el('th', {}, t)))),
    el('tbody', {}, r.items.map((o) => el('tr', {},
      el('td', {}, o.estado === 'abierta' ? el('a', { href: '/pipeline' }, o.titulo) : o.titulo),
      el('td', {}, moneda(o.valorEstimado)),
      el('td', {}, el('span', { class: `etiqueta ${o.estado === 'ganada' ? 'ok' : o.estado === 'perdida' ? 'no' : ''}` }, estado(o))),
      el('td', {}, fecha(o.updatedAt))))))));
}

async function cargarLinea() {
  const r = await api('GET', `/crm/actividades?contactoId=${id}&porPagina=50`);
  vaciar(cajaLinea);
  if (!r.items.length) { cajaLinea.append(el('li', { class: 'vacio' }, 'Todavía no hay actividad registrada.')); return; }
  cajaLinea.append(...r.items.map((a) => el('li', {},
    el('div', { class: 'cabecera' }, el('strong', {}, `${TIPO_ACTIVIDAD[a.tipo]}: ${a.asunto}`),
      a.resultado ? el('span', { class: `etiqueta ${a.resultado === 'positivo' ? 'ok' : a.resultado === 'negativo' ? 'no' : ''}` }, RESULTADO[a.resultado]) : null),
    el('div', { class: 'suave chico-texto' }, `${fechaHora(a.fecha)} · ${a.ownerNombre}`),
    a.descripcion ? el('p', {}, a.descripcion) : null,
    a.proximoPaso ? el('div', { class: 'chico-texto' }, `Próximo paso: ${a.proximoPaso}${a.fechaProximoPaso ? ` (${fecha(a.fechaProximoPaso)})` : ''}`) : null)));
}

async function cargarTareas() {
  const r = await api('GET', `/crm/tareas?contactoId=${id}`);
  const lista = [...r.vencidas, ...r.hoy, ...r.proximas, ...r.sinFecha];
  vaciar(cajaTareas);
  if (!lista.length) { cajaTareas.append(el('li', { class: 'vacio' }, 'Sin tareas pendientes.')); return; }
  cajaTareas.append(...lista.map((t) => filaTarea(t, {
    alCambiar: escribe ? async (tarea, check) => {
      try { await api('PATCH', `/crm/tareas/${tarea._id}/estado`, { estado: 'completada' }); aviso('Tarea completada.'); } catch (e) { aviso(e.message, 'error'); check.checked = false; }
      await cargarTareas();
    } : null,
  })));
}

if (!nuevo) {
  poner(app, ...[seccionOportunidades(), seccionRegistrar(), seccionLinea(), seccionTareas()].filter(Boolean));
  const cfg = await api('GET', '/organizacion/config').catch(() => null);
  etapasNombre = new Map((cfg?.config?.etapasPipeline || []).map((e) => [e.codigo, e.nombre]));
  await Promise.all([cargarOps(), cargarLinea(), cargarTareas()]);
}
