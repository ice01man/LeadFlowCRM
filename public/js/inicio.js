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
  tarjetas.prepend(
    tarjeta('/contactos', 'Contactos', s.usuario.rol === 'vendedor' ? 'Tu cartera de clientes y prospectos.' : 'Cartera completa, vistas guardadas, asignación a vendedores e importación CSV.'),
    tarjeta('/empresas', 'Empresas', 'Comercios y organizaciones con las que trabajás.'),
  );
  tarjetas.append(el('div', { class: 'tarjeta-link' }, el('strong', {}, 'Pipeline, actividades y ventas'), el('span', { class: 'suave' }, 'Llegan en las próximas entregas.')));
}
app.append(tarjetas);
