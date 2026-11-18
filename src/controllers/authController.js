import * as auth from '../services/auth.js';
import { db } from '../store/index.js';
import { publico } from '../services/usuarios.js';
import { COOKIE, COOKIE_ORG } from '../middleware/auth.js';
import { PRODUCCION } from '../config/env.js';

const opcionesCookie = { httpOnly: true, sameSite: 'strict', secure: PRODUCCION, path: '/', maxAge: 8 * 60 * 60 * 1000 };

export async function login(req, res) {
  const { email, password } = req.body || {};
  const r = await auth.login(email, password);
  res.cookie(COOKIE, r.token, opcionesCookie);
  res.json(r);
}

export function logout(_req, res) {
  res.clearCookie(COOKIE, { ...opcionesCookie, maxAge: undefined });
  res.clearCookie(COOKIE_ORG, { ...opcionesCookie, maxAge: undefined });
  res.json({ ok: true });
}

export async function me(req, res) {
  const u = await db.plataforma.usuarios.get(req.usuario.id);
  const org = req.usuario.organizacionId ? await db.plataforma.organizaciones.get(req.usuario.organizacionId) : null;
  const organizacion = org ? (({ config, ...resto }) => resto)(org) : null;
  // rol = el efectivo en este momento (el superadmin dentro de un cliente opera como admin).
  res.json({ usuario: { ...publico(u), rol: req.usuario.rol }, organizacion, esSuperadmin: req.usuario.esSuperadmin });
}

/** El superadmin elige en qué cliente trabajar (o vuelve a la plataforma con organizacionId vacío). */
export async function elegirOrganizacion(req, res) {
  const id = req.body?.organizacionId;
  if (!id) {
    res.clearCookie(COOKIE_ORG, { ...opcionesCookie, maxAge: undefined });
    return res.json({ organizacion: null });
  }
  const org = typeof id === 'string' ? await db.plataforma.organizaciones.get(id) : null;
  if (!org) return res.status(404).json({ error: 'Organización no encontrada.' });
  res.cookie(COOKIE_ORG, String(org._id), opcionesCookie);
  res.json({ organizacion: { _id: org._id, nombre: org.nombre } });
}
