// Alta y gestión de organizaciones (solo superadmin). Crear una organización crea también su primer admin.
import { db } from '../store/index.js';
import { PLANES } from '../models/Organizacion.js';
import { ROL } from '../config/roles.js';
import * as usuarios from './usuarios.js';
import * as verticales from './verticales.js';
import { aplicarCambios, extraerConfig } from '../verticales/validacion.js';
import { badRequest, conflicto, noEncontrado, texto } from '../utils/errores.js';

const CUIT = /^\d{2}-?\d{8}-?\d$/;

function validarCuit(cuit) {
  const v = texto(cuit, 'El CUIT', { max: 13, requerido: false });
  if (v && !CUIT.test(v)) throw badRequest('CUIT inválido (formato 20-12345678-3).');
  return v;
}

// En los listados no viaja la configuración completa (es grande y no hace falta).
const resumen = ({ config, ...org }) => org;

export const listar = async () => (await db.plataforma.organizaciones.list({}, { sort: { nombre: 1 } })).map(resumen);

export async function obtener(id) {
  const org = await db.plataforma.organizaciones.get(id);
  if (!org) throw noEncontrado('Organización no encontrada.');
  return org;
}

/** Crea la organización y su usuario admin. Si el admin falla, la organización se borra (sin transacción). */
export async function crear(datos = {}) {
  const nombre = texto(datos.nombre, 'El nombre de la organización', { max: 120 });
  const cuit = validarCuit(datos.cuit);
  const plan = datos.plan ?? 'prueba';
  if (!PLANES.includes(plan)) throw badRequest(`Plan inválido. Opciones: ${PLANES.join(', ')}.`);
  if (!datos.admin || typeof datos.admin !== 'object') throw badRequest('Faltan los datos del admin de la organización.');
  if (!datos.verticalCodigo) throw badRequest('Elegí el vertical (rubro) de la organización.');
  const vertical = await verticales.obtener(datos.verticalCodigo);
  if (!vertical.activo) throw badRequest('Ese vertical está desactivado.');

  if (await db.plataforma.organizaciones.findOne({ nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) {
    throw conflicto('Ya existe una organización con ese nombre.');
  }
  const org = await db.plataforma.organizaciones.create({ nombre, cuit, plan, verticalCodigo: vertical.codigo, config: extraerConfig(vertical), llmActivo: true, activa: true });
  try {
    const admin = await usuarios.crear(db.org(org._id).usuarios, { ...datos.admin, rol: ROL.ADMIN });
    return { organizacion: org, admin };
  } catch (e) {
    await db.plataforma.organizaciones.remove(org._id);
    throw e;
  }
}

export async function actualizar(id, datos = {}) {
  await obtener(id);
  if (datos.verticalCodigo !== undefined || datos.config !== undefined) {
    throw badRequest('El vertical y la configuración no se cambian desde acá: la organización ajusta su configuración, o se restaura desde la plantilla.');
  }
  const patch = {};
  if (datos.nombre !== undefined) patch.nombre = texto(datos.nombre, 'El nombre de la organización', { max: 120 });
  if (datos.cuit !== undefined) patch.cuit = validarCuit(datos.cuit);
  if (datos.plan !== undefined) {
    if (!PLANES.includes(datos.plan)) throw badRequest(`Plan inválido. Opciones: ${PLANES.join(', ')}.`);
    patch.plan = datos.plan;
  }
  for (const campo of ['activa', 'llmActivo']) {
    if (datos[campo] === undefined) continue;
    if (typeof datos[campo] !== 'boolean') throw badRequest(`${campo} debe ser true o false.`);
    patch[campo] = datos[campo];
  }
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  return resumen(await db.plataforma.organizaciones.update(id, patch));
}

// ---- Configuración comercial de la PROPIA organización (admin y consultor) ----

export async function obtenerConfig(organizacionId) {
  const org = await obtener(organizacionId);
  return { verticalCodigo: org.verticalCodigo, config: org.config || null };
}

export async function actualizarConfig(organizacionId, cambios) {
  const org = await obtener(organizacionId);
  if (!org.config) throw badRequest('La organización no tiene configuración. Restaurala desde la plantilla de su vertical.');
  const config = aplicarCambios(org.config, cambios);
  const r = await db.plataforma.organizaciones.update(org._id, { config });
  return { verticalCodigo: r.verticalCodigo, config: r.config };
}

/** Vuelve a copiar la configuración desde la plantilla del vertical (descarta los ajustes propios). */
export async function restaurarConfig(organizacionId, verticalCodigo) {
  const org = await obtener(organizacionId);
  const vertical = await verticales.obtener(verticalCodigo || org.verticalCodigo);
  if (!vertical.activo) throw badRequest('Ese vertical está desactivado.');
  const r = await db.plataforma.organizaciones.update(org._id, { verticalCodigo: vertical.codigo, config: extraerConfig(vertical) });
  return { verticalCodigo: r.verticalCodigo, config: r.config };
}
