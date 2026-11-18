import { el, vaciar, sesion, barra, NOMBRE_ROL } from './ui.js';
import { api } from './api.js';

const s = await sesion();
barra(s, '/inicio');
const app = vaciar(document.getElementById('app'));
const { usuario, organizacion } = s;

app.append(
  el('h1', {}, `Hola, ${usuario.nombre}`),
  el('p', { class: 'sub' }, organizacion ? `${organizacion.nombre} · ${NOMBRE_ROL[usuario.rol]}` : 'Administración de la plataforma'),
);

const tarjetas = el('div', { class: 'tarjetas' });
const tarjeta = (href, titulo, texto) => el('a', { class: 'tarjeta-link', href }, el('strong', {}, titulo), el('span', { class: 'suave' }, texto));

if (usuario.rol === 'superadmin') {
  tarjetas.append(tarjeta('/plataforma', 'Organizaciones', 'Dar de alta clientes del SaaS, elegir su rubro y suspender o reactivar cuentas.'));
  tarjetas.append(tarjeta('/plataforma#verticales', 'Plantillas de vertical', 'Ver las configuraciones de vinos, granja, seguros y los rubros que agregues.'));
} else {
  let vertical = '';
  try {
    const { verticalCodigo } = await api('GET', '/organizacion/config');
    vertical = (await api('GET', `/verticales/${verticalCodigo}`)).nombre;
  } catch { /* sin vertical: se muestra la tarjeta igual */ }
  const puedeEditar = ['admin', 'consultor'].includes(usuario.rol);
  tarjetas.append(tarjeta('/configuracion', 'Configuración comercial',
    `${vertical ? `Rubro: ${vertical}. ` : ''}${puedeEditar ? 'Ajustá etapas del pipeline, pesos BANT y categorías.' : 'Etapas del pipeline, criterios BANT, guiones de visita y plantillas de email.'}`));
  tarjetas.append(el('div', { class: 'tarjeta-link' }, el('strong', {}, 'Contactos, pipeline y ventas'), el('span', { class: 'suave' }, 'Llegan en la próxima fase.')));
}
app.append(tarjetas);
