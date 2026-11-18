import { api } from './api.js';

const form = document.getElementById('form-login');
const error = document.getElementById('error');

// Si ya hay sesión válida, directo al inicio.
api('GET', '/auth/me').then(() => location.replace('/inicio')).catch(() => {});

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  error.textContent = '';
  const boton = form.querySelector('button');
  boton.disabled = true;
  try {
    const { usuario } = await api('POST', '/auth/login', { email: form.email.value, password: form.password.value });
    location.replace(usuario.rol === 'superadmin' ? '/clientes' : '/inicio');
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
});
