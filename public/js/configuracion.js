// Configuración comercial de la organización. Admin y consultor la editan; vendedor y lectura la consultan.
import { el, poner, vaciar, sesion, barra, aviso, conBoton } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) location.replace('/clientes');
barra(s, '/configuracion');

const puedeEditar = ['admin', 'consultor'].includes(s.usuario.rol);
const esAdmin = s.usuario.rol === 'admin';
const app = document.getElementById('app');

let datos;

async function dibujar() {
  datos = await api('GET', '/organizacion/config');
  const vertical = await api('GET', `/verticales/${datos.verticalCodigo}`).catch(() => null);
  poner(vaciar(app), 
    el('h1', {}, 'Configuración comercial'),
    el('p', { class: 'sub' }, `${s.organizacion.nombre} · rubro ${vertical?.nombre || datos.verticalCodigo}. `,
      puedeEditar ? 'Los cambios valen solo para tu organización.' : 'Solo lectura: los cambios los hace el administrador o el consultor.'),
    seccionEtapas(),
    seccionBANT(),
    seccionCategorias(),
    seccionGuiones(),
    seccionEmails(),
    seccionKPIs(),
    esAdmin ? seccionRestaurar(vertical) : null,
  );
}

async function guardar(boton, cambios, mensaje) {
  await conBoton(boton, async () => {
    await api('PATCH', '/organizacion/config', cambios);
    aviso(mensaje);
    await dibujar();
  });
}

const seccion = (titulo, ayuda, ...contenido) => el('section', { class: 'seccion' }, el('h2', {}, titulo), el('p', { class: 'sub' }, ayuda), ...contenido);
const botonGuardar = (texto, fn) => (puedeEditar ? el('div', { class: 'acciones' }, el('button', { type: 'button', onclick: (ev) => fn(ev.currentTarget) }, texto)) : null);
const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);

// ---------- Etapas ----------
function seccionEtapas() {
  const cuerpo = el('tbody');
  const fila = (e = { codigo: '', nombre: '', probabilidad: 50 }) => {
    const tr = el('tr', { 'data-codigo': e.codigo },
      el('td', {}, el('input', { 'aria-label': 'Nombre de la etapa', value: e.nombre, maxlength: 60, disabled: !puedeEditar })),
      el('td', { class: 'num' }, el('input', { 'aria-label': 'Probabilidad de cierre', class: 'num', type: 'number', min: 0, max: 100, step: 1, value: e.probabilidad, disabled: !puedeEditar })),
      el('td', { class: 'num' }, puedeEditar ? el('button', { type: 'button', class: 'icono', 'aria-label': `Quitar etapa ${e.nombre}`, onclick: () => tr.remove() }, 'Quitar') : null));
    return tr;
  };
  datos.config.etapasPipeline.forEach((e) => cuerpo.append(fila(e)));
  const agregar = puedeEditar ? el('button', { type: 'button', class: 'secundario chico', onclick: () => cuerpo.append(fila()) }, 'Agregar etapa') : null;
  return seccion('Etapas del pipeline', 'En orden, de la primera a la última. La probabilidad de cierre no puede bajar de una etapa a la siguiente.',
    el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Etapa'), el('th', { class: 'num' }, 'Probabilidad %'), el('th', {}, ''))), cuerpo)),
    puedeEditar ? el('div', { class: 'acciones' }, agregar) : null,
    botonGuardar('Guardar etapas', (b) => {
      const usados = new Set();
      const etapas = [...cuerpo.rows].map((tr) => {
        const [nombre, prob] = tr.querySelectorAll('input');
        let codigo = tr.dataset.codigo || slug(nombre.value) || 'etapa';
        if (codigo.length < 2) codigo = `${codigo}_etapa`;
        while (usados.has(codigo)) codigo = `${codigo.slice(0, 27)}_${usados.size}`;
        usados.add(codigo);
        return { codigo, nombre: nombre.value, probabilidad: Number(prob.value) };
      });
      return guardar(b, { etapasPipeline: etapas }, 'Etapas guardadas.');
    }));
}

// ---------- BANT ----------
function seccionBANT() {
  const cuerpo = el('tbody');
  const porcentajes = [];
  const recalcular = () => {
    const pesos = [...cuerpo.querySelectorAll('input')].map((i) => Number(i.value) || 0);
    const total = pesos.reduce((a, b) => a + b, 0);
    pesos.forEach((p, i) => { porcentajes[i].textContent = total ? `${Math.round((p / total) * 100)} %` : '—'; });
  };
  datos.config.criteriosBANT.forEach((c) => {
    const pct = el('td', { class: 'num suave' });
    porcentajes.push(pct);
    cuerpo.append(el('tr', { 'data-codigo': c.codigo },
      el('td', {}, el('strong', {}, c.nombre), el('div', { class: 'suave' }, c.descripcion)),
      el('td', { class: 'num' }, el('input', { 'aria-label': `Peso de ${c.nombre}`, class: 'num', type: 'number', min: 0, max: 10, step: 1, value: c.peso, disabled: !puedeEditar, oninput: recalcular })),
      pct));
  });
  recalcular();
  return seccion('Criterios BANT', 'Peso de cada criterio en el score del lead (0 a 10). La columna de la derecha muestra cuánto pesa cada uno sobre el total.',
    el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Criterio'), el('th', { class: 'num' }, 'Peso'), el('th', { class: 'num' }, 'Incidencia'))), cuerpo)),
    botonGuardar('Guardar pesos', (b) => {
      const criterios = datos.config.criteriosBANT.map((c, i) => ({ ...c, peso: Number(cuerpo.rows[i].querySelector('input').value) }));
      return guardar(b, { criteriosBANT: criterios }, 'Pesos BANT guardados.');
    }));
}

// ---------- Categorías ----------
function seccionCategorias() {
  const area = (id, valores) => el('textarea', { id, disabled: !puedeEditar, rows: Math.max(6, valores.length + 1) }, valores.join('\n'));
  const negocio = area('cat-negocio', datos.config.categoriasNegocio);
  const producto = area('cat-producto', datos.config.categoriasProducto);
  const lineas = (t) => t.value.split('\n').map((x) => x.trim()).filter(Boolean);
  return seccion('Categorías', 'Una por línea. Sirven para clasificar clientes y productos, y para los análisis de tendencias.',
    el('div', { class: 'grilla dos' },
      el('div', {}, el('label', { for: 'cat-negocio' }, 'Tipos de cliente'), negocio),
      el('div', {}, el('label', { for: 'cat-producto' }, 'Categorías de producto'), producto)),
    botonGuardar('Guardar categorías', (b) => guardar(b, { categoriasNegocio: lineas(negocio), categoriasProducto: lineas(producto) }, 'Categorías guardadas.')));
}

// ---------- Guiones, emails y KPIs (consulta) ----------
function seccionGuiones() {
  const lista = datos.config.scriptsVisita;
  return seccion('Guiones de visita', 'Pasos sugeridos para cada tipo de visita. La edición llega con el módulo de actividades.',
    lista.length ? lista.map((g) => el('details', {}, el('summary', {}, g.titulo), el('ol', { class: 'pasos' }, g.pasos.map((p) => el('li', {}, p)))))
      : el('p', { class: 'vacio' }, 'Sin guiones cargados.'));
}

function seccionEmails() {
  const lista = datos.config.templatesEmail;
  return seccion('Plantillas de email', 'Las palabras entre llaves dobles se reemplazan por los datos del contacto al enviar.',
    lista.length ? lista.map((t) => el('details', {}, el('summary', {}, t.asunto),
      el('pre', { class: 'email' }, t.cuerpo),
      el('div', { class: 'chips' }, t.variables.map((v) => el('span', { class: 'chip' }, `{{${v}}}`)))))
      : el('p', { class: 'vacio' }, 'Sin plantillas cargadas.'));
}

function seccionKPIs() {
  return seccion('Indicadores (KPIs)', 'Se calculan en el dashboard a partir de las ventas y oportunidades registradas.',
    el('div', { class: 'tabla-scroll' }, el('table', {}, el('tbody', {}, datos.config.kpiConfig.map((k) => el('tr', {}, el('td', {}, el('strong', {}, k.nombre)), el('td', { class: 'suave' }, k.descripcion)))))));
}

// ---------- Restaurar ----------
function seccionRestaurar(vertical) {
  const boton = el('button', { type: 'button', class: 'peligro' }, 'Restaurar desde la plantilla');
  boton.addEventListener('click', () => {
    if (!confirm('Se van a perder todos los ajustes propios y se vuelve a la configuración original del rubro. ¿Continuar?')) return;
    conBoton(boton, async () => {
      await api('POST', '/organizacion/config/restaurar');
      aviso('Configuración restaurada desde la plantilla.');
      await dibujar();
    });
  });
  return seccion('Restaurar configuración', `Vuelve a copiar la configuración original de ${vertical?.nombre || 'tu rubro'}. Solo el administrador puede hacerlo.`,
    el('div', { class: 'acciones' }, boton));
}

// Al final: las funciones y constantes de arriba ya están definidas.
await dibujar();
