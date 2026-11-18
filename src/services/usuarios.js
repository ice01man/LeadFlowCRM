// Usuarios de una organización. Recibe siempre el repo YA atado a la organización (db.org(id).usuarios),
// así que no puede ver ni modificar usuarios de otra.
import bcrypt from 'bcryptjs';
import { db } from '../store/index.js';
import { ROLES_ORGANIZACION } from '../config/roles.js';
import { badRequest, conflicto, noEncontrado, texto, esEmail } from '../utils/errores.js';

export const hashear = (password) => bcrypt.hash(password, 10);

export function validarPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw badRequest('La contraseña debe tener al menos 8 caracteres.');
  if (password.length > 128) throw badRequest('La contraseña es demasiado larga.');
  return password;
}

function validarEmail(email) {
  if (!esEmail(email)) throw badRequest('Email inválido.');
  return email.trim().toLowerCase();
}

function validarRol(rol) {
  if (!ROLES_ORGANIZACION.includes(rol)) throw badRequest(`Rol inválido. Opciones: ${ROLES_ORGANIZACION.join(', ')}.`);
  return rol;
}

/** Lo que se devuelve por la API: nunca el hash. */
export function publico(u) {
  if (!u) return null;
  const { passwordHash, ...resto } = u;
  return resto;
}

async function emailLibre(email) {
  // El email es único en TODA la plataforma (el login no sabe de antemano la organización).
  if (await db.plataforma.usuarios.findOne({ email })) throw conflicto('Ya existe un usuario con ese email.');
}

export async function listar(repo) {
  return (await repo.list({}, { sort: { nombre: 1 } })).map(publico);
}

export async function crear(repo, datos = {}) {
  const nombre = texto(datos.nombre, 'El nombre', { max: 120 });
  const email = validarEmail(datos.email);
  const rol = validarRol(datos.rol);
  const password = validarPassword(datos.password);
  const telefono = texto(datos.telefono, 'El teléfono', { max: 30, requerido: false });
  await emailLibre(email);
  return publico(await repo.create({ nombre, email, rol, telefono, passwordHash: await hashear(password), activo: true }));
}

export async function actualizar(repo, id, datos = {}, { actorId } = {}) {
  const actual = await repo.get(id);
  if (!actual) throw noEncontrado('Usuario no encontrado.');
  const patch = {};
  if (datos.nombre !== undefined) patch.nombre = texto(datos.nombre, 'El nombre', { max: 120 });
  if (datos.telefono !== undefined) patch.telefono = texto(datos.telefono, 'El teléfono', { max: 30, requerido: false });
  if (datos.rol !== undefined) patch.rol = validarRol(datos.rol);
  if (datos.activo !== undefined) {
    if (typeof datos.activo !== 'boolean') throw badRequest('activo debe ser true o false.');
    patch.activo = datos.activo;
  }
  if (datos.password !== undefined) patch.passwordHash = await hashear(validarPassword(datos.password));
  if (datos.email !== undefined) {
    const email = validarEmail(datos.email);
    if (email !== actual.email) await emailLibre(email);
    patch.email = email;
  }
  // Un admin no puede quitarse a sí mismo el rol ni desactivarse: dejaría la organización sin administración.
  if (String(id) === String(actorId) && (patch.activo === false || (patch.rol && patch.rol !== actual.rol))) {
    throw badRequest('No podés cambiar tu propio rol ni desactivarte.');
  }
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  return publico(await repo.update(id, patch));
}
