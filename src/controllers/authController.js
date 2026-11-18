import * as auth from '../services/auth.js';
import { db } from '../store/index.js';
import { publico } from '../services/usuarios.js';
import { COOKIE } from '../middleware/auth.js';
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
  res.json({ ok: true });
}

export async function me(req, res) {
  const u = await db.plataforma.usuarios.get(req.usuario.id);
  const organizacion = req.usuario.organizacionId ? await db.plataforma.organizaciones.get(req.usuario.organizacionId) : null;
  res.json({ usuario: publico(u), organizacion });
}
