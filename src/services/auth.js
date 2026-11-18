// Login y sesión. El token lleva el id del usuario, su rol y su organización;
// igual, en cada request se vuelve a leer el usuario (si lo desactivan, pierde acceso al instante).
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRA } from '../config/env.js';
import { db } from '../store/index.js';
import { publico } from './usuarios.js';
import { noAutorizado, esEmail } from '../utils/errores.js';

// Hash fijo para comparar aunque el email no exista: el tiempo de respuesta no revela qué emails están dados de alta.
const HASH_FALSO = bcrypt.hashSync('leadflow-hash-falso', 10);

export const firmarToken = (u) => jwt.sign(
  { id: String(u._id), rol: u.rol, org: u.organizacionId ? String(u.organizacionId) : null },
  JWT_SECRET, { expiresIn: JWT_EXPIRA, algorithm: 'HS256', issuer: 'revoluxia-leadflow' },
);

export const verificarToken = (token) => jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], issuer: 'revoluxia-leadflow' });

export async function login(email, password) {
  const error = noAutorizado('Email o contraseña incorrectos.');
  if (!esEmail(email) || typeof password !== 'string' || !password) throw error;
  const u = await db.plataforma.usuarios.findOne({ email: email.trim().toLowerCase() });
  const ok = await bcrypt.compare(password, u?.passwordHash || HASH_FALSO);
  if (!u || !ok || u.activo === false) throw error;
  if (u.organizacionId) {
    const org = await db.plataforma.organizaciones.get(u.organizacionId);
    if (!org || org.activa === false) throw noAutorizado('La organización está suspendida. Contactá a soporte.');
  }
  return { token: firmarToken(u), usuario: publico(u) };
}
