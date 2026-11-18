// Ficha de contacto: alta y edición. /contacto?nuevo=1  o  /contacto?id=...
import { el, vaciar, sesion, barra, aviso, conBoton, campo, selector, parametro, fecha, ETAPA } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (s.usuario.rol === 'superadmin') location.replace('/plataforma');
barra(s, '/contactos');

const gestiona = ['admin', 'consultor'].includes(s.usuario.rol);
const escribe = gestiona || s.usuario.rol === 'vendedor';
const id = parametro('id');
const nuevo = !id;
if (nuevo && !escribe) location.replace('/contactos');

const app = vaciar(document.getElementById('app'));
const [opciones, empresas, c] = await Promise.all([
  api('GET', '/crm/contactos/opciones'),
  api('GET', '/crm/empresas?porPagina=100'),
  nuevo ? Promise.resolve({ lifecycleStage: 'lead', etiquetas: [] }) : api('GET', `/crm/contactos/${id}`).catch(() => null),
]);
if (!c) { app.append(el('p', { class: 'vacio' }, 'El contacto no existe o no tenés acceso.'), el('a', { href: '/contactos' }, '← Volver a contactos')); throw new Error('sin acceso'); }

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

app.append(
  el('a', { href: '/contactos', class: 'suave' }, '← Contactos'),
  el('h1', {}, nuevo ? 'Nuevo contacto' : [c.nombre, c.apellido].filter(Boolean).join(' ')),
  nuevo ? null : el('p', { class: 'sub' }, `${c.empresaNombre ? `${c.empresaNombre} · ` : ''}Alta ${fecha(c.createdAt)} · ${c.origen === 'importacion' ? 'importado' : 'cargado a mano'} · última interacción ${fecha(c.fechaUltimaInteraccion)}`),
  el('section', { class: 'seccion' }, form),
  nuevo ? null : el('section', { class: 'seccion' }, el('h2', {}, 'Actividad'), el('p', { class: 'vacio' }, 'Llamadas, visitas y tareas de este contacto llegan en la Fase 2B.')),
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
