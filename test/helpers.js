// Levanta la app en memoria, en un puerto libre, y arma los datos de prueba A TRAVÉS DE LA API.
// No hay usuarios ni contraseñas fijas: las claves se generan al azar en cada corrida.
process.env.PERSISTENCIA = 'memoria';
process.env.NODE_ENV = 'test';

import crypto from 'node:crypto';

const { iniciarStore, db } = await import('../src/store/index.js');
const { hashear } = await import('../src/services/usuarios.js');
const { crearApp } = await import('../app.js');

const azar = () => crypto.randomBytes(9).toString('base64url');

// Organizaciones y usuarios de prueba (dominio .test, reservado para pruebas).
const ESCENARIO = [
  { nombre: 'Empresa A', cuit: '30-11111111-1', admin: 'admin@empresa-a.test', otros: [['consultor', 'consultor@empresa-a.test'], ['vendedor', 'vendedor@empresa-a.test'], ['lectura', 'lectura@empresa-a.test']] },
  { nombre: 'Empresa B', cuit: '30-22222222-2', admin: 'admin@empresa-b.test', otros: [['vendedor', 'vendedor@empresa-b.test']] },
];
export const SUPER = 'super@plataforma.test';

export async function levantar() {
  await iniciarStore();
  const clave = azar();      // contraseña de todos los usuarios del escenario
  const claveNueva = azar(); // para usuarios que crean los propios tests
  await db.plataforma.usuarios.create({ nombre: 'Superadmin', email: SUPER, rol: 'superadmin', organizacionId: null, passwordHash: await hashear(clave), activo: true });

  const server = crearApp().listen(0);
  await new Promise((ok) => server.once('listening', ok));
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function api(metodo, ruta, { token, body, headers = {} } = {}) {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, data: await r.json().catch(() => null), headers: r.headers };
  }

  async function token(email, password = clave) {
    const r = await api('POST', '/auth/login', { body: { email, password } });
    if (r.status !== 200) throw new Error(`No pude ingresar como ${email}: ${r.status}`);
    return r.data.token;
  }

  // El escenario se arma igual que en producción: superadmin crea organizaciones, cada admin crea su equipo.
  const tSuper = await token(SUPER);
  for (const o of ESCENARIO) {
    const r = await api('POST', '/organizaciones', { token: tSuper, body: { nombre: o.nombre, cuit: o.cuit, admin: { nombre: `Admin ${o.nombre}`, email: o.admin, password: clave } } });
    if (r.status !== 201) throw new Error(`No pude crear ${o.nombre}: ${JSON.stringify(r.data)}`);
    const tAdmin = await token(o.admin);
    for (const [rol, email] of o.otros) {
      const u = await api('POST', '/usuarios', { token: tAdmin, body: { nombre: `${rol} ${o.nombre}`, email, password: clave, rol } });
      if (u.status !== 201) throw new Error(`No pude crear ${email}: ${JSON.stringify(u.data)}`);
    }
  }

  return { api, token, base, clave, claveNueva, cerrar: () => new Promise((ok) => server.close(ok)) };
}
