// Levanta la app en memoria, en un puerto libre, con los datos demo cargados.
process.env.PERSISTENCIA = 'memoria';
process.env.NODE_ENV = 'test';

const { iniciarStore } = await import('../src/store/index.js');
const { cargarDemo, PASSWORD_DEMO } = await import('../src/store/demo.js');
const { crearApp } = await import('../app.js');

export { PASSWORD_DEMO };

export async function levantar() {
  await iniciarStore();
  await cargarDemo();
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

  async function token(email, password = PASSWORD_DEMO) {
    const r = await api('POST', '/auth/login', { body: { email, password } });
    if (r.status !== 200) throw new Error(`No pude ingresar como ${email}: ${r.status}`);
    return r.data.token;
  }

  return { api, token, base, cerrar: () => new Promise((ok) => server.close(ok)) };
}
