// Fase 1: plantillas de vertical y configuración comercial por organización.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar, SUPER } from './helpers.js';
import { PLANTILLAS } from '../src/verticales/plantillas.js';
import { validarConfig, aplicarCambios, calcularScoreBANT } from '../src/verticales/validacion.js';
import { sembrarVerticales } from '../src/services/verticales.js';

let s, sup, adminA, consultorA, vendedorA, adminB;
before(async () => {
  s = await levantar();
  sup = await s.token(SUPER);
  adminA = await s.token('admin@empresa-a.test');
  consultorA = await s.token('consultor@empresa-a.test');
  vendedorA = await s.token('vendedor@empresa-a.test');
  adminB = await s.token('admin@empresa-b.test');
});
after(async () => s.cerrar());

// ---------- Plantillas ----------

test('las tres plantillas iniciales son válidas y se cargan una sola vez', async () => {
  for (const p of PLANTILLAS) assert.doesNotThrow(() => validarConfig(p), p.codigo);
  assert.equal(await sembrarVerticales(), 0); // ya estaban: no duplica ni pisa
  const r = await s.api('GET', '/verticales', { token: vendedorA });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.map((v) => v.codigo).sort(), ['granja', 'seguros', 'vinos']);
});

test('detalle de un vertical: etapas, BANT en orden y variables calculadas de los emails', async () => {
  const r = await s.api('GET', '/verticales/vinos', { token: adminA });
  assert.equal(r.status, 200);
  assert.equal(r.data.etapasPipeline.length, 5);
  assert.deepEqual(r.data.criteriosBANT.map((c) => c.codigo), ['presupuesto', 'autoridad', 'necesidad', 'tiempo']);
  const reactivacion = r.data.templatesEmail.find((t) => t.codigo === 'reactivacion');
  assert.deepEqual(reactivacion.variables.sort(), ['contacto', 'empresa', 'vendedor']);
  assert.equal((await s.api('GET', '/verticales/no_existe', { token: adminA })).status, 404);
});

test('solo el superadmin crea o modifica plantillas', async () => {
  assert.equal((await s.api('POST', '/verticales', { token: adminA, body: { codigo: 'ferreteria', nombre: 'Ferretería', basadoEn: 'granja' } })).status, 403);
  assert.equal((await s.api('PATCH', '/verticales/vinos', { token: consultorA, body: { nombre: 'X' } })).status, 403);
});

test('superadmin crea un vertical nuevo basado en otro y lo puede desactivar', async () => {
  const r = await s.api('POST', '/verticales', { token: sup, body: { codigo: 'ferreteria', nombre: 'Ferretería', basadoEn: 'granja', categoriasProducto: ['Herramientas', 'Bulonería', 'Pintura'] } });
  assert.equal(r.status, 201);
  assert.deepEqual(r.data.categoriasProducto, ['Herramientas', 'Bulonería', 'Pintura']);
  assert.equal(r.data.etapasPipeline.length, 5); // heredado de granja
  assert.equal((await s.api('POST', '/verticales', { token: sup, body: { codigo: 'ferreteria', nombre: 'Otra', basadoEn: 'granja' } })).status, 409);
  assert.equal((await s.api('PATCH', '/verticales/ferreteria', { token: sup, body: { activo: false } })).status, 200);
  // desactivado: no aparece para usuarios de organizaciones y no se puede usar para altas
  assert.ok(!(await s.api('GET', '/verticales', { token: adminA })).data.some((v) => v.codigo === 'ferreteria'));
  assert.ok((await s.api('GET', '/verticales', { token: sup })).data.some((v) => v.codigo === 'ferreteria'));
  const alta = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Ferretería X', verticalCodigo: 'ferreteria', admin: { nombre: 'F', email: 'f@ferreteria.test', password: s.claveNueva } } });
  assert.equal(alta.status, 400);
});

test('crear un vertical sin datos suficientes o con código inválido falla', async () => {
  assert.equal((await s.api('POST', '/verticales', { token: sup, body: { codigo: 'Con Espacios', nombre: 'X', basadoEn: 'vinos' } })).status, 400);
  assert.equal((await s.api('POST', '/verticales', { token: sup, body: { codigo: 'vacio', nombre: 'Vacío' } })).status, 400);
});

// ---------- Organizaciones ----------

test('el alta de organización exige un vertical existente y copia su configuración', async () => {
  const sinVertical = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Sin rubro', admin: { nombre: 'X', email: 'x@sin.test', password: s.claveNueva } } });
  assert.equal(sinVertical.status, 400);
  const inexistente = await s.api('POST', '/organizaciones', { token: sup, body: { nombre: 'Rubro raro', verticalCodigo: 'astronautica', admin: { nombre: 'X', email: 'x@raro.test', password: s.claveNueva } } });
  assert.equal(inexistente.status, 404);
  const cfgA = await s.api('GET', '/organizacion/config', { token: vendedorA });
  assert.equal(cfgA.status, 200);
  assert.equal(cfgA.data.verticalCodigo, 'vinos');
  assert.equal(cfgA.data.config.etapasPipeline.at(2).nombre, 'Degustación o visita');
  const cfgB = await s.api('GET', '/organizacion/config', { token: adminB });
  assert.equal(cfgB.data.verticalCodigo, 'granja');
});

test('el listado de organizaciones no trae la configuración completa', async () => {
  const r = await s.api('GET', '/organizaciones', { token: sup });
  assert.ok(r.data.every((o) => o.config === undefined && o.verticalCodigo));
});

test('el superadmin no puede pisar vertical ni configuración por el PATCH de organización', async () => {
  const id = (await s.api('GET', '/auth/me', { token: adminA })).data.organizacion._id;
  assert.equal((await s.api('PATCH', `/organizaciones/${id}`, { token: sup, body: { verticalCodigo: 'seguros' } })).status, 400);
});

// ---------- Configuración propia ----------

test('consultor ajusta su configuración; la plantilla y la otra organización no cambian', async () => {
  const actual = (await s.api('GET', '/organizacion/config', { token: consultorA })).data.config;
  const etapas = [...actual.etapasPipeline, { codigo: 'recompra', nombre: 'Primera recompra', probabilidad: 95 }];
  const r = await s.api('PATCH', '/organizacion/config', { token: consultorA, body: { etapasPipeline: etapas } });
  assert.equal(r.status, 200);
  assert.equal(r.data.config.etapasPipeline.length, 6);
  assert.equal(r.data.config.categoriasProducto.length, actual.categoriasProducto.length); // lo demás intacto
  assert.equal((await s.api('GET', '/verticales/vinos', { token: sup })).data.etapasPipeline.length, 5);
  assert.equal((await s.api('GET', '/organizacion/config', { token: adminB })).data.config.etapasPipeline.length, 5);
});

test('el vendedor y el superadmin no editan la configuración de una organización', async () => {
  assert.equal((await s.api('PATCH', '/organizacion/config', { token: vendedorA, body: { categoriasNegocio: ['X'] } })).status, 403);
  assert.equal((await s.api('GET', '/organizacion/config', { token: sup })).status, 403);
});

test('validaciones de configuración: probabilidades, BANT, variables de email, campos desconocidos', async () => {
  const cfg = (await s.api('GET', '/organizacion/config', { token: adminA })).data.config;
  const patch = (body) => s.api('PATCH', '/organizacion/config', { token: adminA, body });
  const baja = [{ codigo: 'a1', nombre: 'A', probabilidad: 50 }, { codigo: 'b1', nombre: 'B', probabilidad: 20 }];
  assert.match((await patch({ etapasPipeline: baja })).data.error, /no puede bajar/);
  assert.equal((await patch({ etapasPipeline: [{ codigo: 'a1', nombre: 'A', probabilidad: 10 }, { codigo: 'a1', nombre: 'B', probabilidad: 20 }] })).status, 400);
  const sinPeso = cfg.criteriosBANT.map((c) => ({ ...c, peso: 0 }));
  assert.match((await patch({ criteriosBANT: sinPeso })).data.error, /mayor que cero/);
  assert.equal((await patch({ criteriosBANT: cfg.criteriosBANT.slice(0, 3) })).status, 400);
  const mail = [{ codigo: 'x1', asunto: 'Hola {{cliente}}', cuerpo: 'Texto' }];
  assert.match((await patch({ templatesEmail: mail })).data.error, /\{\{cliente\}\} no existe/);
  assert.match((await patch({ organizacionId: 'otra' })).data.error, /no permitidos/);
  assert.equal((await patch({ categoriasNegocio: { $ne: null } })).status, 400);
  assert.equal((await patch({})).status, 400);
});

test('el admin restaura la configuración desde la plantilla; el consultor no puede', async () => {
  assert.equal((await s.api('POST', '/organizacion/config/restaurar', { token: consultorA })).status, 403);
  const r = await s.api('POST', '/organizacion/config/restaurar', { token: adminA });
  assert.equal(r.status, 200);
  assert.equal(r.data.config.etapasPipeline.length, 5);
});

// ---------- Score BANT ----------

test('score BANT ponderado 0-100 según los pesos del vertical', () => {
  const vinos = validarConfig(PLANTILLAS[0]).criteriosBANT; // pesos 3, 2, 3, 2
  assert.equal(calcularScoreBANT(vinos, { presupuesto: 1, autoridad: 1, necesidad: 1, tiempo: 1 }), 100);
  assert.equal(calcularScoreBANT(vinos, { presupuesto: 1, autoridad: 0, necesidad: 1, tiempo: 0 }), 60);
  assert.throws(() => calcularScoreBANT(vinos, { presupuesto: 2, autoridad: 0, necesidad: 0, tiempo: 0 }), /entre 0 y 1/);
  assert.throws(() => aplicarCambios(validarConfig(PLANTILLAS[0]), { criteriosBANT: 'muchos' }), /lista/);
});
