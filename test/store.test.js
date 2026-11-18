// Repo en memoria: los operadores que van a necesitar las búsquedas y vistas del CRM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repoMemoria } from '../src/store/memory.js';

async function repoConDatos() {
  const r = repoMemoria({ unique: [['organizacionId', 'email']] });
  await r.create({ organizacionId: 'a', nombre: 'Juan Pérez', email: 'juan@x.com', zona: { municipio: 'Merlo' }, score: 85, tags: ['vino', 'mayorista'] });
  await r.create({ organizacionId: 'a', nombre: 'Ana Gómez', email: 'ana@x.com', zona: { municipio: 'Moreno' }, score: 40, tags: ['vino'] });
  await r.create({ organizacionId: 'a', nombre: 'Luis Díaz', email: 'luis@x.com', score: 62 });
  return r;
}

test('$regex con opciones (búsqueda sin distinguir mayúsculas)', async () => {
  const r = await repoConDatos();
  assert.deepEqual((await r.list({ nombre: { $regex: 'pérez', $options: 'i' } })).map((d) => d.email), ['juan@x.com']);
});

test('$or, campos anidados y $exists', async () => {
  const r = await repoConDatos();
  const hot = await r.list({ $or: [{ score: { $gte: 80 } }, { 'zona.municipio': 'Moreno' }] }, { sort: { score: -1 } });
  assert.deepEqual(hot.map((d) => d.email), ['juan@x.com', 'ana@x.com']);
  assert.equal(await r.count({ zona: { $exists: false } }), 1);
});

test('igualdad contra un campo array, orden y paginación', async () => {
  const r = await repoConDatos();
  assert.equal(await r.count({ tags: 'vino' }), 2);
  const pag = await r.list({}, { sort: { nombre: 1 }, skip: 1, limit: 1 });
  assert.deepEqual(pag.map((d) => d.nombre), ['Juan Pérez']);
});

test('índice único compuesto: mismo email en otra organización está permitido', async () => {
  const r = await repoConDatos();
  await assert.rejects(r.create({ organizacionId: 'a', email: 'JUAN@x.com' }), { code: 11000 });
  await r.create({ organizacionId: 'b', email: 'juan@x.com' });
  assert.equal(await r.count({ email: 'juan@x.com' }), 2);
});
