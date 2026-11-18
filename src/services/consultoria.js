// Consultoría: plan de trabajo por cliente, bitácora privada, métricas del CRM y panel "Mis clientes".
// El plan lo edita solo el consultor (superadmin). El cliente lo ve en solo lectura y su admin marca las tareas que le tocan.
import crypto from 'node:crypto';
import { db } from '../store/index.js';
import { ESTADOS_TAREA_PLAN, RESPONSABLES_PLAN } from '../models/PlanConsultoria.js';
import { TIPOS_BITACORA } from '../models/Bitacora.js';
import { ROL } from '../config/roles.js';
import { textoOpcional, fechaOpcional } from '../crm/comun.js';
import { badRequest, conflicto, noEncontrado, prohibido, texto } from '../utils/errores.js';

const soloConsultor = (ctx) => { if (!ctx.usuario.esSuperadmin) throw prohibido('Solo el consultor puede hacer esto.'); };
const codigoNuevo = (p) => `${p}${crypto.randomBytes(4).toString('hex')}`;
const diaAR = (d) => new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

// ---------- Métricas del CRM de una organización ----------

/** Foto del CRM de una organización. Recibe los repos ya atados a esa organización. */
export async function metricasCRM(repos, ahora = new Date()) {
  const hace30 = new Date(ahora.getTime() - 30 * 864e5);
  const hoy = diaAR(ahora);
  const [contactos, abiertas, cerradas, tareas, actividades, usuarios] = await Promise.all([
    repos.contactos.list({ activo: true }, { limit: 100000 }),
    repos.oportunidades.list({ estado: 'abierta' }, { limit: 100000 }),
    repos.oportunidades.list({ estado: { $in: ['ganada', 'perdida'] }, fechaCierre: { $gte: hace30 } }, { limit: 100000 }),
    repos.tareas.list({ estado: { $in: ['pendiente', 'en_progreso'] } }, { limit: 100000 }),
    repos.actividades.list({}, { sort: { fecha: -1 }, limit: 1 }),
    repos.usuarios.list({ activo: true }),
  ]);
  const actividades30 = await repos.actividades.count({ fecha: { $gte: hace30 } });
  const ganadas = cerradas.filter((o) => o.estado === 'ganada');
  const suma = (arr) => arr.reduce((a, o) => a + (o.valorEstimado || 0), 0);
  const ultimaActividad = actividades[0]?.fecha || null;
  return {
    fecha: ahora,
    contactos: contactos.length,
    leads: contactos.filter((c) => ['lead', 'calificado'].includes(c.lifecycleStage)).length,
    clientes: contactos.filter((c) => ['cliente', 'fidelizado'].includes(c.lifecycleStage)).length,
    oportunidadesAbiertas: abiertas.length,
    valorAbierto: suma(abiertas),
    ganadas30: ganadas.length,
    valorGanado30: suma(ganadas),
    perdidas30: cerradas.length - ganadas.length,
    tareasVencidas: tareas.filter((t) => t.fechaVencimiento && diaAR(t.fechaVencimiento) < hoy).length,
    actividades30,
    ultimaActividad,
    usuariosActivos: usuarios.length,
  };
}

/** Semáforo de uso según días desde la última actividad registrada por el equipo del cliente. */
export function semaforoUso(ultimaActividad, ahora = new Date()) {
  if (!ultimaActividad) return { color: 'gris', texto: 'Sin actividad registrada' };
  const dias = Math.floor((ahora - new Date(ultimaActividad)) / 864e5);
  if (dias <= 7) return { color: 'verde', texto: dias === 0 ? 'Activo hoy' : `Última actividad hace ${dias} día${dias === 1 ? '' : 's'}` };
  if (dias <= 21) return { color: 'amarillo', texto: `Última actividad hace ${dias} días` };
  return { color: 'rojo', texto: `Sin actividad hace ${dias} días` };
}

// ---------- Resumen del plan ----------

export function resumenPlan(plan, ahora = new Date()) {
  if (!plan) return null;
  const hoy = diaAR(ahora);
  const tareas = plan.fases.flatMap((f) => f.tareas.map((t) => ({ ...t, fase: f.nombre })));
  const vigentes = tareas.filter((t) => t.estado !== 'cancelada');
  const hechas = vigentes.filter((t) => t.estado === 'completada');
  const abiertas = vigentes.filter((t) => t.estado !== 'completada');
  const atrasadas = abiertas.filter((t) => t.fechaVencimiento && diaAR(t.fechaVencimiento) < hoy);
  const faseActual = plan.fases.find((f) => f.tareas.some((t) => !['completada', 'cancelada'].includes(t.estado)));
  const proxima = [...abiertas].filter((t) => t.fechaVencimiento).sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0] || null;
  return {
    estado: plan.estado,
    avance: vigentes.length ? Math.round((hechas.length / vigentes.length) * 100) : 0,
    tareasTotal: vigentes.length,
    tareasCompletadas: hechas.length,
    atrasadas: atrasadas.length,
    atrasadasCliente: atrasadas.filter((t) => t.responsable === 'cliente').length,
    faseActual: faseActual?.nombre || (vigentes.length && !abiertas.length ? 'Todas las fases completas' : null),
    proxima: proxima ? { titulo: proxima.titulo, fecha: proxima.fechaVencimiento, responsable: proxima.responsable, fase: proxima.fase } : null,
  };
}

// ---------- Plan ----------

export async function obtenerPlan(ctx) {
  const plan = await ctx.db.planes.findOne({});
  const esConsultor = !!ctx.usuario.esSuperadmin;
  // El consultor ve además la foto actual del CRM para compararla con la de inicio.
  return { plan, resumen: resumenPlan(plan), esConsultor, metricasActuales: esConsultor ? await metricasCRM(ctx.db) : null };
}

function urlValida(u, campo) {
  const t = texto(u, campo, { max: 500 });
  let url;
  try { url = new URL(t); } catch { throw badRequest(`${campo}: no es un link válido.`); }
  if (!['https:', 'http:'].includes(url.protocol)) throw badRequest(`${campo}: tiene que empezar con https://`);
  return url.toString();
}

function lista(v, campo, max) {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length > max) throw badRequest(`${campo}: hasta ${max} elementos.`);
  return v;
}

function numero(v, campo) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) throw badRequest(`${campo}: número inválido.`);
  return n;
}

/** Valida el plan completo que manda el editor. Conserva códigos y fechas de completado existentes. */
function limpiarPlan(datos, anterior) {
  const tareasPrevias = new Map((anterior?.fases || []).flatMap((f) => f.tareas).map((t) => [t.codigo, t]));
  const r = {
    titulo: textoOpcional(datos.titulo, 'El título', 150),
    objetivo: textoOpcional(datos.objetivo, 'El objetivo', 3000),
    alcance: textoOpcional(datos.alcance, 'El alcance', 5000),
    fechaInicio: fechaOpcional(datos.fechaInicio, 'La fecha de inicio') ?? null,
    fechaFin: fechaOpcional(datos.fechaFin, 'La fecha de fin') ?? null,
  };
  if (r.fechaInicio && r.fechaFin && r.fechaFin < r.fechaInicio) throw badRequest('La fecha de fin no puede ser anterior a la de inicio.');
  r.documentos = (lista(datos.documentos, 'Documentos', 20) || []).map((d, i) => ({
    nombre: texto(d?.nombre, `Documento ${i + 1} (nombre)`, { max: 100 }), url: urlValida(d?.url, `Documento ${i + 1}`),
  }));
  r.metas = (lista(datos.metas, 'Metas', 10) || []).map((m, i) => ({
    codigo: typeof m?.codigo === 'string' && m.codigo ? m.codigo.slice(0, 20) : codigoNuevo('m'),
    nombre: texto(m?.nombre, `Meta ${i + 1}`, { max: 120 }),
    unidad: textoOpcional(m?.unidad, `Meta ${i + 1} (unidad)`, 20),
    valorInicial: numero(m?.valorInicial, `Meta ${i + 1} (valor inicial)`),
    valorObjetivo: numero(m?.valorObjetivo, `Meta ${i + 1} (objetivo)`),
    valorActual: numero(m?.valorActual, `Meta ${i + 1} (valor actual)`),
  }));
  const usados = new Set();
  r.fases = (lista(datos.fases, 'Fases', 12) || []).map((f, i) => ({
    codigo: typeof f?.codigo === 'string' && f.codigo ? f.codigo.slice(0, 20) : codigoNuevo('f'),
    nombre: texto(f?.nombre, `Fase ${i + 1}`, { max: 120 }),
    fechaInicio: fechaOpcional(f?.fechaInicio, `Fase ${i + 1} (inicio)`) ?? null,
    fechaFin: fechaOpcional(f?.fechaFin, `Fase ${i + 1} (fin)`) ?? null,
    tareas: (lista(f?.tareas, `Fase ${i + 1} (tareas)`, 50) || []).map((t, j) => {
      const campo = `Fase ${i + 1}, tarea ${j + 1}`;
      let codigo = typeof t?.codigo === 'string' && t.codigo ? t.codigo.slice(0, 20) : codigoNuevo('t');
      if (usados.has(codigo)) codigo = codigoNuevo('t');
      usados.add(codigo);
      const responsable = t?.responsable ?? 'consultor';
      if (!RESPONSABLES_PLAN.includes(responsable)) throw badRequest(`${campo}: el responsable es "consultor" o "cliente".`);
      const estado = t?.estado ?? 'pendiente';
      if (!ESTADOS_TAREA_PLAN.includes(estado)) throw badRequest(`${campo}: estado inválido.`);
      const previa = tareasPrevias.get(codigo);
      return {
        codigo, titulo: texto(t?.titulo, campo, { max: 200 }), responsable, estado,
        fechaVencimiento: fechaOpcional(t?.fechaVencimiento, `${campo} (vencimiento)`) ?? null,
        completadaEn: estado === 'completada' ? (previa?.completadaEn || new Date()) : null,
      };
    }),
  }));
  return r;
}

export async function guardarPlan(ctx, datos = {}) {
  soloConsultor(ctx);
  const actual = await ctx.db.planes.findOne({});
  if (actual?.estado === 'finalizado') throw conflicto('El plan está finalizado. Reabrilo para editarlo.');
  const limpio = limpiarPlan(datos, actual);
  return actual ? ctx.db.planes.update(actual._id, limpio) : ctx.db.planes.create({ ...limpio, estado: 'borrador' });
}

/** Iniciar, pausar, reanudar, finalizar o reabrir. Al iniciar y al finalizar se guarda la foto de métricas del CRM. */
export async function cambiarEstado(ctx, { accion, conclusiones } = {}) {
  soloConsultor(ctx);
  const plan = await ctx.db.planes.findOne({});
  if (!plan) throw noEncontrado('Todavía no hay un plan cargado para este cliente.');
  const transiciones = { iniciar: ['borrador', 'en_curso'], pausar: ['en_curso', 'pausado'], reanudar: ['pausado', 'en_curso'], finalizar: [null, 'finalizado'], reabrir: ['finalizado', 'en_curso'] };
  const t = transiciones[accion];
  if (!t) throw badRequest('Acción inválida.');
  if (t[0] && plan.estado !== t[0]) throw conflicto(`No se puede ${accion} un plan en estado "${plan.estado}".`);
  if (accion === 'finalizar' && !['en_curso', 'pausado'].includes(plan.estado)) throw conflicto('Solo se finaliza un plan en curso o pausado.');
  const patch = { estado: t[1] };
  if (accion === 'iniciar') { patch.metricasInicio = await metricasCRM(ctx.db); patch.iniciadoEn = new Date(); }
  if (accion === 'finalizar') {
    patch.metricasCierre = await metricasCRM(ctx.db);
    patch.finalizadoEn = new Date();
    patch.conclusiones = textoOpcional(conclusiones, 'Las conclusiones', 5000);
  }
  if (accion === 'reabrir') { patch.metricasCierre = null; patch.finalizadoEn = null; }
  return ctx.db.planes.update(plan._id, patch);
}

/** Marca una tarea del plan. El consultor, cualquiera; el admin del cliente, solo las que son responsabilidad del cliente. */
export async function marcarTarea(ctx, codigo, { estado } = {}) {
  const plan = await ctx.db.planes.findOne({});
  if (!plan) throw noEncontrado('No hay plan.');
  if (plan.estado !== 'en_curso') throw conflicto('Solo se actualizan tareas de un plan en curso.');
  if (!ESTADOS_TAREA_PLAN.includes(estado)) throw badRequest('Estado inválido.');
  let encontrada = null;
  const fases = plan.fases.map((f) => ({ ...f, tareas: f.tareas.map((t) => {
    if (t.codigo !== codigo) return t;
    encontrada = t;
    return { ...t, estado, completadaEn: estado === 'completada' ? new Date() : null };
  }) }));
  if (!encontrada) throw noEncontrado('Tarea del plan no encontrada.');
  if (!ctx.usuario.esSuperadmin) {
    if (ctx.usuario.rol !== ROL.ADMIN || encontrada.responsable !== 'cliente') throw prohibido('Solo podés actualizar las tareas del plan que le tocan a tu organización.');
    if (estado === 'cancelada') throw prohibido('Solo el consultor cancela tareas del plan.');
  }
  return ctx.db.planes.update(plan._id, { fases });
}

// ---------- Bitácora (privada) ----------

export async function listarBitacora(ctx) {
  soloConsultor(ctx);
  return ctx.db.bitacora.list({}, { sort: { fecha: -1 }, limit: 500 });
}

export async function agregarBitacora(ctx, datos = {}) {
  soloConsultor(ctx);
  const tipo = datos.tipo ?? 'nota';
  if (!TIPOS_BITACORA.includes(tipo)) throw badRequest(`Tipo inválido. Opciones: ${TIPOS_BITACORA.join(', ')}.`);
  return ctx.db.bitacora.create({
    tipo, texto: texto(datos.texto, 'El texto', { max: 5000 }),
    fecha: fechaOpcional(datos.fecha, 'La fecha') || new Date(), autorId: ctx.usuario.id, autorNombre: ctx.usuario.nombre,
  });
}

export async function borrarBitacora(ctx, id) {
  soloConsultor(ctx);
  if (!await ctx.db.bitacora.remove(id)) throw noEncontrado('Entrada no encontrada.');
  return { ok: true };
}

// ---------- Panel "Mis clientes" ----------

export async function resumenClientes(ahora = new Date()) {
  const orgs = await db.plataforma.organizaciones.list({}, { sort: { nombre: 1 } });
  return Promise.all(orgs.map(async (o) => {
    const repos = db.org(String(o._id));
    const [metricas, plan] = await Promise.all([metricasCRM(repos, ahora), repos.planes.findOne({})]);
    return {
      _id: o._id, nombre: o.nombre, verticalCodigo: o.verticalCodigo, activa: o.activa, plan: o.plan,
      metricas, uso: semaforoUso(metricas.ultimaActividad, ahora),
      consultoria: plan ? { titulo: plan.titulo, fechaFin: plan.fechaFin, ...resumenPlan(plan, ahora) } : null,
    };
  }));
}
