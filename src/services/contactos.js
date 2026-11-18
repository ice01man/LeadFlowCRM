// Contactos de una organización: alta, edición, búsqueda, filtros, vistas y asignación a vendedores.
// Recibe el contexto { db, usuario, organizacion() } armado por el middleware.
import { ETAPAS_CICLO } from '../models/Contacto.js';
import { ROL } from '../config/roles.js';
import * as empresas from './empresas.js';
import {
  normalizar, soloDigitos, escaparRegex, textoOpcional, coordenada, EMAIL,
  alcanceContactos, puedeEscribir, puedeAsignar, paginacion,
} from '../crm/comun.js';
import { badRequest, conflicto, noEncontrado, prohibido, texto } from '../utils/errores.js';

export const DIAS_DORMIDO = 60;
const ROLES_OWNER = [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR];

/** Vistas que vienen con el sistema. Las personalizadas se guardan en db.vistas. */
export const VISTAS_PREDEFINIDAS = [
  { codigo: 'todos', nombre: 'Todos', filtros: {} },
  { codigo: 'mis_contactos', nombre: 'Mis contactos', filtros: { owner: 'yo' } },
  { codigo: 'sin_asignar', nombre: 'Sin asignar', filtros: { owner: 'sin' } },
  { codigo: 'leads', nombre: 'Leads', filtros: { lifecycleStage: 'lead' } },
  { codigo: 'clientes', nombre: 'Clientes activos', filtros: { lifecycleStage: 'clientes' } },
  { codigo: 'dormidos', nombre: `Dormidos (sin interacción en ${DIAS_DORMIDO} días)`, filtros: { dormidos: 'true' } },
  { codigo: 'sin_telefono', nombre: 'Sin teléfono', filtros: { sinTelefono: 'true' } },
  { codigo: 'sin_email', nombre: 'Sin email', filtros: { sinEmail: 'true' } },
];
export const FILTROS_PERMITIDOS = ['q', 'segmento', 'municipio', 'localidad', 'lifecycleStage', 'owner', 'empresaId', 'etiqueta', 'sinTelefono', 'sinEmail', 'dormidos'];

const indice = (c) => normalizar([c.nombre, c.apellido, c.email, c.telefono, c.empresaNombre, c.cargo, c.municipio, c.localidad, c.segmento, ...(c.etiquetas || [])].join(' '));

/** Devuelve el contacto sin campos internos. */
const publico = ({ busqueda, telefonoNormalizado, ...c }) => c;

// ---------- Validación ----------

async function segmentoValido(ctx, segmento) {
  if (!segmento) return '';
  const lista = (await ctx.organizacion()).config?.categoriasNegocio || [];
  const hit = lista.find((c) => normalizar(c) === normalizar(segmento));
  if (!hit) throw badRequest(`El tipo de cliente "${segmento}" no está en la configuración. Opciones: ${lista.join(', ')}.`);
  return hit;
}

async function ownerValido(ctx, owner) {
  if (owner === null || owner === '' || owner === undefined) return null;
  if (typeof owner !== 'string') throw badRequest('Vendedor asignado inválido.');
  const u = await ctx.db.usuarios.get(owner);
  if (!u || u.activo === false || !ROLES_OWNER.includes(u.rol)) throw badRequest('El vendedor asignado no existe en tu organización o no puede tener contactos.');
  return String(u._id);
}

async function limpiar(ctx, datos, parcial = false) {
  const r = {};
  if (!parcial || datos.nombre !== undefined) r.nombre = texto(datos.nombre, 'El nombre', { max: 80 });
  const campos = [['apellido', 'El apellido', 80], ['cargo', 'El cargo', 80], ['direccion', 'La dirección', 200], ['municipio', 'El municipio', 80], ['localidad', 'La localidad', 80], ['notas', 'Las notas', 3000]];
  for (const [campo, nombre, max] of campos) if (datos[campo] !== undefined) r[campo] = textoOpcional(datos[campo], nombre, max);
  if (datos.email !== undefined) {
    r.email = textoOpcional(datos.email, 'El email', 120).toLowerCase();
    if (r.email && !EMAIL.test(r.email)) throw badRequest(`Email inválido: ${r.email}`);
  }
  if (datos.telefono !== undefined) {
    r.telefono = textoOpcional(datos.telefono, 'El teléfono', 40);
    r.telefonoNormalizado = soloDigitos(r.telefono);
    if (r.telefono && r.telefonoNormalizado.length < 6) throw badRequest(`Teléfono inválido: ${r.telefono}`);
  }
  if (datos.segmento !== undefined) r.segmento = await segmentoValido(ctx, textoOpcional(datos.segmento, 'El tipo de cliente', 60));
  if (datos.lifecycleStage !== undefined) {
    if (!ETAPAS_CICLO.includes(datos.lifecycleStage)) throw badRequest(`Etapa inválida. Opciones: ${ETAPAS_CICLO.join(', ')}.`);
    r.lifecycleStage = datos.lifecycleStage;
  }
  if (datos.etiquetas !== undefined) {
    if (!Array.isArray(datos.etiquetas) || datos.etiquetas.length > 20) throw badRequest('Etiquetas: hasta 20.');
    r.etiquetas = [...new Set(datos.etiquetas.map((e) => textoOpcional(e, 'Etiqueta', 40)).filter(Boolean))];
  }
  if (datos.lat !== undefined) r.lat = coordenada(datos.lat, 'Latitud', -90, 90);
  if (datos.lng !== undefined) r.lng = coordenada(datos.lng, 'Longitud', -180, 180);
  if (datos.empresaId !== undefined) {
    if (datos.empresaId === null || datos.empresaId === '') { r.empresaId = null; r.empresaNombre = ''; } else {
      if (typeof datos.empresaId !== 'string') throw badRequest('Empresa inválida.');
      const e = await ctx.db.empresas.get(datos.empresaId);
      if (!e || e.activa === false) throw badRequest('La empresa no existe en tu organización.');
      r.empresaId = String(e._id);
      r.empresaNombre = e.razonSocial;
    }
  }
  return r;
}

/** Busca un contacto activo con el mismo email o teléfono. */
export async function buscarDuplicado(ctx, { email, telefonoNormalizado }, excluirId = null) {
  const candidatos = [];
  if (email) candidatos.push(await ctx.db.contactos.findOne({ email, activo: true }));
  if (telefonoNormalizado) candidatos.push(await ctx.db.contactos.findOne({ telefonoNormalizado, activo: true }));
  return candidatos.find((c) => c && String(c._id) !== String(excluirId)) || null;
}

const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ');

// ---------- Filtros ----------

/** Convierte los filtros de la pantalla (strings) en un filtro del store, respetando el alcance del rol. */
export function construirFiltro(usuario, f = {}, { ahora = new Date() } = {}) {
  const y = [{ activo: f.archivados === 'true' ? false : true }, alcanceContactos(usuario)];
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  if (str(f.q)) y.push({ busqueda: { $regex: escaparRegex(normalizar(f.q).slice(0, 80)) } });
  if (str(f.segmento)) y.push({ segmento: str(f.segmento) });
  if (str(f.municipio)) y.push({ municipio: str(f.municipio) });
  if (str(f.localidad)) y.push({ localidad: str(f.localidad) });
  if (str(f.etiqueta)) y.push({ etiquetas: str(f.etiqueta) });
  if (str(f.empresaId)) y.push({ empresaId: str(f.empresaId) });
  const etapa = str(f.lifecycleStage);
  if (etapa === 'clientes') y.push({ lifecycleStage: { $in: ['cliente', 'fidelizado'] } });
  else if (etapa) {
    if (!ETAPAS_CICLO.includes(etapa)) throw badRequest('Etapa inválida.');
    y.push({ lifecycleStage: etapa });
  }
  const owner = str(f.owner);
  if (owner === 'yo') y.push({ owner: usuario.id });
  else if (owner === 'sin') y.push({ owner: null });
  else if (owner) y.push({ owner });
  if (f.sinTelefono === 'true') y.push({ telefono: '' });
  if (f.sinEmail === 'true') y.push({ email: '' });
  if (f.dormidos === 'true') {
    const limite = new Date(ahora.getTime() - DIAS_DORMIDO * 864e5);
    y.push({ $or: [{ fechaUltimaInteraccion: { $lt: limite } }, { fechaUltimaInteraccion: null, createdAt: { $lt: limite } }] });
  }
  return { $and: y.filter((p) => Object.keys(p).length) };
}

async function resolverVista(ctx, codigo) {
  const pre = VISTAS_PREDEFINIDAS.find((v) => v.codigo === codigo);
  if (pre) return pre.filtros;
  const v = typeof codigo === 'string' ? await ctx.db.vistas.get(codigo) : null;
  if (!v || (!v.compartida && String(v.creadaPor) !== ctx.usuario.id)) throw noEncontrado('Vista no encontrada.');
  return v.filtros;
}

/** Filtros efectivos: los de la vista (si hay) más los que vienen sueltos en la consulta. */
async function filtrosDe(ctx, q) {
  const base = q.vista ? await resolverVista(ctx, String(q.vista)) : {};
  const sueltos = Object.fromEntries(FILTROS_PERMITIDOS.filter((k) => q[k] !== undefined && q[k] !== '').map((k) => [k, q[k]]));
  return { ...base, ...sueltos, archivados: q.archivados };
}

const ORDENES = { recientes: { createdAt: -1 }, nombre: { nombre: 1, apellido: 1 }, interaccion: { fechaUltimaInteraccion: -1 }, empresa: { empresaNombre: 1 } };

// ---------- Operaciones ----------

export async function listar(ctx, q = {}) {
  const filtro = construirFiltro(ctx.usuario, await filtrosDe(ctx, q));
  const { pagina, porPagina, skip } = paginacion(q);
  const sort = ORDENES[q.orden] || ORDENES.recientes;
  const [total, items] = await Promise.all([ctx.db.contactos.count(filtro), ctx.db.contactos.list(filtro, { sort, skip, limit: porPagina })]);
  return { total, pagina, porPagina, items: items.map(publico) };
}

/** Para exportar: todos los que cumplen el filtro (con tope). */
export async function todosLosFiltrados(ctx, q = {}, tope = 10000) {
  const filtro = construirFiltro(ctx.usuario, await filtrosDe(ctx, q));
  return (await ctx.db.contactos.list(filtro, { sort: ORDENES.nombre, limit: tope })).map(publico);
}

async function obtenerInterno(ctx, id) {
  const c = await ctx.db.contactos.get(id);
  if (!c) throw noEncontrado('Contacto no encontrado.');
  if (ctx.usuario.rol === ROL.VENDEDOR && String(c.owner) !== ctx.usuario.id) throw noEncontrado('Contacto no encontrado.');
  return c;
}

export const obtener = async (ctx, id) => publico(await obtenerInterno(ctx, id));

export async function crear(ctx, datos = {}, { origen = 'manual', omitirDuplicados = false } = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const c = await limpiar(ctx, datos);
  // Asignación: el vendedor siempre queda como dueño de lo que crea; admin y consultor eligen.
  c.owner = ctx.usuario.rol === ROL.VENDEDOR ? ctx.usuario.id : await ownerValido(ctx, datos.owner);
  if (!omitirDuplicados) {
    const dup = await buscarDuplicado(ctx, c);
    if (dup) throw conflicto(`Ya existe un contacto con ese ${dup.email && dup.email === c.email ? 'email' : 'teléfono'}: ${nombreCompleto(dup)}.`);
  }
  const doc = { lifecycleStage: 'lead', ...c, origen, activo: true };
  doc.busqueda = indice(doc);
  return publico(await ctx.db.contactos.create(doc));
}

export async function actualizar(ctx, id, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const actual = await obtenerInterno(ctx, id);
  const patch = await limpiar(ctx, datos, true);
  if (datos.owner !== undefined) {
    if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor reasignan contactos.');
    patch.owner = await ownerValido(ctx, datos.owner);
  }
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  const dup = await buscarDuplicado(ctx, { email: patch.email, telefonoNormalizado: patch.telefonoNormalizado }, id);
  if (dup) throw conflicto(`Ya existe otro contacto con ese ${patch.email && dup.email === patch.email ? 'email' : 'teléfono'}: ${nombreCompleto(dup)}.`);
  const final = { ...actual, ...patch };
  return publico(await ctx.db.contactos.update(id, { ...patch, busqueda: indice(final) }));
}

export async function archivar(ctx, id) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  await obtenerInterno(ctx, id);
  return publico(await ctx.db.contactos.update(id, { activo: false }));
}

/** Asigna varios contactos a un vendedor (o los deja sin asignar con owner null). */
export async function asignar(ctx, { ids, owner } = {}) {
  if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor reasignan contactos.');
  if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some((i) => typeof i !== 'string')) throw badRequest('Elegí entre 1 y 1000 contactos.');
  const destino = await ownerValido(ctx, owner);
  let actualizados = 0;
  for (const id of new Set(ids)) if (await ctx.db.contactos.update(id, { owner: destino })) actualizados += 1;
  return { actualizados };
}

/** Datos para los filtros de la pantalla: municipios y etiquetas en uso, vendedores, tipos de cliente. */
export async function opciones(ctx) {
  const todos = await ctx.db.contactos.list({ activo: true, ...alcanceContactos(ctx.usuario) }, { limit: 20000 });
  const unicos = (arr) => [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const usuarios = await ctx.db.usuarios.list({ activo: true, rol: { $in: ROLES_OWNER } }, { sort: { nombre: 1 } });
  const org = await ctx.organizacion();
  return {
    municipios: unicos(todos.map((c) => c.municipio)),
    etiquetas: unicos(todos.flatMap((c) => c.etiquetas || [])),
    segmentos: org.config?.categoriasNegocio || [],
    etapas: ETAPAS_CICLO,
    vendedores: usuarios.map((u) => ({ _id: u._id, nombre: u.nombre, rol: u.rol })),
  };
}

// ---------- Vistas guardadas ----------

function limpiarFiltros(f) {
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw badRequest('Filtros inválidos.');
  const r = {};
  for (const k of FILTROS_PERMITIDOS) {
    if (f[k] === undefined || f[k] === '') continue;
    if (typeof f[k] !== 'string' || f[k].length > 100) throw badRequest(`Filtro "${k}" inválido.`);
    r[k] = f[k];
  }
  if (!Object.keys(r).length) throw badRequest('La vista no tiene ningún filtro.');
  return r;
}

export async function listarVistas(ctx) {
  const propias = await ctx.db.vistas.list({ $or: [{ creadaPor: ctx.usuario.id }, { compartida: true }] }, { sort: { nombre: 1 } });
  return {
    predefinidas: VISTAS_PREDEFINIDAS.filter((v) => !(ctx.usuario.rol === ROL.VENDEDOR && ['mis_contactos', 'sin_asignar'].includes(v.codigo))),
    guardadas: propias.map((v) => ({ ...v, propia: String(v.creadaPor) === ctx.usuario.id })),
  };
}

export async function crearVista(ctx, { nombre, filtros, compartida = false } = {}) {
  if (typeof compartida !== 'boolean') throw badRequest('compartida debe ser true o false.');
  if (compartida && !puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor comparten vistas con toda la organización.');
  const f = limpiarFiltros(filtros);
  construirFiltro(ctx.usuario, f); // valida que los filtros tengan sentido
  return ctx.db.vistas.create({ nombre: texto(nombre, 'El nombre de la vista', { max: 60 }), filtros: f, compartida, creadaPor: ctx.usuario.id });
}

export async function borrarVista(ctx, id) {
  const v = await ctx.db.vistas.get(id);
  if (!v) throw noEncontrado('Vista no encontrada.');
  const esDueno = String(v.creadaPor) === ctx.usuario.id;
  if (!esDueno && ctx.usuario.rol !== ROL.ADMIN) throw prohibido('Solo quien creó la vista o el administrador pueden borrarla.');
  await ctx.db.vistas.remove(id);
  return { ok: true };
}

export { empresas };
