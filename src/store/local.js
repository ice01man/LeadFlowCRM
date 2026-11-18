// Solo para PERSISTENCIA=memoria (desarrollo en tu máquina). No hay usuarios ni contraseñas fijas en el código:
// al arrancar se crea un superadmin local con una contraseña aleatoria que se muestra UNA vez en la consola.
// En Mongo (producción) esto no corre nunca: el superadmin se crea con `npm run superadmin`.
import crypto from 'node:crypto';
import { db } from './index.js';
import { hashear } from '../services/usuarios.js';

export async function crearSuperadminLocal() {
  if (await db.plataforma.usuarios.count()) return null;
  const email = (process.env.LOCAL_ADMIN_EMAIL || 'admin@localhost.test').toLowerCase();
  const password = crypto.randomBytes(9).toString('base64url');
  await db.plataforma.usuarios.create({ nombre: 'Superadmin local', email, rol: 'superadmin', organizacionId: null, passwordHash: await hashear(password), activo: true });
  return { email, password };
}
