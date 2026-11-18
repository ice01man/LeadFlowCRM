import { api } from './api.js';

const poner = (id, valor) => { document.getElementById(id).textContent = valor; };

try {
  const { usuario, organizacion } = await api('GET', '/auth/me');
  poner('saludo', `Hola, ${usuario.nombre}`);
  poner('dato-email', usuario.email);
  poner('dato-rol', usuario.rol);
  poner('dato-org', organizacion ? organizacion.nombre : 'Plataforma (superadmin)');
} catch {
  location.replace('/');
}

document.getElementById('salir').addEventListener('click', async () => {
  await api('POST', '/auth/logout').catch(() => {});
  location.replace('/');
});
