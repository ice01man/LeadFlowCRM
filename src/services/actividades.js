// Actividades: llamadas, visitas, emails, WhatsApp y notas. Cada una actualiza la última interacción del contacto
// y, si tiene próximo paso con fecha, puede crear la tarea correspondiente.
import { ROL } from '../config/roles.js';
import { TIPOS_ACTIVIDAD, RESULTADOS_ACTIVIDAD } from '../models/Actividad.js';
import * as contactos from './contactos.js';
import * as tareas from './tareas.js';
import { textoOpcional, fechaOpcional, idOpcional, puedeEscribir, paginacion } from '../crm/comun.js';
import { badRequest, noEncontrado, prohibido, texto } from '../utils/errores.js';

const TITULO_TIPO = { llamada: 'Llamar a', email: 'Escribir a', reunion: 'Reunión con', visita: 'Visitar a', whatsapp: 'WhatsApp a', nota: 'Seguimiento de' };

export async function registrar(ctx, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const contactoId = idOpcional(datos.contactoId, 'Contacto');
  if (!contactoId) throw badRequest('Falta el contacto.');
  const contacto = await contactos.obtener(ctx, contactoId);
  if (!TIPOS_ACTIVIDAD.includes(datos.tipo)) throw badRequest(`Tipo inválido. Opciones: ${TIPOS_ACTIVIDAD.join(', ')}.`);
  const resultado = datos.resultado ?? '';
  if (resultado && !RESULTADOS_ACTIVIDAD.includes(resultado)) throw badRequest('Resultado inválido.');
  const fecha = fechaOpcional(datos.fecha, 'La fecha') || new Date();
  if (fecha.getTime() > Date.now() + 864e5) throw badRequest('La fecha de la actividad no puede ser futura: para lo que viene, usá el próximo paso.');
  const oportunidadId = idOpcional(datos.oportunidadId, 'Oportunidad') ?? null;
  if (oportunidadId) {
    const o = await ctx.db.oportunidades.get(oportunidadId);
    if (!o || String(o.contactoId) !== String(contactoId)) throw badRequest('La oportunidad no corresponde a este contacto.');
  }
  const a = {
    contactoId, oportunidadId, owner: ctx.usuario.id, ownerNombre: ctx.usuario.nombre, tipo: datos.tipo,
    asunto: texto(datos.asunto, 'El asunto', { max: 150 }), descripcion: textoOpcional(datos.descripcion, 'La descripción', 3000),
    resultado, fecha, proximoPaso: textoOpcional(datos.proximoPaso, 'El próximo paso', 200),
    fechaProximoPaso: fechaOpcional(datos.fechaProximoPaso, 'La fecha del próximo paso') ?? null, tareaId: null,
  };
  // Próximo paso con fecha → tarea para quien registra (salvo que se pida lo contrario).
  if (a.proximoPaso && a.fechaProximoPaso && datos.crearTarea !== false) {
    const t = await tareas.crear(ctx, { titulo: a.proximoPaso, contactoId, oportunidadId: oportunidadId || undefined, fechaVencimiento: a.fechaProximoPaso.toISOString(), prioridad: 'media' });
    a.tareaId = String(t._id);
  }
  const creada = await ctx.db.actividades.create(a);
  const ultima = contacto.fechaUltimaInteraccion ? new Date(contacto.fechaUltimaInteraccion) : null;
  if (!ultima || fecha > ultima) await ctx.db.contactos.update(contactoId, { fechaUltimaInteraccion: fecha });
  return creada;
}

/** Línea de tiempo de un contacto (o las propias, para el vendedor sin contacto). */
export async function listar(ctx, q = {}) {
  const filtro = {};
  if (q.contactoId) {
    await contactos.obtener(ctx, String(q.contactoId)); // controla el acceso del vendedor
    filtro.contactoId = String(q.contactoId);
  } else if (ctx.usuario.rol === ROL.VENDEDOR) filtro.owner = ctx.usuario.id;
  if (q.tipo) filtro.tipo = String(q.tipo);
  const { pagina, porPagina, skip } = paginacion(q);
  const [total, items] = await Promise.all([ctx.db.actividades.count(filtro), ctx.db.actividades.list(filtro, { sort: { fecha: -1 }, skip, limit: porPagina })]);
  return { total, pagina, porPagina, items };
}

/** Solo quien la registró (o admin/consultor) puede borrarla, por ejemplo si se cargó en el contacto equivocado. */
export async function borrar(ctx, id) {
  const a = await ctx.db.actividades.get(id);
  if (!a) throw noEncontrado('Actividad no encontrada.');
  if (String(a.owner) !== ctx.usuario.id && ![ROL.ADMIN, ROL.CONSULTOR].includes(ctx.usuario.rol)) throw prohibido('Solo quien registró la actividad puede borrarla.');
  await ctx.db.actividades.remove(id);
  return { ok: true };
}

export { TITULO_TIPO };
