// Oportunidades (ventas en curso) y vista del pipeline. Las etapas salen de la configuración de la organización.
import { ROL } from '../config/roles.js';
import * as contactos from './contactos.js';
import { textoOpcional, fechaOpcional, numeroOpcional, idOpcional, puedeEscribir, puedeAsignar, paginacion } from '../crm/comun.js';
import { badRequest, noEncontrado, prohibido, texto } from '../utils/errores.js';

const ROLES_OWNER = [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR];
const nombreCompleto = (c) => [c.nombre, c.apellido].filter(Boolean).join(' ');
const alcance = (u) => (u.rol === ROL.VENDEDOR ? { owner: u.id } : {});

async function etapas(ctx) {
  const lista = (await ctx.organizacion()).config?.etapasPipeline || [];
  if (!lista.length) throw badRequest('La organización no tiene etapas de pipeline configuradas.');
  return lista;
}

async function ownerValido(ctx, owner) {
  if (!owner) return null;
  if (typeof owner !== 'string') throw badRequest('Vendedor inválido.');
  if (ctx.usuario.esSuperadmin && owner === ctx.usuario.id) return owner; // el consultor se asigna a sí mismo
  const u = await ctx.db.usuarios.get(owner);
  if (!u || u.activo === false || !ROLES_OWNER.includes(u.rol)) throw badRequest('El vendedor no existe en tu organización.');
  return String(u._id);
}

async function obtenerInterna(ctx, id) {
  const o = await ctx.db.oportunidades.get(id);
  if (!o || (ctx.usuario.rol === ROL.VENDEDOR && String(o.owner) !== ctx.usuario.id)) throw noEncontrado('Oportunidad no encontrada.');
  return o;
}
export const obtener = obtenerInterna;

export async function listar(ctx, q = {}) {
  const filtro = { ...alcance(ctx.usuario) };
  if (q.contactoId) filtro.contactoId = String(q.contactoId);
  if (q.estado) filtro.estado = String(q.estado);
  if (q.owner && ctx.usuario.rol !== ROL.VENDEDOR) filtro.owner = String(q.owner);
  const { pagina, porPagina, skip } = paginacion(q);
  const [total, items] = await Promise.all([ctx.db.oportunidades.count(filtro), ctx.db.oportunidades.list(filtro, { sort: { updatedAt: -1 }, skip, limit: porPagina })]);
  return { total, pagina, porPagina, items };
}

/** Tablero: oportunidades abiertas agrupadas por etapa, con totales. Las de una etapa que ya no existe van a "Sin etapa". */
export async function pipeline(ctx, q = {}) {
  const lista = await etapas(ctx);
  const filtro = { estado: 'abierta', ...alcance(ctx.usuario) };
  if (q.owner && ctx.usuario.rol !== ROL.VENDEDOR) filtro.owner = String(q.owner);
  const abiertas = await ctx.db.oportunidades.list(filtro, { sort: { updatedAt: -1 }, limit: 2000 });
  const columnas = lista.map((e) => ({ ...e, items: [] }));
  const huerfanas = { codigo: '_sin_etapa', nombre: 'Sin etapa', probabilidad: 0, items: [] };
  for (const o of abiertas) (columnas.find((c) => c.codigo === o.etapa) || huerfanas).items.push(o);
  if (huerfanas.items.length) columnas.unshift(huerfanas);
  for (const c of columnas) {
    c.cantidad = c.items.length;
    c.total = c.items.reduce((a, o) => a + (o.valorEstimado || 0), 0);
    c.ponderado = Math.round(c.items.reduce((a, o) => a + (o.valorEstimado || 0) * (o.probabilidad || 0) / 100, 0));
  }
  return {
    columnas,
    totales: { cantidad: abiertas.length, total: columnas.reduce((a, c) => a + c.total, 0), ponderado: columnas.reduce((a, c) => a + c.ponderado, 0) },
  };
}

export async function crear(ctx, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const contactoId = idOpcional(datos.contactoId, 'Contacto');
  if (!contactoId) throw badRequest('Elegí el contacto de la oportunidad.');
  const contacto = await contactos.obtener(ctx, contactoId); // valida que exista y que el vendedor tenga acceso
  const lista = await etapas(ctx);
  const etapa = datos.etapa ? lista.find((e) => e.codigo === datos.etapa) : lista[0];
  if (!etapa) throw badRequest('Etapa inválida.');
  let owner = contacto.owner ? String(contacto.owner) : null;
  if (ctx.usuario.rol === ROL.VENDEDOR) owner = ctx.usuario.id;
  else if (datos.owner !== undefined) owner = await ownerValido(ctx, datos.owner);
  const o = await ctx.db.oportunidades.create({
    contactoId, contactoNombre: nombreCompleto(contacto), empresaId: contacto.empresaId || null, empresaNombre: contacto.empresaNombre || '',
    owner, titulo: texto(datos.titulo, 'El título', { max: 120 }), etapa: etapa.codigo,
    valorEstimado: numeroOpcional(datos.valorEstimado, 'El valor estimado', 0, 1e12) ?? 0,
    probabilidad: datos.probabilidad !== undefined ? numeroOpcional(datos.probabilidad, 'La probabilidad', 0, 100) : etapa.probabilidad,
    fechaCierreEsperada: fechaOpcional(datos.fechaCierreEsperada, 'La fecha de cierre') ?? null,
    notas: textoOpcional(datos.notas, 'Las notas', 3000), estado: 'abierta',
    historialEtapas: [{ etapa: etapa.codigo, fecha: new Date(), usuarioId: ctx.usuario.id }],
  });
  // Un lead con oportunidad abierta pasa a la etapa "oportunidad" del ciclo de vida.
  if (['lead', 'calificado'].includes(contacto.lifecycleStage)) await ctx.db.contactos.update(contactoId, { lifecycleStage: 'oportunidad' });
  return o;
}

export async function actualizar(ctx, id, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const o = await obtenerInterna(ctx, id);
  const patch = {};
  if (datos.titulo !== undefined) patch.titulo = texto(datos.titulo, 'El título', { max: 120 });
  if (datos.valorEstimado !== undefined) patch.valorEstimado = numeroOpcional(datos.valorEstimado, 'El valor estimado', 0, 1e12);
  if (datos.probabilidad !== undefined) patch.probabilidad = numeroOpcional(datos.probabilidad, 'La probabilidad', 0, 100);
  if (datos.fechaCierreEsperada !== undefined) patch.fechaCierreEsperada = fechaOpcional(datos.fechaCierreEsperada, 'La fecha de cierre');
  if (datos.notas !== undefined) patch.notas = textoOpcional(datos.notas, 'Las notas', 3000);
  if (datos.owner !== undefined) {
    if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor reasignan oportunidades.');
    patch.owner = await ownerValido(ctx, datos.owner);
  }
  if (datos.etapa !== undefined || datos.estado !== undefined) throw badRequest('Para cambiar de etapa o cerrar la oportunidad usá las acciones del tablero.');
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  return ctx.db.oportunidades.update(o._id, patch);
}

/** Mueve la oportunidad a otra etapa (arrastrar en el tablero). La probabilidad pasa a la de la etapa nueva. */
export async function moverEtapa(ctx, id, { etapa } = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const o = await obtenerInterna(ctx, id);
  if (o.estado !== 'abierta') throw badRequest('La oportunidad ya está cerrada. Reabrila para moverla.');
  const destino = (await etapas(ctx)).find((e) => e.codigo === etapa);
  if (!destino) throw badRequest('Etapa inválida.');
  if (destino.codigo === o.etapa) return o;
  return ctx.db.oportunidades.update(o._id, {
    etapa: destino.codigo, probabilidad: destino.probabilidad,
    historialEtapas: [...(o.historialEtapas || []), { etapa: destino.codigo, fecha: new Date(), usuarioId: ctx.usuario.id }],
  });
}

/** Cierra como ganada o perdida. Ganada: el contacto pasa a cliente. Perdida: hay que decir el motivo. */
export async function cerrar(ctx, id, { resultado, motivo } = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const o = await obtenerInterna(ctx, id);
  if (o.estado !== 'abierta') throw badRequest('La oportunidad ya está cerrada.');
  if (!['ganada', 'perdida'].includes(resultado)) throw badRequest('El resultado tiene que ser "ganada" o "perdida".');
  const patch = { estado: resultado, fechaCierre: new Date(), probabilidad: resultado === 'ganada' ? 100 : 0, historialEtapas: [...(o.historialEtapas || []), { etapa: `_${resultado}`, fecha: new Date(), usuarioId: ctx.usuario.id }] };
  if (resultado === 'perdida') patch.motivoPerdida = texto(motivo, 'El motivo de la pérdida', { max: 300 });
  const r = await ctx.db.oportunidades.update(o._id, patch);
  if (resultado === 'ganada') {
    const c = await ctx.db.contactos.get(o.contactoId);
    if (c && !['cliente', 'fidelizado'].includes(c.lifecycleStage)) await ctx.db.contactos.update(c._id, { lifecycleStage: 'cliente' });
  }
  return r;
}

/** Reabre una oportunidad cerrada por error (vuelve a la última etapa real). Solo admin o consultor. */
export async function reabrir(ctx, id) {
  if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor reabren oportunidades.');
  const o = await obtenerInterna(ctx, id);
  if (o.estado === 'abierta') throw badRequest('La oportunidad ya está abierta.');
  const lista = await etapas(ctx);
  const ultima = [...(o.historialEtapas || [])].reverse().find((h) => !h.etapa.startsWith('_'))?.etapa;
  const etapa = lista.find((e) => e.codigo === ultima) || lista[0];
  return ctx.db.oportunidades.update(o._id, {
    estado: 'abierta', fechaCierre: null, motivoPerdida: '', etapa: etapa.codigo, probabilidad: etapa.probabilidad,
    historialEtapas: [...(o.historialEtapas || []), { etapa: etapa.codigo, fecha: new Date(), usuarioId: ctx.usuario.id }],
  });
}
