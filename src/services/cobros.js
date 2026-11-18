// Hitos de cobro de la consultoría (privados del consultor).
// Situación calculada de cada hito:
//   cobrado / cancelado  → lo que dice el estado
//   facturado            → facturado (vencido si pasó la fecha estimada)
//   pendiente            → "listo" si se cumplió el disparador (fase completa, fecha alcanzada o marcado a mano);
//                          si no, "pendiente". En ambos casos, vencido si pasó la fecha estimada.
import { MONEDAS, ESTADOS_COBRO, DISPARADORES } from '../models/Cobro.js';
import { textoOpcional, fechaOpcional } from '../crm/comun.js';
import { badRequest, noEncontrado, prohibido, texto } from '../utils/errores.js';

const soloConsultor = (ctx) => { if (!ctx.usuario.esSuperadmin) throw prohibido('Solo el consultor ve y gestiona los cobros.'); };
const diaAR = (d) => new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10);

/** Una fase está completa si tiene al menos una tarea vigente y todas las vigentes están completadas. */
export function faseCompleta(plan, codigo) {
  const f = plan?.fases?.find((x) => x.codigo === codigo);
  const vigentes = (f?.tareas || []).filter((t) => t.estado !== 'cancelada');
  return vigentes.length > 0 && vigentes.every((t) => t.estado === 'completada');
}

export function situacion(cobro, plan, ahora = new Date()) {
  const hoy = diaAR(ahora);
  if (['cobrado', 'cancelado'].includes(cobro.estado)) return { situacion: cobro.estado, vencido: false };
  const vencido = !!cobro.fechaEstimada && diaAR(cobro.fechaEstimada) < hoy;
  if (cobro.estado === 'facturado') return { situacion: 'facturado', vencido };
  const listo = (cobro.disparador === 'fase' && faseCompleta(plan, cobro.faseCodigo))
    || (cobro.disparador === 'fecha' && !!cobro.fechaEstimada && diaAR(cobro.fechaEstimada) <= hoy)
    || (cobro.disparador === 'manual' && cobro.listoManual);
  return { situacion: listo ? 'listo' : 'pendiente', vencido };
}

/** Totales por moneda (nunca se mezclan monedas). */
export function totales(cobros) {
  const r = {};
  for (const c of cobros) {
    if (c.situacion === 'cancelado') continue;
    const t = (r[c.moneda] ||= { total: 0, cobrado: 0, porCobrar: 0, listo: 0, facturado: 0, vencido: 0 });
    t.total += c.monto;
    if (c.situacion === 'cobrado') { t.cobrado += c.monto; continue; }
    t.porCobrar += c.monto;
    if (c.situacion === 'listo') t.listo += c.monto;
    if (c.situacion === 'facturado') t.facturado += c.monto;
    if (c.vencido) t.vencido += c.monto;
  }
  return r;
}

/** Lista con la situación calculada, el nombre de la fase y los totales. Sirve para la pantalla y para el panel. */
export async function resumen(repos, plan, ahora = new Date()) {
  const lista = await repos.cobros.list({}, { sort: { fechaEstimada: 1, createdAt: 1 } });
  const nombreFase = new Map((plan?.fases || []).map((f) => [f.codigo, f.nombre]));
  const items = lista.map((c) => ({ ...c, ...situacion(c, plan, ahora), faseNombre: nombreFase.get(c.faseCodigo) || '' }));
  const abiertos = items.filter((c) => !['cobrado', 'cancelado'].includes(c.situacion));
  const proximo = abiertos.filter((c) => c.fechaEstimada).sort((a, b) => new Date(a.fechaEstimada) - new Date(b.fechaEstimada))[0] || null;
  return { items, totales: totales(items), proximo: proximo && { concepto: proximo.concepto, monto: proximo.monto, moneda: proximo.moneda, fechaEstimada: proximo.fechaEstimada, situacion: proximo.situacion, vencido: proximo.vencido } };
}

function urlOpcional(v) {
  const t = textoOpcional(v, 'El link del comprobante', 500);
  if (!t) return '';
  let u;
  try { u = new URL(t); } catch { throw badRequest('El link del comprobante no es válido.'); }
  if (!['https:', 'http:'].includes(u.protocol)) throw badRequest('El link del comprobante tiene que empezar con https://');
  return u.toString();
}

async function limpiar(ctx, datos, parcial) {
  const r = {};
  if (!parcial || datos.concepto !== undefined) r.concepto = texto(datos.concepto, 'El concepto', { max: 150 });
  if (!parcial || datos.monto !== undefined) {
    const n = Number(datos.monto);
    if (!Number.isFinite(n) || n <= 0 || n > 1e12) throw badRequest('El monto tiene que ser un número mayor que cero.');
    r.monto = Math.round(n * 100) / 100;
  }
  if (!parcial || datos.moneda !== undefined) {
    const m = datos.moneda ?? 'ARS';
    if (!MONEDAS.includes(m)) throw badRequest(`Moneda inválida. Opciones: ${MONEDAS.join(', ')}.`);
    r.moneda = m;
  }
  if (!parcial || datos.disparador !== undefined) {
    const d = datos.disparador ?? 'manual';
    if (!DISPARADORES.includes(d)) throw badRequest('Disparador inválido: fase, fecha o manual.');
    r.disparador = d;
  }
  if (datos.fechaEstimada !== undefined) r.fechaEstimada = fechaOpcional(datos.fechaEstimada, 'La fecha estimada');
  if (datos.faseCodigo !== undefined) r.faseCodigo = textoOpcional(datos.faseCodigo, 'La fase', 20);
  if (datos.notas !== undefined) r.notas = textoOpcional(datos.notas, 'Las notas', 1000);
  if (datos.comprobanteUrl !== undefined) r.comprobanteUrl = urlOpcional(datos.comprobanteUrl);
  if (datos.listoManual !== undefined) {
    if (typeof datos.listoManual !== 'boolean') throw badRequest('listoManual debe ser true o false.');
    r.listoManual = datos.listoManual;
  }
  return r;
}

async function validarDisparador(ctx, c) {
  if (c.disparador === 'fase') {
    const plan = await ctx.db.planes.findOne({});
    if (!c.faseCodigo || !plan?.fases?.some((f) => f.codigo === c.faseCodigo)) throw badRequest('Elegí una fase del plan para este cobro.');
  }
  if (c.disparador === 'fecha' && !c.fechaEstimada) throw badRequest('Un cobro por fecha necesita la fecha estimada.');
}

export async function listar(ctx) {
  soloConsultor(ctx);
  return resumen(ctx.db, await ctx.db.planes.findOne({}));
}

export async function crear(ctx, datos = {}) {
  soloConsultor(ctx);
  const c = { faseCodigo: '', fechaEstimada: null, notas: '', comprobanteUrl: '', listoManual: false, ...(await limpiar(ctx, datos, false)), estado: 'pendiente' };
  await validarDisparador(ctx, c);
  return ctx.db.cobros.create(c);
}

export async function actualizar(ctx, id, datos = {}) {
  soloConsultor(ctx);
  const actual = await ctx.db.cobros.get(id);
  if (!actual) throw noEncontrado('Cobro no encontrado.');
  const patch = await limpiar(ctx, datos, true);
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  await validarDisparador(ctx, { ...actual, ...patch });
  return ctx.db.cobros.update(id, patch);
}

/** Facturado / cobrado / cancelado / pendiente (para deshacer). Guarda la fecha real (hoy si no se indica). */
export async function cambiarEstado(ctx, id, { estado, fecha, comprobanteUrl } = {}) {
  soloConsultor(ctx);
  const actual = await ctx.db.cobros.get(id);
  if (!actual) throw noEncontrado('Cobro no encontrado.');
  if (!ESTADOS_COBRO.includes(estado)) throw badRequest(`Estado inválido. Opciones: ${ESTADOS_COBRO.join(', ')}.`);
  const cuando = fechaOpcional(fecha, 'La fecha') || new Date();
  const patch = { estado };
  if (estado === 'facturado') patch.fechaFacturado = cuando;
  if (estado === 'cobrado') { patch.fechaCobro = cuando; if (!actual.fechaFacturado) patch.fechaFacturado = cuando; }
  if (estado === 'pendiente') { patch.fechaFacturado = null; patch.fechaCobro = null; }
  if (comprobanteUrl !== undefined) patch.comprobanteUrl = urlOpcional(comprobanteUrl);
  return ctx.db.cobros.update(id, patch);
}

export async function borrar(ctx, id) {
  soloConsultor(ctx);
  const actual = await ctx.db.cobros.get(id);
  if (!actual) throw noEncontrado('Cobro no encontrado.');
  if (actual.estado === 'cobrado') throw badRequest('Un cobro ya cobrado no se borra: si fue un error, pasalo a pendiente primero.');
  await ctx.db.cobros.remove(id);
  return { ok: true };
}
