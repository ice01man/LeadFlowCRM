// Autenticación, roles y contexto de organización.
// Después de authRequired, cada request tiene:
//   req.usuario = { id, rol, organizacionId, nombre, email, esSuperadmin }
//   req.db      = db.org(organizacionId)  → repos atados a SU organización (null para el superadmin sin cliente elegido)
//
// El superadmin (el consultor dueño de la plataforma) puede "entrar" a una organización cliente eligiéndola
// en el selector (cookie lf_org, o encabezado X-Organizacion para integraciones). Adentro opera con permisos
// de administrador. Ese acceso es de la plataforma: los usuarios del cliente no pueden quitarlo.
import { db } from '../store/index.js';
import { verificarToken } from '../services/auth.js';
import { ROL } from '../config/roles.js';
import { noAutorizado, prohibido } from '../utils/errores.js';

export const COOKIE = 'lf_sesion';
export const COOKIE_ORG = 'lf_org';

const leerCookie = (req, nombre) => {
  const c = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(`${nombre}=`));
  return c ? decodeURIComponent(c.slice(nombre.length + 1)) : null;
};

function leerToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  // Cookie de sesión (la usa el frontend para que las páginas privadas se puedan verificar antes de servirse).
  return leerCookie(req, COOKIE);
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

  req.usuario = { id: String(u._id), rol: u.rol, organizacionId, nombre: u.nombre, email: u.email, esSuperadmin: u.rol === ROL.SUPERADMIN };
  req.db = organizacionId ? db.org(organizacionId) : null;

  if (u.rol === ROL.SUPERADMIN) {
    const elegida = req.headers['x-organizacion'] || leerCookie(req, COOKIE_ORG);
    if (elegida && typeof elegida === 'string') {
      const org = await db.plataforma.organizaciones.get(elegida);
      if (org) { // si la organización ya no existe, se sigue como plataforma
        req.usuario = { ...req.usuario, rol: ROL.ADMIN, organizacionId: String(org._id) };
        req.db = db.org(String(org._id));
      }
    }
  }
  next();
}

export const requireRol = (...roles) => (req, _res, next) => {
  if (!req.usuario) throw noAutorizado();
  // El superadmin conserva sus permisos de plataforma aunque esté trabajando dentro de un cliente.
  if (roles.includes(req.usuario.rol) || (req.usuario.esSuperadmin && roles.includes(ROL.SUPERADMIN))) return next();
  throw prohibido();
};

/** Solo el superadmin (con o sin cliente elegido). */
export function requireSuperadmin(req, _res, next) {
  if (!req.usuario?.esSuperadmin) throw prohibido();
  next();
}

/** Para endpoints de negocio: exige que el usuario pertenezca a una organización. */
export function requireOrganizacion(req, _res, next) {
  if (!req.db) throw prohibido('Esta acción es para usuarios de una organización.');
  next();
}
