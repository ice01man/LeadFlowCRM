// Punto de entrada: valida el entorno, conecta la base y levanta el servidor.
import { PORT, MODO } from './src/config/env.js';
import { iniciarStore } from './src/store/index.js';
import { crearSuperadminLocal } from './src/store/local.js';
import { crearApp } from './app.js';
import { MARCA } from './src/config/marca.js';

await iniciarStore(); // si Mongo no conecta, el proceso termina: nunca se sirve tráfico sin base

if (MODO === 'memoria') {
  const local = await crearSuperadminLocal();
  console.log('Modo MEMORIA: los datos viven en RAM y se pierden al reiniciar.');
  if (local) console.log(`Superadmin local de esta sesión: ${local.email}  ·  contraseña: ${local.password}`);
}

crearApp().listen(PORT, () => console.log(`${MARCA.firma} escuchando en http://localhost:${PORT} (persistencia: ${MODO})`));
