// Asistente de importación de contactos desde CSV: 1) archivo  2) columnas  3) resultado.
import { el, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!['admin', 'consultor'].includes(s.usuario.rol)) location.replace('/contactos');
barra(s, '/contactos');

const app = vaciar(document.getElementById('app'));
const pasos = el('ol', { class: 'pasos-asistente' }, ['1. Archivo', '2. Columnas', '3. Resultado'].map((t) => el('li', {}, t)));
const cuerpo = el('section', { class: 'seccion' });
poner(app, el('a', { href: '/contactos', class: 'suave' }, '← Contactos'), el('h1', {}, 'Importar contactos'),
  el('p', { class: 'sub' }, 'Desde un CSV exportado de Excel, Google Sheets, HubSpot o Zoho. Hasta 5000 filas por archivo.'), pasos, cuerpo);
const marcarPaso = (n) => [...pasos.children].forEach((li, i) => li.classList.toggle('actual', i === n - 1));

let csv = '';
let opciones;

/** Lee el archivo como UTF-8; si no lo es (CSV guardado por Excel en Windows), usa Windows-1252 para no romper los acentos. */
async function leerArchivo(archivo) {
  const buf = await archivo.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); }
}

// ---------- Paso 1 ----------
function paso1() {
  marcarPaso(1);
  const archivo = el('input', { id: 'archivo', type: 'file', accept: '.csv,text/csv,.txt' });
  const seguir = el('button', { type: 'button', disabled: true }, 'Continuar');
  archivo.addEventListener('change', () => { seguir.disabled = !archivo.files.length; });
  seguir.addEventListener('click', () => conBoton(seguir, async () => {
    const f = archivo.files[0];
    if (f.size > 5 * 1024 * 1024) throw new Error('El archivo pesa más de 5 MB. Dividilo en partes.');
    csv = await leerArchivo(f);
    const prev = await api('POST', '/crm/importar/previsualizar', { csv });
    if (!opciones) opciones = await api('GET', '/crm/contactos/opciones');
    paso2(prev, f.name);
  }));
  poner(vaciar(cuerpo), el('h2', {}, 'Elegí el archivo'),
    el('p', { class: 'sub' }, 'La primera fila tiene que tener los nombres de las columnas. Si lo guardás desde Excel, elegí "CSV (delimitado por comas)" o "CSV UTF-8".'),
    campo('Archivo CSV', archivo), el('div', { class: 'acciones' }, seguir));
}

// ---------- Paso 2 ----------
function paso2(prev, nombreArchivo) {
  marcarPaso(2);
  const selects = {};
  const filas = prev.columnas.map((col, j) => {
    selects[col] = selector({ 'aria-label': `Campo para la columna ${col}` }, [['', 'No importar'], ...prev.campos.map((c) => [c.codigo, c.etiqueta])], prev.mapeo[col]);
    const ejemplo = prev.muestra.map((f) => f[j]).find((v) => v) || '';
    return el('tr', {}, el('td', {}, el('strong', {}, col)), el('td', { class: 'suave' }, ejemplo.slice(0, 60)), el('td', {}, selects[col]));
  });
  const duplicados = el('div', { class: 'radios' },
    el('label', {}, el('input', { type: 'radio', name: 'dup', value: 'omitir', checked: true }), 'Omitir los que ya existen'),
    el('label', {}, el('input', { type: 'radio', name: 'dup', value: 'actualizar' }), 'Completar sus datos con los del archivo'));
  const owner = selector({ id: 'imp-owner' }, [['', 'Sin asignar'], ...opciones.vendedores.map((v) => [v._id, v.nombre])]);
  const etiqueta = el('input', { id: 'imp-etiqueta', maxlength: 40, value: nombreArchivo.replace(/\.[^.]+$/, '').slice(0, 40) });
  const importar = el('button', { type: 'button' }, `Importar ${prev.total} filas`);
  const volver = el('button', { type: 'button', class: 'secundario', onclick: paso1 }, 'Elegir otro archivo');
  importar.addEventListener('click', () => conBoton(importar, async () => {
    const mapeo = Object.fromEntries(Object.entries(selects).map(([col, sel]) => [col, sel.value]));
    importar.textContent = 'Importando…';
    const r = await api('POST', '/crm/importar', { csv, mapeo, opciones: { duplicados: duplicados.querySelector('input:checked').value, owner: owner.value || undefined, etiqueta: etiqueta.value } });
    paso3(r);
  }).finally(() => { importar.textContent = `Importar ${prev.total} filas`; }));

  poner(vaciar(cuerpo), el('h2', {}, 'Revisá las columnas'),
    el('p', { class: 'sub' }, `${nombreArchivo}: ${prev.total} filas, separadas por ${prev.separador}. Las columnas ya vienen sugeridas; corregí las que hagan falta. Hace falta al menos el nombre o la empresa.`),
    el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Columna del archivo'), el('th', {}, 'Ejemplo'), el('th', {}, 'Se carga como'))), el('tbody', {}, filas))),
    el('h3', { class: 'sub' }, 'Opciones'),
    el('p', { class: 'suave' }, 'Un contacto ya existe si coincide el email o el teléfono.'), duplicados,
    el('div', { class: 'campos' }, campo('Asignar todos a', owner), campo('Etiqueta para este lote', etiqueta, 'Sirve para encontrarlos después o deshacer la carga.')),
    el('p', { class: 'suave' }, 'Si un tipo de cliente del archivo no existe en tu configuración, se guarda como etiqueta.'),
    el('div', { class: 'acciones' }, importar, volver));
}

// ---------- Paso 3 ----------
function paso3(r) {
  marcarPaso(3);
  const caja = (n, t) => el('div', {}, el('strong', {}, String(n)), el('span', { class: 'suave' }, t));
  poner(vaciar(cuerpo), el('h2', {}, 'Importación terminada'),
    el('div', { class: 'resumen-num' }, caja(r.creados, 'contactos nuevos'), caja(r.actualizados, 'actualizados'), caja(r.omitidos, 'ya existían'), caja(r.empresasCreadas, 'empresas nuevas'), caja(r.errores.length, 'filas con error')),
    r.advertencias ? el('p', { class: 'suave' }, `${r.advertencias} contacto(s) tenían un tipo de cliente que no está en tu configuración: quedó como etiqueta.`) : null,
    r.errores.length ? el('div', {}, el('h3', { class: 'sub' }, 'Filas que no se cargaron'),
      el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, el('th', {}, 'Fila'), el('th', {}, 'Motivo'))),
        el('tbody', {}, r.errores.map((e) => el('tr', {}, el('td', {}, String(e.fila)), el('td', {}, e.motivo))))))) : null,
    el('div', { class: 'acciones' }, el('a', { class: 'boton', href: '/contactos' }, 'Ver contactos'), el('button', { type: 'button', class: 'secundario', onclick: paso1 }, 'Importar otro archivo')));
  aviso(`Listo: ${r.creados} contactos nuevos.`);
}

paso1();
