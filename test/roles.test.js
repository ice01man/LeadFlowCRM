import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './helpers.js';

let s;
before(async () => { s = await levantar(); });
after(async () => s.cerrar());

test('solo el admin de la organización gestiona usuarios', async () => {
  for (const email of ['consultor@empresa-a.test', 'vendedor@empresa-a.test', 'lectura@empresa-a.test']) {
    assert.equal((await s.api('GET', '/usuarios', { token: await s.token(email) })).status, 403, email);
  }
  // el superadmin no pertenece a ninguna organización: no lista usuarios "de nadie"
  assert.equal((await s.api('GET', '/usuarios', { token: await s.token('super@plataforma.test') })).status, 403);
});

test('solo el superadmin gestiona organizaciones', async () => {
  assert.equal((await s.api('GET', '/organizaciones', { token: await s.token('admin@empresa-a.test') })).status, 403);
  const r = await s.api('GET', '/organizaciones', { token: await s.token('super@plataforma.test') });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 2);
});

test('alta de organización crea su admin, que puede ingresar y solo ve su organización', async () => {
  const sup = await s.token('super@plataforma.test');
  const r = await s.api('POST', '/organizaciones', {
    token: sup,
    body: { nombre: 'Empresa C', cuit: '30-33333333-3', verticalCodigo: 'seguros', admin: { nombre: 'Ana Admin', email: 'ana@empresa-c.test', password: s.claveNueva } },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.admin.rol, 'admin');
  const t = await s.token('ana@empresa-c.test', s.claveNueva);
  const usuarios = await s.api('GET', '/usuarios', { token: t });
  assert.deepEqual(usuarios.data.map((u) => u.email), ['ana@empresa-c.test']);
});

test('alta de organización: nombre repetido, CUIT inválido o admin con email usado no dejan nada a medias', async () => {
  const sup = await s.token('super@plataforma.test');
  const antes = (await s.api('GET', '/organizaciones', { token: sup })).data.length;
  const repetido = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'empresa a', verticalCodigo: 'vinos', admin: { nombre: 'X', email: 'x1@x.com', password: s.claveNueva } } });
  assert.equal(repetido.status, 409);
  const cuit = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Otra', cuit: '123', verticalCodigo: 'vinos', admin: { nombre: 'X', email: 'x2@x.com', password: s.claveNueva } } });
  assert.equal(cuit.status, 400);
  const email = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Otra', verticalCodigo: 'vinos', admin: { nombre: 'X', email: 'admin@empresa-a.test', password: s.claveNueva } } });
  assert.equal(email.status, 409);
  assert.equal((await s.api('GET', '/organizaciones', { token: sup })).data.length, antes);
});

test('validaciones de usuario: rol inexistente, superadmin, contraseña corta y email repetido', async () => {
  const admin = await s.token('admin@empresa-a.test');
  const base = { nombre: 'Nuevo', email: 'nuevo@empresa-a.test', password: s.claveNueva, rol: 'vendedor' };
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, rol: 'jefe' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, rol: 'superadmin' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, password: '123' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, email: 'vendedor@empresa-b.test' } })).status, 409);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: base })).status, 201);
});

test('un admin no puede desactivarse ni bajarse el rol a sí mismo', async () => {
  const admin = await s.token('admin@empresa-a.test');
  const yo = (await s.api('GET', '/auth/me', { token: admin })).data.usuario;
  assert.equal((await s.api('PATCH', `/usuarios/${yo._id}`, { token: admin, body: { activo: false } })).status, 400);
  assert.equal((await s.api('PATCH', `/usuarios/${yo._id}`, { token: admin, body: { rol: 'vendedor' } })).status, 400);
});

test('desactivar un usuario le corta la sesión aunque su token no haya vencido', async () => {
  const admin = await s.token('admin@empresa-a.test');
  const t = await s.token('lectura@empresa-a.test');
  const lectura = (await s.api('GET', '/usuarios', { token: admin })).data.find((u) => u.email === 'lectura@empresa-a.test');
  await s.api('PATCH', `/usuarios/${lectura._id}`, { token: admin, body: { activo: false } });
  assert.equal((await s.api('GET', '/auth/me', { token: t })).status, 401);
  await s.api('PATCH', `/usuarios/${lectura._id}`, { token: admin, body: { activo: true } });
});
