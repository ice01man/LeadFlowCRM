import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './helpers.js';

let s;
before(async () => { s = await levantar(); });
after(async () => s.cerrar());

test('salud responde sin sesión y no expone datos', async () => {
  const r = await s.api('GET', '/salud');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
  assert.equal(r.data.llm, 'apagado');
});

test('login correcto devuelve token, usuario sin hash y cookie httpOnly', async () => {
  const r = await s.api('POST', '/auth/login', { body: { email: 'admin@empresa-a.test', password: s.clave } });
  assert.equal(r.status, 200);
  assert.ok(r.data.token);
  assert.equal(r.data.usuario.passwordHash, undefined);
  assert.match(r.headers.get('set-cookie'), /lf_sesion=.*HttpOnly/i);
});

test('login: contraseña mala, email inexistente y datos inyectados dan el mismo 401', async () => {
  const malo = await s.api('POST', '/auth/login', { body: { email: 'admin@empresa-a.test', password: s.claveNueva + '-mala' } });
  const inexistente = await s.api('POST', '/auth/login', { body: { email: 'nadie@x.com', password: s.clave } });
  const inyeccion = await s.api('POST', '/auth/login', { body: { email: { $ne: null }, password: s.clave } });
  for (const r of [malo, inexistente, inyeccion]) {
    assert.equal(r.status, 401);
    assert.equal(r.data.error, 'Email o contraseña incorrectos.');
  }
});

test('/auth/me sin token o con token adulterado da 401', async () => {
  assert.equal((await s.api('GET', '/auth/me')).status, 401);
  const t = await s.token('vendedor@empresa-a.test');
  const adulterado = t.slice(0, -3) + (t.endsWith('aaa') ? 'bbb' : 'aaa');
  assert.equal((await s.api('GET', '/auth/me', { token: adulterado })).status, 401);
});

test('/auth/me devuelve usuario y organización; el superadmin no tiene organización', async () => {
  const r = await s.api('GET', '/auth/me', { token: await s.token('consultor@empresa-a.test') });
  assert.equal(r.status, 200);
  assert.equal(r.data.usuario.rol, 'consultor');
  assert.equal(r.data.organizacion.nombre, 'Empresa A');
  const sup = await s.api('GET', '/auth/me', { token: await s.token('super@plataforma.test') });
  assert.equal(sup.data.organizacion, null);
});

test('la cookie de sesión también autentica (para las páginas del frontend)', async () => {
  const t = await s.token('lectura@empresa-a.test');
  const r = await s.api('GET', '/auth/me', { headers: { Cookie: `lf_sesion=${t}` } });
  assert.equal(r.status, 200);
});

test('rutas inexistentes de la API dan 404 en JSON', async () => {
  const r = await s.api('GET', '/no-existe');
  assert.equal(r.status, 404);
  assert.equal(r.data.error, 'Ruta no encontrada');
});

test('JSON mal formado da 400 sin filtrar detalles', async () => {
  const r = await fetch(`${s.base}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":' });
  assert.equal(r.status, 400);
  assert.deepEqual(await r.json(), { error: 'JSON inválido.' });
});

test('las respuestas llevan CSP y no anuncian Express', async () => {
  const r = await fetch(`${s.base}/salud`);
  assert.match(r.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal(r.headers.get('x-powered-by'), null);
});
