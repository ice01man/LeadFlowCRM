// Autenticación, roles y contexto de organización.
// Después de authRequired, cada request tiene:
//   req.usuario = { id, rol, organizacionId, nombre, email }
//   req.db      = db.org(organizacionId)  → repos atados a SU organización (null para el superadmin)
import { db } from '../store/index.js';
import { verificarToken } from '../services/auth.js';
import { ROL } from '../config/roles.js';
import { noAutorizado, prohibido } from '../utils/errores.js';

export const COOKIE = 'lf_sesion';

function leerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  // Cookie de sesión (la usa el frontend para que las páginas privadas se puedan verificar antes de servirse).
  const cookie = (req.headers.cookie || '').split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(COOKIE.length + 1)) : null;
}

export async function authRequired(req, _res, next) {
  const token = leerToken(req);
  if (!token) throw noAutorizado();
  let payload;
  try { payload = verificarToken(token); } catch { throw noAutorizado('Sesión inválida o vencida.'); }

  const u = await db.plataforma.usuarios.get(payload.id);
  if (!u || u.activo === false) throw noAutorizado('La cuenta no existe o está desactivada.');
  const organizacionId = u.organizacionId ? String(u.organizacionId) : null;
  // Si el token dice otra organización que la actual del usuario, se descarta.
  if ((payload.org || null) !== organizacionId) throw noAutorizado('Sesión inválida. Volvé a ingresar.');

  if (organizacionId) {
    const org = await db.plataforma.organizaciones.get(organizacionId);
    if (!org || org.activa === false) throw noAutorizado('La organización está suspendida.');
  } else if (u.rol !== ROL.SUPERADMIN) {
    throw noAutorizado('La cuenta no tiene organización asignada.');
  }

  req.usuario = { id: String(u._id), rol: u.rol, organizacionId, nombre: u.nombre, email: u.email };
  req.db = organizacionId ? db.org(organizacionId) : null;
  next();
}

export const requireRol = (...roles) => (req, _res, next) => {
  if (!req.usuario) throw noAutorizado();
  if (!roles.includes(req.usuario.rol)) throw prohibido();
  next();
};

/** Para endpoints de negocio: exige que el usuario pertenezca a una organización. */
export function requireOrganizacion(req, _res, next) {
  if (!req.db) throw prohibido('Esta acción es para usuarios de una organización.');
  next();
}
