// Tareas de los vendedores: vencimiento, prioridad, estado y dependencias (no se completa hasta que terminen las anteriores).
import { ROL } from '../config/roles.js';
import { PRIORIDADES, ESTADOS_TAREA } from '../models/Tarea.js';
import * as contactos from './contactos.js';
import { textoOpcional, fechaOpcional, idOpcional, puedeEscribir, puedeAsignar } from '../crm/comun.js';
import { badRequest, conflicto, noEncontrado, prohibido, texto } from '../utils/errores.js';

const ROLES_OWNER = [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR];
const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ');

/** El vendedor ve las tareas que tiene asignadas o que creó; admin y consultor, todas. */
const alcance = (u) => (u.rol === ROL.VENDEDOR ? { $or: [{ owner: u.id }, { creadaPor: u.id }] } : {});

async function obtenerInterna(ctx, id) {
  const t = await ctx.db.tareas.get(id);
  const ve = t && (ctx.usuario.rol !== ROL.VENDEDOR || [String(t.owner), String(t.creadaPor)].includes(ctx.usuario.id));
  if (!ve) throw noEncontrado('Tarea no encontrada.');
  return t;
}
export const obtener = obtenerInterna;

async function ownerValido(ctx, owner) {
  if (ctx.usuario.rol === ROL.VENDEDOR) {
    if (owner && owner !== ctx.usuario.id) throw prohibido('Solo podés crear tareas para vos.');
    return ctx.usuario.id;
  }
  if (!owner) return ctx.usuario.id;
  if (typeof owner !== 'string') throw badRequest('Responsable inválido.');
  const u = await ctx.db.usuarios.get(owner);
  if (!u || u.activo === false || !ROLES_OWNER.includes(u.rol)) throw badRequest('El responsable no existe en tu organización.');
  return String(u._id);
}

/** Valida las dependencias: tareas de la organización, sin repetir y sin formar un ciclo (A espera a B que espera a A). */
async function dependenciasValidas(ctx, ids, propiaId = null) {
  if (!Array.isArray(ids)) throw badRequest('Las dependencias tienen que ser una lista.');
  if (ids.length > 20) throw badRequest('Máximo 20 dependencias.');
  const unicas = [...new Set(ids.map((i) => idOpcional(i, 'Dependencia')).filter(Boolean))];
  for (const id of unicas) {
    if (id === String(propiaId)) throw badRequest('Una tarea no puede depender de sí misma.');
    if (!await ctx.db.tareas.get(id)) throw badRequest('Una de las tareas de las que depende no existe.');
  }
  if (propiaId) {
    // Recorre hacia atrás: si desde alguna dependencia se llega a esta tarea, habría un ciclo.
    const visitadas = new Set();
    const pila = [...unicas];
    while (pila.length) {
      const actual = pila.pop();
      if (actual === String(propiaId)) throw conflicto('Esa dependencia formaría un ciclo: las tareas quedarían esperándose entre sí.');
      if (visitadas.has(actual)) continue;
      visitadas.add(actual);
      const t = await ctx.db.tareas.get(actual);
      for (const d of t?.dependeDe || []) pila.push(String(d));
    }
  }
  return unicas;
}

async function vincularContacto(ctx, contactoId) {
  if (!contactoId) return { contactoId: null, contactoNombre: '' };
  const c = await contactos.obtener(ctx, contactoId);
  return { contactoId: String(c._id), contactoNombre: nombreCompleto(c) };
}

export async function crear(ctx, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const prioridad = datos.prioridad ?? 'media';
  if (!PRIORIDADES.includes(prioridad)) throw badRequest(`Prioridad inválida. Opciones: ${PRIORIDADES.join(', ')}.`);
  const t = {
    titulo: texto(datos.titulo, 'El título', { max: 150 }),
    descripcion: textoOpcional(datos.descripcion, 'La descripción', 3000),
    fechaVencimiento: fechaOpcional(datos.fechaVencimiento, 'La fecha de vencimiento') ?? null,
    prioridad,
    owner: await ownerValido(ctx, datos.owner),
    creadaPor: ctx.usuario.id,
    estado: 'pendiente',
    oportunidadId: idOpcional(datos.oportunidadId, 'Oportunidad') ?? null,
    ...(await vincularContacto(ctx, idOpcional(datos.contactoId, 'Contacto'))),
    dependeDe: datos.dependeDe ? await dependenciasValidas(ctx, datos.dependeDe) : [],
  };
  if (t.oportunidadId && !await ctx.db.oportunidades.get(t.oportunidadId)) throw badRequest('La oportunidad no existe.');
  return ctx.db.tareas.create(t);
}

export async function actualizar(ctx, id, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const actual = await obtenerInterna(ctx, id);
  const patch = {};
  if (datos.titulo !== undefined) patch.titulo = texto(datos.titulo, 'El título', { max: 150 });
  if (datos.descripcion !== undefined) patch.descripcion = textoOpcional(datos.descripcion, 'La descripción', 3000);
  if (datos.fechaVencimiento !== undefined) patch.fechaVencimiento = fechaOpcional(datos.fechaVencimiento, 'La fecha de vencimiento');
  if (datos.prioridad !== undefined) {
    if (!PRIORIDADES.includes(datos.prioridad)) throw badRequest('Prioridad inválida.');
    patch.prioridad = datos.prioridad;
  }
  if (datos.owner !== undefined) {
    if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor reasignan tareas.');
    patch.owner = await ownerValido(ctx, datos.owner);
  }
  if (datos.contactoId !== undefined) Object.assign(patch, await vincularContacto(ctx, idOpcional(datos.contactoId, 'Contacto')));
  if (datos.dependeDe !== undefined) patch.dependeDe = await dependenciasValidas(ctx, datos.dependeDe, actual._id);
  if (datos.estado !== undefined) throw badRequest('Para cambiar el estado usá la acción de estado.');
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  return ctx.db.tareas.update(id, patch);
}

/** Tareas de las que depende y todavía no están completas. */
async function bloqueantes(ctx, t) {
  const r = [];
  for (const d of t.dependeDe || []) {
    const dep = await ctx.db.tareas.get(d);
    if (dep && !['completada', 'cancelada'].includes(dep.estado)) r.push(dep);
  }
  return r;
}

export async function cambiarEstado(ctx, id, { estado } = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const t = await obtenerInterna(ctx, id);
  if (!ESTADOS_TAREA.includes(estado)) throw badRequest(`Estado inválido. Opciones: ${ESTADOS_TAREA.join(', ')}.`);
  if (['en_progreso', 'completada'].includes(estado)) {
    const pendientes = await bloqueantes(ctx, t);
    if (pendientes.length) throw conflicto(`Primero hay que terminar: ${pendientes.map((p) => `"${p.titulo}"`).join(', ')}.`);
  }
  return ctx.db.tareas.update(id, { estado, completadaEn: estado === 'completada' ? new Date() : null });
}

/** Listado con agrupación para la pantalla: vencidas, hoy, próximas, sin fecha y completadas recientes. */
export async function listar(ctx, q = {}) {
  const filtro = { ...alcance(ctx.usuario) };
  if (q.owner === 'yo') filtro.owner = ctx.usuario.id;
  else if (q.owner && ctx.usuario.rol !== ROL.VENDEDOR) filtro.owner = String(q.owner);
  if (q.contactoId) filtro.contactoId = String(q.contactoId);
  const todas = await ctx.db.tareas.list(filtro, { sort: { fechaVencimiento: 1 }, limit: 2000 });
  const ahora = q.ahora ? new Date(q.ahora) : new Date();
  // "Hoy" según el día en Argentina (UTC-3), no según el servidor.
  const diaAR = (d) => new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
  const hoy = diaAR(ahora);
  const abiertas = todas.filter((t) => ['pendiente', 'en_progreso'].includes(t.estado));
  const porId = new Map(todas.map((t) => [String(t._id), t]));
  const conBloqueo = (t) => ({ ...t, bloqueadaPor: (t.dependeDe || []).map((d) => porId.get(String(d))).filter((d) => d && !['completada', 'cancelada'].includes(d.estado)).map((d) => ({ _id: d._id, titulo: d.titulo })) });
  const grupo = (fn) => abiertas.filter(fn).map(conBloqueo);
  const hace7 = new Date(ahora.getTime() - 7 * 864e5);
  return {
    vencidas: grupo((t) => t.fechaVencimiento && diaAR(t.fechaVencimiento) < hoy),
    hoy: grupo((t) => t.fechaVencimiento && diaAR(t.fechaVencimiento) === hoy),
    proximas: grupo((t) => t.fechaVencimiento && diaAR(t.fechaVencimiento) > hoy),
    sinFecha: grupo((t) => !t.fechaVencimiento),
    completadas: todas.filter((t) => t.estado === 'completada' && t.completadaEn && new Date(t.completadaEn) >= hace7).sort((a, b) => new Date(b.completadaEn) - new Date(a.completadaEn)),
  };
}
