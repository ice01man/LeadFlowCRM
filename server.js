// Punto de entrada: valida el entorno, conecta la base y levanta el servidor.
import { PORT, MODO } from './src/config/env.js';
import { iniciarStore } from './src/store/index.js';
import { cargarDemo } from './src/store/demo.js';
import { crearApp } from './app.js';

await iniciarStore(); // si Mongo no conecta, el proceso termina: nunca se sirve tráfico sin base

if (MODO === 'memoria') {
  const usuarios = await cargarDemo();
  console.log('Modo MEMORIA: datos de prueba en RAM, se pierden al reiniciar.');
  console.log('Usuarios demo: ' + usuarios.map((u) => `${u.email} / ${u.password}`).join('  |  '));
}

crearApp().listen(PORT, () => console.log(`LeadFlow CRM escuchando en http://localhost:${PORT} (persistencia: ${MODO})`));
