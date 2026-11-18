// El servidor tiene que NEGARSE a arrancar con configuraciones inseguras o inválidas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Corre desde test/ pero importa el env.js real.
const ejecutar = (env) => spawnSync(process.execPath, ['--input-type=module', '-e', `await import(${JSON.stringify(join(RAIZ, 'src/config/env.js'))})`], {
  cwd: join(RAIZ, 'test'), env: { PATH: process.env.PATH, ...env }, encoding: 'utf8',
});

test('mongo sin JWT_SECRET fuerte no arranca', () => {
  const r = ejecutar({ PERSISTENCIA: 'mongo', MONGODB_URI: 'mongodb://x', JWT_SECRET: 'corto' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /JWT_SECRET/);
});

test('memoria en producción no arranca', () => {
  const r = ejecutar({ PERSISTENCIA: 'memoria', NODE_ENV: 'production' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no está permitida/);
});

test('proveedor de LLM desconocido o temperatura fuera de rango no arrancan', () => {
  assert.match(ejecutar({ PERSISTENCIA: 'memoria', LLM_PROVIDER: 'chatgpt' }).stderr, /LLM_PROVIDER/);
  assert.match(ejecutar({ PERSISTENCIA: 'memoria', LLM_TEMPERATURE: '3' }).stderr, /LLM_TEMPERATURE/);
});

test('configuración válida de memoria arranca (LLM apagado si no hay clave)', () => {
  const r = ejecutar({ PERSISTENCIA: 'memoria', LLM_PROVIDER: 'anthropic' });
  assert.equal(r.status, 0, r.stderr);
});
