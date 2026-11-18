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
/** Redirige y corta la ejecución de la página (no sigue pidiendo datos que no corresponden). */
export const irA = (url) => { location.replace(url); return new Promise(() => {}); };

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
// Íconos de línea propios (24 × 24, trazo 1.8). Se dibujan con SVG para no depender de librerías.
const ICONOS = {
  inicio: 'M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z',
  contactos: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.5 3.5 0 0 1 0 6.5m2.5 3.6c1.6.8 2.5 2.4 2.5 4.4',
  pipeline: 'M4 5h4v14H4zm6 0h4v9h-4zm6 0h4v5h-4z',
  tareas: 'M9 6h11M9 12h11M9 18h11M4 5.5l1 1 2-2M4 11.5l1 1 2-2M4 17.5l1 1 2-2',
  empresas: 'M4 21V7l6-3v17m0 0h10V10l-6-2v13M7 9h.01M7 13h.01M7 17h.01M17 13h.01M17 17h.01',
  plan: 'M8 4h8v3H8zM6 5.5H5a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6.5a1 1 0 0 0-1-1h-1M8 12h8m-8 4h5',
  configuracion: 'M4 7h10m4 0h2M4 17h4m4 0h8M16 5v4M10 15v4',
  clientes: 'M4 8h16v12H4zM9 8V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 13h16',
  plataforma: 'M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z',
  menu: 'M4 7h16M4 12h16M4 17h16',
};
export function icono(nombre) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONOS[nombre] || '');
  for (const [k, v] of [['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '1.8'], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round']]) p.setAttribute(k, v);
  svg.append(p);
  return svg;
}

/** Iniciales para los círculos de persona: "Diego Vendedor" → "DV". */
export const iniciales = (nombre = '') => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '·';

/** Menú lateral con la marca, las secciones según el rol, el selector de cliente (consultor) y la salida. */
export function barra({ usuario, organizacion, esSuperadmin }, activa = '') {
  const links = [];
  if (organizacion) {
    links.push(['/inicio', 'Inicio', 'inicio'], ['/contactos', 'Contactos', 'contactos'], ['/pipeline', 'Pipeline', 'pipeline'], ['/tareas', 'Tareas', 'tareas'],
      ['/empresas', 'Empresas', 'empresas'], ['/plan', 'Plan de trabajo', 'plan'], ['/configuracion', 'Configuración', 'configuracion']);
  }
  if (esSuperadmin) {
    if (links.length) links.push(null);
    links.push(['/clientes', 'Mis clientes', 'clientes'], ['/plataforma', 'Plataforma', 'plataforma']);
  }
  const nav = el('nav', { 'aria-label': 'Secciones' }, links.map((l) => (l
    ? el('a', { href: l[0], class: l[0] === activa ? 'activo' : '', 'aria-current': l[0] === activa ? 'page' : false }, icono(l[2]), l[1])
    : el('div', { class: 'separador', role: 'separator' }))));

  const salir = el('button', { type: 'button', onclick: async () => { await api('POST', '/auth/logout').catch(() => {}); location.replace('/'); } }, 'Cerrar sesión');
  let selector = null;
  if (esSuperadmin) {
    const sel = el('select', { id: 'selector-cliente', class: 'selector-org' }, el('option', { value: '' }, 'Ninguno (plataforma)'));
    api('GET', '/organizaciones').then((orgs) => {
      sel.append(...orgs.map((o) => el('option', { value: o._id }, `${o.nombre}${o.activa ? '' : ' (suspendida)'}`)));
      sel.value = organizacion?._id || '';
    }).catch(() => {});
    sel.addEventListener('change', async () => {
      await api('POST', '/auth/organizacion', { organizacionId: sel.value || null });
      location.href = sel.value ? '/inicio' : '/clientes';
    });
    selector = [el('label', { for: 'selector-cliente' }, 'Cliente en el que trabajás'), sel];
  }
  const donde = organizacion ? organizacion.nombre : 'Revoluxia';
  const lateral = el('aside', { class: 'lateral', id: 'menu-lateral', 'aria-label': 'Menú' },
    el('a', { href: organizacion ? '/inicio' : '/clientes', class: 'marca' },
      el('img', { src: '/img/revoluxia-isotipo-claro.png', alt: '' }),
      el('span', {}, el('strong', {}, 'LeadFlow'), el('span', {}, 'por Revoluxia'))),
    nav,
    el('div', { class: 'pie-lateral' },
      el('div', { class: 'quien' }, usuario.nombre),
      el('div', { class: 'donde' }, esSuperadmin ? 'Consultor' : `${NOMBRE_ROL[usuario.rol]} en ${donde}`),
      selector, salir));

  const abrir = el('button', { type: 'button', 'aria-label': 'Abrir menú', 'aria-controls': 'menu-lateral', 'aria-expanded': 'false' }, icono('menu'));
  const cerrar = () => { document.body.classList.remove('menu-abierto'); abrir.setAttribute('aria-expanded', 'false'); };
  abrir.addEventListener('click', () => { document.body.classList.add('menu-abierto'); abrir.setAttribute('aria-expanded', 'true'); });
  const movil = el('header', { class: 'barra-movil' }, abrir, el('img', { src: '/img/revoluxia-isotipo-claro.png', alt: '' }), el('strong', {}, 'LeadFlow'), el('span', { class: 'donde' }, donde));
  const velo = el('div', { class: 'velo', onclick: cerrar });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') cerrar(); });
  document.body.classList.add('con-lateral');
  document.body.prepend(lateral, movil, velo);
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

// ---------- Fechas para tareas ----------
const DIA_AR = (d) => new Date(new Date(d).getTime() - 3 * 3600e3).toISOString().slice(0, 10);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Recuadro de fecha: número grande y mes; rojo si venció, ámbar si es hoy. */
export function fechaTarea(fechaVencimiento, { hecha = false } = {}) {
  if (!fechaVencimiento) return el('div', { class: 'fecha-tarea sin', 'aria-label': 'Sin fecha' }, 'sin fecha');
  const iso = DIA_AR(fechaVencimiento);
  const hoy = DIA_AR(new Date());
  const [y, m, d] = iso.split('-').map(Number);
  const dia = DIAS.at(new Date(Date.UTC(y, m - 1, d)).getUTCDay());
  const clase = hecha ? '' : iso < hoy ? ' vencida' : iso === hoy ? ' hoy' : '';
  const etiqueta = clase === ' hoy' ? 'hoy' : clase === ' vencida' ? `${dia} · vencida` : dia;
  return el('div', { class: `fecha-tarea${clase}`, title: new Date(fechaVencimiento).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'full' }) },
    el('span', { class: 'dia' }, String(d)), el('span', { class: 'mes' }, `${MESES.at(m - 1)} · ${etiqueta.split(' · ')[0]}`));
}

/** Fila de tarea reutilizable (Inicio, Tareas, ficha del contacto). */
export function filaTarea(t, { hecha = false, responsable = null, alCambiar = null, puedeMarcar = true } = {}) {
  const check = el('input', { type: 'checkbox', 'aria-label': `${hecha ? 'Reabrir' : 'Completar'} ${t.titulo}`, checked: hecha, disabled: !puedeMarcar || !alCambiar || (!hecha && t.bloqueadaPor?.length > 0) });
  if (alCambiar) check.addEventListener('change', () => alCambiar(t, check));
  const detalle = [];
  if (responsable) detalle.push(el('span', { class: 'iniciales', title: responsable }, iniciales(responsable)));
  if (t.contactoId) detalle.push(el('a', { href: `/contacto?id=${t.contactoId}` }, t.contactoNombre || 'Ver contacto'));
  return el('li', { class: hecha ? 'hecha' : '' },
    el('span', { class: `prioridad ${t.prioridad || ''}`, title: `Prioridad ${t.prioridad || 'media'}` }),
    fechaTarea(t.fechaVencimiento, { hecha }), check,
    el('div', { class: 'info' }, el('strong', {}, t.titulo),
      detalle.length ? el('div', { class: 'persona chico-texto' }, ...detalle) : null,
      t.bloqueadaPor?.length ? el('div', { class: 'bloqueo' }, `Espera a: ${t.bloqueadaPor.map((b) => b.titulo).join(', ')}`) : null),
    hecha || !['alta', 'critica'].includes(t.prioridad) ? null : el('span', { class: `etiqueta ${t.prioridad}` }, PRIORIDAD[t.prioridad]));
}

/** Tonos del color de marca para las etapas del pipeline (de oscuro a claro). */
export const tonoEtapa = (i, total) => `hsl(204 52% ${Math.round(20 + (i * 44) / Math.max(1, total - 1))}%)`;
