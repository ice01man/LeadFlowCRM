// Cliente mínimo de la API. La sesión viaja en una cookie httpOnly: el JS nunca ve el token.
export async function api(metodo, ruta, cuerpo) {
  const r = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: cuerpo ? { 'Content-Type': 'application/json' } : {},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    credentials: 'same-origin',
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(datos.error || `Error ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return datos;
}
