// Editores de la configuración comercial (etapas, BANT, categorías).
// Los usan la Configuración de cada organización y las plantillas de rubro de Plataforma.
import { el } from './ui.js';

export const seccion = (titulo, ayuda, ...contenido) => el('section', { class: 'seccion' }, el('h2', {}, titulo), el('p', { class: 'sub' }, ayuda), ...contenido);

export const slug = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30);

/**
 * Devuelve las secciones de edición.
 * config: la configuración actual. editable: si se puede cambiar.
 * guardar(boton, cambios, mensaje): guarda los cambios parciales.
 * prefijo: para que los id no choquen si hay dos editores en la misma página.
 */
export function editorConfig(config, { editable, guardar, prefijo = 'cfg' }) {
  const botonGuardar = (texto, fn) => (editable ? el('div', { class: 'acciones' }, el('button', { type: 'button', onclick: (ev) => fn(ev.currentTarget) }, texto)) : null);
  return [etapas(), bant(), categorias()];

  function etapas() {
    const cuerpo = el('tbody');
    const fila = (e = { codigo: '', nombre: '', probabilidad: 50 }) => {
      const tr = el('tr', { 'data-codigo': e.codigo },
        el('td', {}, el('input', { 'aria-label': 'Nombre de la etapa', value: e.nombre, maxlength: 60, disabled: !editable })),
        el('td', { class: 'num' }, el('input', { 'aria-label': 'Probabilidad de cierre', class: 'num', type: 'number', min: 0, max: 100, step: 1, value: e.probabilidad, disabled: !editable })),
        el('td', { class: 'num' }, editable ? el('button', { type: 'button', class: 'icono', 'aria-label': `Quitar etapa ${e.nombre}`, onclick: () => tr.remove() }, 'Quitar') : null));
      return tr;
    };
    config.etapasPipeline.forEach((e) => cuerpo.append(fila(e)));
    const agregar = editable ? el('button', { type: 'button', class: 'secundario chico', onclick: () => cuerpo.append(fila()) }, 'Agregar etapa') : null;
    return seccion('Etapas del pipeline', 'En orden, de la primera a la última. La probabilidad de cierre no puede bajar de una etapa a la siguiente.',
      el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Etapa'), el('th', { class: 'num' }, 'Probabilidad %'), el('th', {}, ''))), cuerpo)),
      editable ? el('div', { class: 'acciones' }, agregar) : null,
      botonGuardar('Guardar etapas', (b) => {
        const usados = new Set();
        const lista = [...cuerpo.rows].map((tr) => {
          const [nombre, prob] = tr.querySelectorAll('input');
          let codigo = tr.dataset.codigo || slug(nombre.value) || 'etapa';
          if (codigo.length < 2) codigo = `${codigo}_etapa`;
          while (usados.has(codigo)) codigo = `${codigo.slice(0, 27)}_${usados.size}`;
          usados.add(codigo);
          return { codigo, nombre: nombre.value, probabilidad: Number(prob.value) };
        });
        return guardar(b, { etapasPipeline: lista }, 'Etapas guardadas.');
      }));
  }

  function bant() {
    const cuerpo = el('tbody');
    const porcentajes = [];
    const recalcular = () => {
      const pesos = [...cuerpo.querySelectorAll('input')].map((i) => Number(i.value) || 0);
      const total = pesos.reduce((a, b) => a + b, 0);
      pesos.forEach((p, i) => { porcentajes[i].textContent = total ? `${Math.round((p / total) * 100)} %` : '—'; });
    };
    config.criteriosBANT.forEach((c) => {
      const pct = el('td', { class: 'num suave' });
      porcentajes.push(pct);
      cuerpo.append(el('tr', { 'data-codigo': c.codigo },
        el('td', {}, el('strong', {}, c.nombre), el('div', { class: 'suave' }, c.descripcion)),
        el('td', { class: 'num' }, el('input', { 'aria-label': `Peso de ${c.nombre}`, class: 'num', type: 'number', min: 0, max: 10, step: 1, value: c.peso, disabled: !editable, oninput: recalcular })),
        pct));
    });
    recalcular();
    return seccion('Criterios BANT', 'Peso de cada criterio en el score del lead (0 a 10). La columna de la derecha muestra cuánto pesa cada uno sobre el total.',
      el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Criterio'), el('th', { class: 'num' }, 'Peso'), el('th', { class: 'num' }, 'Incidencia'))), cuerpo)),
      botonGuardar('Guardar pesos', (b) => {
        const criterios = config.criteriosBANT.map((c, i) => ({ ...c, peso: Number(cuerpo.rows[i].querySelector('input').value) }));
        return guardar(b, { criteriosBANT: criterios }, 'Pesos BANT guardados.');
      }));
  }

  function categorias() {
    const area = (id, valores) => el('textarea', { id, disabled: !editable, rows: Math.max(6, valores.length + 1) }, valores.join('\n'));
    const negocio = area(`${prefijo}-cat-negocio`, config.categoriasNegocio);
    const producto = area(`${prefijo}-cat-producto`, config.categoriasProducto);
    const lineas = (t) => t.value.split('\n').map((x) => x.trim()).filter(Boolean);
    return seccion('Categorías', 'Una por línea. Sirven para clasificar clientes y productos, y para los análisis de tendencias.',
      el('div', { class: 'grilla dos' },
        el('div', {}, el('label', { for: negocio.id }, 'Tipos de cliente'), negocio),
        el('div', {}, el('label', { for: producto.id }, 'Categorías de producto'), producto)),
      botonGuardar('Guardar categorías', (b) => guardar(b, { categoriasNegocio: lineas(negocio), categoriasProducto: lineas(producto) }, 'Categorías guardadas.')));
  }
}
