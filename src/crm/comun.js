// Utilidades compartidas por los servicios del CRM.
import { ROL } from '../config/roles.js';
import { badRequest } from '../utils/errores.js';

/** Minúsculas y sin acentos: "Peñalolén Ñuñoa" → "penalolen nunoa". Permite buscar "gomez" y encontrar "Gómez". */
export const normalizar = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

export const soloDigitos = (t) => String(t ?? '').replace(/\D/g, '');

export const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const CUIT = /^\d{2}-?\d{8}-?\d$/;

/** Texto opcional: string recortado, o '' si no vino. Rechaza objetos ({ $ne: null } y similares). */
export function textoOpcional(v, campo, max = 200) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v !== 'string' && typeof v !== 'number') throw badRequest(`${campo}: formato inválido.`);
  const t = String(v).trim();
  if (t.length > max) throw badRequest(`${campo}: máximo ${max} caracteres.`);
  return t;
}

export function coordenada(v, campo, min, max) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw badRequest(`${campo} inválida.`);
  return n;
}

/** El vendedor solo ve y toca sus contactos asignados; el resto de los roles, toda la organización. */
export const alcanceContactos = (usuario) => (usuario.rol === ROL.VENDEDOR ? { owner: usuario.id } : {});

export const puedeEscribir = (usuario) => [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR].includes(usuario.rol);
export const puedeAsignar = (usuario) => [ROL.ADMIN, ROL.CONSULTOR].includes(usuario.rol);

/** Paginación segura: página desde 1, tamaño entre 1 y 100. */
export function paginacion(q = {}) {
  const pagina = Math.max(1, Math.floor(Number(q.pagina) || 1));
  const porPagina = Math.min(100, Math.max(1, Math.floor(Number(q.porPagina) || 25)));
  return { pagina, porPagina, skip: (pagina - 1) * porPagina };
}
