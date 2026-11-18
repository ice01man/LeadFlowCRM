import { el, poner, vaciar, sesion, barra, NOMBRE_ROL } from './ui.js';
import { api } from './api.js';

const s = await sesion();
barra(s, '/inicio');
const app = vaciar(document.getElementById('app'));
const { usuario, organizacion } = s;

poner(app, 
  el('h1', {}, `Hola, ${usuario.nombre}`),
  el('p', { class: 'sub' }, organizacion ? `${organizacion.nombre} · ${NOMBRE_ROL[usuario.rol]}` : 'Administración de la plataforma'),
);

const tarjetas = el('div', { class: 'tarjetas' });
const tarjeta = (href, titulo, texto) => el('a', { class: 'tarjeta-link', href }, el('strong', {}, titulo), el('span', { class: 'suave' }, texto));

if (usuario.rol === 'superadmin') {
  poner(tarjetas, tarjeta('/plataforma', 'Organizaciones', 'Dar de alta clientes del SaaS, elegir su rubro y suspender o reactivar cuentas.'));
  poner(tarjetas, tarjeta('/plataforma#verticales', 'Plantillas de vertical', 'Ver las configuraciones de vinos, granja, seguros y los rubros que agregues.'));
} else {
  let vertical = '';
  try {
    const { verticalCodigo } = await api('GET', '/organizacion/config');
    vertical = (await api('GET', `/verticales/${verticalCodigo}`)).nombre;
  } catch { /* sin vertical: se muestra la tarjeta igual */ }
  const puedeEditar = ['admin', 'consultor'].includes(usuario.rol);
  poner(tarjetas, tarjeta('/configuracion', 'Configuración comercial',
    `${vertical ? `Rubro: ${vertical}. ` : ''}${puedeEditar ? 'Ajustá etapas del pipeline, pesos BANT y categorías.' : 'Etapas del pipeline, criterios BANT, guiones de visita y plantillas de email.'}`));
  tarjetas.prepend(
    tarjeta('/contactos', 'Contactos', s.usuario.rol === 'vendedor' ? 'Tu cartera de clientes y prospectos.' : 'Cartera completa, vistas guardadas, asignación a vendedores e importación CSV.'),
    tarjeta('/empresas', 'Empresas', 'Comercios y organizaciones con las que trabajás.'),
  );
  poner(tarjetas, 
    tarjeta('/pipeline', 'Pipeline', 'Oportunidades por etapa: arrastrá para avanzar, marcá ganadas o perdidas.'),
    tarjeta('/tareas', 'Tareas', 'Lo pendiente, ordenado por vencimiento.'),
  );
}
poner(app, tarjetas);
