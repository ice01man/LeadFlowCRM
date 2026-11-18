// Aislamiento entre organizaciones: el requisito más importante del SaaS.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './helpers.js';
import { repoMemoria } from '../src/store/memory.js';
import { repoTenant } from '../src/store/tenant.js';

let s, adminBodega, adminGranja;
before(async () => {
  s = await levantar();
  adminBodega = await s.token('admin@empresa-a.test');
  adminGranja = await s.token('admin@empresa-b.test');
});
after(async () => s.cerrar());

test('cada admin lista solo los usuarios de su organización', async () => {
  const bodega = await s.api('GET', '/usuarios', { token: adminBodega });
  const granja = await s.api('GET', '/usuarios', { token: adminGranja });
  assert.equal(bodega.status, 200);
  assert.ok(bodega.data.every((u) => u.email.endsWith('@empresa-a.test')));
  assert.ok(granja.data.every((u) => u.email.endsWith('@empresa-b.test')));
  assert.ok(bodega.data.every((u) => u.passwordHash === undefined));
});

test('un admin no puede leer ni modificar un usuario de otra organización aunque conozca su id', async () => {
  const ajeno = (await s.api('GET', '/usuarios', { token: adminGranja })).data[0];
  assert.equal((await s.api('GET', `/usuarios/${ajeno._id}`, { token: adminBodega })).status, 404);
  const r = await s.api('PATCH', `/usuarios/${ajeno._id}`, { token: adminBodega, body: { nombre: 'Hackeado' } });
  assert.equal(r.status, 404);
  const sigue = await s.api('GET', `/usuarios/${ajeno._id}`, { token: adminGranja });
  assert.notEqual(sigue.data.nombre, 'Hackeado');
});

test('no se puede crear un usuario en otra organización mandando organizacionId en el body', async () => {
  const granjaId = (await s.api('GET', '/auth/me', { token: adminGranja })).data.organizacion._id;
  const r = await s.api('POST', '/usuarios', {
    token: adminBodega,
    body: { nombre: 'Infiltrado', email: 'infiltrado@x.com', password: s.claveNueva, rol: 'vendedor', organizacionId: granjaId },
  });
  assert.equal(r.status, 201);
  const granja = await s.api('GET', '/usuarios', { token: adminGranja });
  assert.ok(!granja.data.some((u) => u.email === 'infiltrado@x.com'));
  const bodega = await s.api('GET', '/usuarios', { token: adminBodega });
  assert.ok(bodega.data.some((u) => u.email === 'infiltrado@x.com'));
});

test('repoTenant: sin organizacionId falla en lugar de devolver datos de todos', () => {
  assert.throws(() => repoTenant(repoMemoria(), ''), /falta organizacionId/);
  assert.throws(() => repoTenant(repoMemoria(), undefined), /falta organizacionId/);
});

test('repoTenant: get, update y remove ignoran documentos de otra organización', async () => {
  const crudo = repoMemoria();
  const a = repoTenant(crudo, 'org-a');
  const b = repoTenant(crudo, 'org-b');
  const doc = await a.create({ nombre: 'de A', organizacionId: 'org-b' }); // intento de inyección
  assert.equal(doc.organizacionId, 'org-a');
  assert.equal(await b.get(doc._id), null);
  assert.equal(await b.update(doc._id, { nombre: 'pisado' }), null);
  assert.equal(await b.remove(doc._id), false);
  assert.equal(await b.count(), 0);
  assert.equal((await a.get(doc._id)).nombre, 'de A');
  // tampoco se puede "mudar" un documento de organización con update
  await a.update(doc._id, { organizacionId: 'org-b' });
  assert.equal((await a.get(doc._id)).organizacionId, 'org-a');
});

test('suspender una organización corta el acceso de sus usuarios al instante', async () => {
  const sup = await s.token('super@plataforma.test');
  const vendedor = await s.token('vendedor@empresa-b.test');
  const granjaId = (await s.api('GET', '/auth/me', { token: adminGranja })).data.organizacion._id;
  assert.equal((await s.api('PATCH', `/organizaciones/${granjaId}`, { token: sup, body: { activa: false } })).status, 200);
  assert.equal((await s.api('GET', '/auth/me', { token: vendedor })).status, 401);
  const login = await s.api('POST', '/auth/login', { body: { email: 'vendedor@empresa-b.test', password: s.clave } });
  assert.equal(login.status, 401);
  await s.api('PATCH', `/organizaciones/${granjaId}`, { token: sup, body: { activa: true } });
  assert.equal((await s.api('GET', '/auth/me', { token: vendedor })).status, 200);
});
