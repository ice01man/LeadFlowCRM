// Utilidades de interfaz compartidas por todas las pantallas.
// Todo el contenido se arma con nodos del DOM y textContent (nunca innerHTML con datos): evita inyección de HTML.
import { api } from './api.js';

/** Crea un elemento: el('button', { class: 'x', onclick: fn }, 'Texto', otroNodo) */
export function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (k === 'class') n.className = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) n.append(h instanceof Node ? h : String(h));
  return n;
}

export const vaciar = (n) => { while (n.firstChild) n.firstChild.remove(); return n; };

export const NOMBRE_ROL = { superadmin: 'Superadmin', admin: 'Administrador', consultor: 'Consultor', vendedor: 'Vendedor', lectura: 'Solo lectura' };

/** Exige sesión; si no hay, vuelve al login. Devuelve { usuario, organizacion }. */
export async function sesion() {
  try {
    return await api('GET', '/auth/me');
  } catch {
    location.replace('/');
    return new Promise(() => {}); // no sigue ejecutando la página
  }
}

/** Barra superior con marca, navegación según rol y salida. */
export function barra({ usuario, organizacion }, activa = '') {
  const links = [['/inicio', 'Inicio']];
  if (usuario.rol === 'superadmin') links.push(['/plataforma', 'Plataforma']);
  else links.push(['/configuracion', 'Configuración comercial']);
  const nav = el('nav', { class: 'nav', 'aria-label': 'Secciones' },
    links.map(([href, texto]) => el('a', { href, class: href === activa ? 'activo' : '', 'aria-current': href === activa ? 'page' : false }, texto)));
  const salir = el('button', { type: 'button', class: 'secundario chico', onclick: async () => { await api('POST', '/auth/logout').catch(() => {}); location.replace('/'); } }, 'Salir');
  const header = el('header', { class: 'barra' },
    el('a', { href: '/inicio', class: 'marca', 'aria-label': 'LeadFlow CRM, inicio' },
      el('img', { class: 'logo-isotipo solo-claro', src: '/img/revoluxia-isotipo.png', alt: '' }),
      el('img', { class: 'logo-isotipo solo-oscuro', src: '/img/revoluxia-isotipo-claro.png', alt: '' }),
      el('span', {}, el('span', { class: 'producto' }, 'LeadFlow CRM'), el('span', { class: 'empresa' }, 'Revoluxia · soluciones tecnológicas'))),
    nav,
    el('div', { class: 'usuario' }, el('span', {}, usuario.nombre), el('span', { class: 'suave' }, organizacion ? organizacion.nombre : NOMBRE_ROL.superadmin), salir));
  document.body.prepend(header);
}

/** Mensaje breve arriba de la pantalla (éxito o error). */
export function aviso(texto, tipo = 'ok') {
  let caja = document.getElementById('aviso');
  if (!caja) { caja = el('div', { id: 'aviso', role: 'status', 'aria-live': 'polite' }); document.body.append(caja); }
  caja.className = `aviso ${tipo}`;
  caja.textContent = texto;
  clearTimeout(caja._t);
  caja._t = setTimeout(() => { caja.className = 'aviso'; }, 4000);
}

/** Ejecuta una acción con el botón deshabilitado y muestra el error si falla. */
export async function conBoton(boton, accion) {
  boton.disabled = true;
  try { return await accion(); } catch (e) { aviso(e.message, 'error'); return undefined; } finally { boton.disabled = false; }
}
