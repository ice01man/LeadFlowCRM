// Empresas (clientes y prospectos) de una organización. Recibe siempre el contexto { db, usuario } del request.
import { normalizar, textoOpcional, coordenada, escaparRegex, CUIT, puedeEscribir, puedeAsignar, paginacion } from '../crm/comun.js';
import { badRequest, conflicto, noEncontrado, prohibido, texto } from '../utils/errores.js';

const indice = (e) => normalizar([e.razonSocial, e.cuit, e.municipio, e.localidad, e.segmento].join(' '));

async function segmentoValido(ctx, segmento) {
  if (!segmento) return '';
  const org = await ctx.organizacion();
  const lista = org.config?.categoriasNegocio || [];
  const hit = lista.find((c) => normalizar(c) === normalizar(segmento));
  if (!hit) throw badRequest(`El tipo de cliente "${segmento}" no está en la configuración. Opciones: ${lista.join(', ')}.`);
  return hit;
}

async function limpiar(ctx, datos, parcial = false) {
  const r = {};
  if (!parcial || datos.razonSocial !== undefined) r.razonSocial = texto(datos.razonSocial, 'La razón social', { max: 150 });
  if (datos.cuit !== undefined) {
    r.cuit = textoOpcional(datos.cuit, 'El CUIT', 13);
    if (r.cuit && !CUIT.test(r.cuit)) throw badRequest('CUIT inválido (formato 30-12345678-9).');
  }
  for (const [campo, nombre, max] of [['direccion', 'La dirección', 200], ['municipio', 'El municipio', 80], ['localidad', 'La localidad', 80], ['telefono', 'El teléfono', 40], ['sitioWeb', 'El sitio web', 200], ['notas', 'Las notas', 3000]]) {
    if (datos[campo] !== undefined) r[campo] = textoOpcional(datos[campo], nombre, max);
  }
  if (datos.segmento !== undefined) r.segmento = await segmentoValido(ctx, textoOpcional(datos.segmento, 'El tipo de cliente', 60));
  if (datos.lat !== undefined) r.lat = coordenada(datos.lat, 'Latitud', -90, 90);
  if (datos.lng !== undefined) r.lng = coordenada(datos.lng, 'Longitud', -180, 180);
  return r;
}

export async function listar(ctx, q = {}) {
  const filtro = { activa: q.archivadas === 'true' ? false : true };
  if (q.q) filtro.busqueda = { $regex: escaparRegex(normalizar(String(q.q)).slice(0, 80)) };
  if (q.segmento) filtro.segmento = String(q.segmento);
  if (q.municipio) filtro.municipio = String(q.municipio);
  const { pagina, porPagina, skip } = paginacion(q);
  const [total, items] = await Promise.all([
    ctx.db.empresas.count(filtro),
    ctx.db.empresas.list(filtro, { sort: { razonSocial: 1 }, skip, limit: porPagina }),
  ]);
  return { total, pagina, porPagina, items };
}

export async function obtener(ctx, id) {
  const e = await ctx.db.empresas.get(id);
  if (!e) throw noEncontrado('Empresa no encontrada.');
  return e;
}

/** Busca por razón social exacta (sin acentos ni mayúsculas). La usa la importación para no duplicar. */
export async function buscarPorNombre(ctx, razonSocial, localidad) {
  const n = normalizar(razonSocial);
  if (!n) return null;
  const candidatas = await ctx.db.empresas.list({ busqueda: { $regex: `^${escaparRegex(n)}` }, activa: true }, { limit: 50 });
  const mismas = candidatas.filter((e) => normalizar(e.razonSocial) === n);
  // Si se indica localidad, tiene que coincidir: el mismo nombre en otra localidad es otro comercio.
  if (localidad !== undefined) return mismas.find((e) => normalizar(e.localidad) === normalizar(localidad)) || null;
  return mismas[0] || null;
}

export async function crear(ctx, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const e = await limpiar(ctx, datos);
  if (e.cuit && await ctx.db.empresas.findOne({ cuit: e.cuit, activa: true })) throw conflicto('Ya existe una empresa con ese CUIT.');
  return ctx.db.empresas.create({ ...e, busqueda: indice(e), activa: true });
}

export async function actualizar(ctx, id, datos = {}) {
  if (!puedeEscribir(ctx.usuario)) throw prohibido();
  const actual = await obtener(ctx, id);
  const patch = await limpiar(ctx, datos, true);
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  if (patch.cuit && patch.cuit !== actual.cuit && await ctx.db.empresas.findOne({ cuit: patch.cuit, activa: true })) throw conflicto('Ya existe una empresa con ese CUIT.');
  const final = { ...actual, ...patch };
  const r = await ctx.db.empresas.update(id, { ...patch, busqueda: indice(final) });
  // Si cambió el nombre, se actualiza la copia en sus contactos (para listar y buscar).
  if (patch.razonSocial && patch.razonSocial !== actual.razonSocial) {
    for (const c of await ctx.db.contactos.list({ empresaId: id })) {
      await ctx.db.contactos.update(c._id, { empresaNombre: patch.razonSocial, busqueda: c.busqueda.replace(normalizar(actual.razonSocial), normalizar(patch.razonSocial)) });
    }
  }
  return r;
}

/** Archivar (no se borra: la historia comercial se conserva). */
export async function archivar(ctx, id) {
  if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor pueden archivar empresas.');
  await obtener(ctx, id);
  return ctx.db.empresas.update(id, { activa: false });
}
