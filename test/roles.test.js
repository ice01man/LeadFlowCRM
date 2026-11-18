import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './helpers.js';

let s;
before(async () => { s = await levantar(); });
after(async () => s.cerrar());

test('solo el admin de la organización gestiona usuarios', async () => {
  for (const email of ['consultor@bodega.demo', 'vendedor@bodega.demo', 'lectura@bodega.demo']) {
    assert.equal((await s.api('GET', '/usuarios', { token: await s.token(email) })).status, 403, email);
  }
  // el superadmin no pertenece a ninguna organización: no lista usuarios "de nadie"
  assert.equal((await s.api('GET', '/usuarios', { token: await s.token('super@leadflow.demo') })).status, 403);
});

test('solo el superadmin gestiona organizaciones', async () => {
  assert.equal((await s.api('GET', '/organizaciones', { token: await s.token('admin@bodega.demo') })).status, 403);
  const r = await s.api('GET', '/organizaciones', { token: await s.token('super@leadflow.demo') });
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 2);
});

test('alta de organización crea su admin, que puede ingresar y solo ve su organización', async () => {
  const sup = await s.token('super@leadflow.demo');
  const r = await s.api('POST', '/organizaciones', {
    token: sup,
    body: { nombre: 'Seguros Demo', cuit: '30-33333333-3', admin: { nombre: 'Ana Admin', email: 'ana@seguros.demo', password: 'clave12345' } },
  });
  assert.equal(r.status, 201);
  assert.equal(r.data.admin.rol, 'admin');
  const t = await s.token('ana@seguros.demo', 'clave12345');
  const usuarios = await s.api('GET', '/usuarios', { token: t });
  assert.deepEqual(usuarios.data.map((u) => u.email), ['ana@seguros.demo']);
});

test('alta de organización: nombre repetido, CUIT inválido o admin con email usado no dejan nada a medias', async () => {
  const sup = await s.token('super@leadflow.demo');
  const antes = (await s.api('GET', '/organizaciones', { token: sup })).data.length;
  const repetido = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'bodega demo', admin: { nombre: 'X', email: 'x1@x.com', password: 'clave12345' } } });
  assert.equal(repetido.status, 409);
  const cuit = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Otra', cuit: '123', admin: { nombre: 'X', email: 'x2@x.com', password: 'clave12345' } } });
  assert.equal(cuit.status, 400);
  const email = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Otra', admin: { nombre: 'X', email: 'admin@bodega.demo', password: 'clave12345' } } });
  assert.equal(email.status, 409);
  assert.equal((await s.api('GET', '/organizaciones', { token: sup })).data.length, antes);
});

test('validaciones de usuario: rol inexistente, superadmin, contraseña corta y email repetido', async () => {
  const admin = await s.token('admin@bodega.demo');
  const base = { nombre: 'Nuevo', email: 'nuevo@bodega.demo', password: 'clave12345', rol: 'vendedor' };
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, rol: 'jefe' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, rol: 'superadmin' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, password: '123' } })).status, 400);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: { ...base, email: 'vendedor@granja.demo' } })).status, 409);
  assert.equal((await s.api('POST', '/usuarios', { token: admin, body: base })).status, 201);
});

test('un admin no puede desactivarse ni bajarse el rol a sí mismo', async () => {
  const admin = await s.token('admin@bodega.demo');
  const yo = (await s.api('GET', '/auth/me', { token: admin })).data.usuario;
  assert.equal((await s.api('PATCH', `/usuarios/${yo._id}`, { token: admin, body: { activo: false } })).status, 400);
  assert.equal((await s.api('PATCH', `/usuarios/${yo._id}`, { token: admin, body: { rol: 'vendedor' } })).status, 400);
});

test('desactivar un usuario le corta la sesión aunque su token no haya vencido', async () => {
  const admin = await s.token('admin@bodega.demo');
  const t = await s.token('lectura@bodega.demo');
  const lectura = (await s.api('GET', '/usuarios', { token: admin })).data.find((u) => u.email === 'lectura@bodega.demo');
  await s.api('PATCH', `/usuarios/${lectura._id}`, { token: admin, body: { activo: false } });
  assert.equal((await s.api('GET', '/auth/me', { token: t })).status, 401);
  await s.api('PATCH', `/usuarios/${lectura._id}`, { token: admin, body: { activo: true } });
});
