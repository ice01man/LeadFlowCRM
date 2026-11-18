// Alta y gestión de organizaciones (solo superadmin). Crear una organización crea también su primer admin.
import { db } from '../store/index.js';
import { PLANES } from '../models/Organizacion.js';
import { ROL } from '../config/roles.js';
import * as usuarios from './usuarios.js';
import { badRequest, conflicto, noEncontrado, texto } from '../utils/errores.js';

const CUIT = /^\d{2}-?\d{8}-?\d$/;

function validarCuit(cuit) {
  const v = texto(cuit, 'El CUIT', { max: 13, requerido: false });
  if (v && !CUIT.test(v)) throw badRequest('CUIT inválido (formato 20-12345678-3).');
  return v;
}

export const listar = () => db.plataforma.organizaciones.list({}, { sort: { nombre: 1 } });

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

  if (await db.plataforma.organizaciones.findOne({ nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) {
    throw conflicto('Ya existe una organización con ese nombre.');
  }
  const org = await db.plataforma.organizaciones.create({ nombre, cuit, plan, verticalCodigo: '', llmActivo: true, activa: true });
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
  return db.plataforma.organizaciones.update(id, patch);
}
