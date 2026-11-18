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

/** Agrega hijos a un nodo ignorando null, undefined y false (para secciones que se muestran según el rol). */
export function poner(nodo, ...hijos) {
  for (const h of hijos.flat()) if (h !== null && h !== undefined && h !== false) nodo.append(h);
  return nodo;
}

export const ETAPA = { lead: 'Lead', calificado: 'Calificado', oportunidad: 'Oportunidad', cliente: 'Cliente', fidelizado: 'Fidelizado' };

/** Lee parámetros de la URL actual. */
export const parametro = (n) => new URLSearchParams(location.search).get(n);

/** Campo con etiqueta para formularios. */
export const campo = (etiqueta, input, ayuda) => el('div', { class: 'campo' }, el('label', { for: input.id }, etiqueta), input, ayuda ? el('div', { class: 'suave chico-texto' }, ayuda) : null);

/** <select> a partir de pares [valor, texto]. */
export const selector = (attrs, opciones, valor = '') => {
  const s = el('select', attrs, opciones.map(([v, t]) => el('option', { value: v }, t)));
  s.value = valor ?? '';
  return s;
};

const formatoMoneda = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
export const moneda = (n) => formatoMoneda.format(n || 0);
export const fechaHora = (d) => (d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
/** Fecha para un <input type="date"> (AAAA-MM-DD en hora argentina). */
export const fechaInput = (d) => (d ? new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10) : '');
export const TIPO_ACTIVIDAD = { llamada: 'Llamada', email: 'Email', reunion: 'Reunión', visita: 'Visita', whatsapp: 'WhatsApp', nota: 'Nota' };
export const RESULTADO = { positivo: 'Positivo', neutro: 'Neutro', negativo: 'Negativo', sin_respuesta: 'Sin respuesta' };
export const PRIORIDAD = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };

export const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—');

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
export function barra({ usuario, organizacion, esSuperadmin }, activa = '') {
  const links = [['/inicio', 'Inicio']];
  if (esSuperadmin) links.push(['/clientes', 'Mis clientes']);
  if (organizacion) links.push(['/contactos', 'Contactos'], ['/pipeline', 'Pipeline'], ['/tareas', 'Tareas'], ['/empresas', 'Empresas'], ['/plan', 'Plan'], ['/configuracion', 'Configuración']);
  else if (esSuperadmin) links.push(['/plataforma', 'Plataforma']);
  const nav = el('nav', { class: 'nav', 'aria-label': 'Secciones' },
    links.map(([href, texto]) => el('a', { href, class: href === activa ? 'activo' : '', 'aria-current': href === activa ? 'page' : false }, texto)));
  const salir = el('button', { type: 'button', class: 'secundario chico', onclick: async () => { await api('POST', '/auth/logout').catch(() => {}); location.replace('/'); } }, 'Salir');

  // El consultor (superadmin) elige en qué cliente trabajar sin cerrar sesión.
  let ubicacion = el('span', { class: 'suave' }, organizacion ? organizacion.nombre : NOMBRE_ROL.superadmin);
  if (esSuperadmin) {
    const sel = el('select', { class: 'selector-org', 'aria-label': 'Cliente en el que trabajás' }, el('option', { value: '' }, 'Plataforma (todos)'));
    api('GET', '/organizaciones').then((orgs) => {
      sel.append(...orgs.map((o) => el('option', { value: o._id }, `${o.nombre}${o.activa ? '' : ' (suspendida)'}`)));
      sel.value = organizacion?._id || '';
    }).catch(() => {});
    sel.addEventListener('change', async () => {
      await api('POST', '/auth/organizacion', { organizacionId: sel.value || null });
      location.href = sel.value ? '/inicio' : '/clientes';
    });
    ubicacion = el('label', { class: 'suave chico-texto', title: 'Consultor externo: Revoluxia' }, 'Cliente ', sel);
  }
  const header = el('header', { class: 'barra' },
    el('a', { href: '/inicio', class: 'marca', 'aria-label': 'LeadFlow CRM, inicio' },
      el('img', { class: 'logo-isotipo solo-claro', src: '/img/revoluxia-isotipo.png', alt: '' }),
      el('img', { class: 'logo-isotipo solo-oscuro', src: '/img/revoluxia-isotipo-claro.png', alt: '' }),
      el('span', {}, el('span', { class: 'producto' }, 'LeadFlow CRM'), el('span', { class: 'empresa' }, 'Revoluxia · soluciones tecnológicas'))),
    nav,
    el('div', { class: 'usuario' }, el('span', {}, esSuperadmin ? `${usuario.nombre} · consultor` : usuario.nombre), ubicacion, salir));
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

/** Buscador de contactos: escribís y elegís de la lista. Devuelve { nodo, valor() , limpiar() }. */
export function buscadorContacto({ id = 'buscar-contacto', etiqueta = 'Contacto' } = {}) {
  let elegido = null;
  const input = el('input', { id, type: 'search', placeholder: 'Escribí nombre, empresa o teléfono…', autocomplete: 'off' });
  const lista = el('div', { class: 'resultados oculto', role: 'listbox' });
  let espera;
  input.addEventListener('input', () => {
    elegido = null;
    clearTimeout(espera);
    const q = input.value.trim();
    if (q.length < 2) { lista.classList.add('oculto'); return; }
    espera = setTimeout(async () => {
      const r = await api('GET', `/crm/contactos?porPagina=8&q=${encodeURIComponent(q)}`).catch(() => ({ items: [] }));
      vaciar(lista).append(...(r.items.length ? r.items.map((c) => {
        const texto = [c.nombre, c.apellido].filter(Boolean).join(' ') + (c.empresaNombre ? ` · ${c.empresaNombre}` : '');
        return el('button', { type: 'button', role: 'option', onclick: () => { elegido = c; input.value = texto; lista.classList.add('oculto'); } }, texto);
      }) : [el('div', { class: 'vacio' }, 'Sin resultados.')]));
      lista.classList.remove('oculto');
    }, 250);
  });
  return {
    nodo: el('div', { class: 'campo buscador-contacto' }, el('label', { for: id }, etiqueta), input, lista),
    valor: () => elegido,
    limpiar: () => { elegido = null; input.value = ''; lista.classList.add('oculto'); },
  };
}
