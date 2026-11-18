// La marca Revoluxia tiene que verse en todo el sistema y sus recursos tienen que servirse.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { levantar } from './helpers.js';

let s, raiz;
before(async () => { s = await levantar(); raiz = s.base.replace(/\/api$/, ''); });
after(async () => s.cerrar());

test('/api/marca expone nombre, eslogan, colores y logos de Revoluxia', async () => {
  const r = await s.api('GET', '/marca');
  assert.equal(r.status, 200);
  assert.equal(r.data.empresa, 'Revoluxia');
  assert.equal(r.data.producto, 'LeadFlow CRM');
  assert.match(r.data.colores.primario, /^#[0-9a-f]{6}$/);
  assert.equal((await s.api('GET', '/salud')).data.producto, 'LeadFlow CRM · Revoluxia');
});

test('todos los logos e íconos de la marca existen y son PNG', async () => {
  const { data: marca } = await s.api('GET', '/marca');
  const rutas = [...Object.values(marca.logos), '/img/favicon-32.png', '/img/icono-180.png', '/img/icono-512.png'];
  for (const ruta of rutas) {
    const r = await fetch(raiz + ruta);
    assert.equal(r.status, 200, ruta);
    assert.equal(r.headers.get('content-type'), 'image/png', ruta);
  }
});

test('las páginas llevan el nombre, el logo y el favicon de la marca', async () => {
  for (const pagina of ['/', '/inicio']) {
    const html = await (await fetch(raiz + pagina)).text();
    assert.match(html, /<title>[^<]*LeadFlow CRM · Revoluxia<\/title>/, pagina);
    assert.match(html, /revoluxia-(logo|isotipo)\.png/, pagina);
    assert.match(html, /favicon-32\.png/, pagina);
    assert.match(html, /manifest\.webmanifest/, pagina);
  }
});

test('el token lo emite LeadFlow de Revoluxia: uno firmado sin ese emisor se rechaza', async () => {
  const jwt = (await import('jsonwebtoken')).default;
  const { JWT_SECRET } = await import('../src/config/env.js');
  const me = (await s.api('POST', '/auth/login', { body: { email: 'admin@bodega.demo', password: 'demo12345' } })).data.usuario;
  const sinEmisor = jwt.sign({ id: me._id, rol: me.rol, org: me.organizacionId }, JWT_SECRET, { algorithm: 'HS256' });
  assert.equal((await s.api('GET', '/auth/me', { token: sinEmisor })).status, 401);
});
