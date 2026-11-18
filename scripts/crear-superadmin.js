// Crea el primer superadmin en la base real (Mongo). Se corre UNA vez después del primer deploy.
// Uso:  npm run superadmin -- email@dominio.com "Nombre Apellido"
// La contraseña se pide por la variable SUPERADMIN_PASSWORD para que no quede en el historial de la terminal.
import { iniciarStore, cerrarStore, db } from '../src/store/index.js';
import { hashear, validarPassword } from '../src/services/usuarios.js';
import { esEmail } from '../src/utils/errores.js';

const [email, nombre = 'Superadmin'] = process.argv.slice(2);
const password = process.env.SUPERADMIN_PASSWORD;

if (!esEmail(email)) {
  console.error('Uso: SUPERADMIN_PASSWORD=... npm run superadmin -- email@dominio.com "Nombre"');
  process.exit(1);
}
validarPassword(password);

await iniciarStore();
if (await db.plataforma.usuarios.findOne({ email: email.toLowerCase() })) {
  console.error('Ya existe un usuario con ese email.');
} else {
  await db.plataforma.usuarios.create({ nombre, email: email.toLowerCase(), rol: 'superadmin', organizacionId: null, passwordHash: await hashear(password), activo: true });
  console.log(`Superadmin ${email} creado.`);
}
await cerrarStore();
