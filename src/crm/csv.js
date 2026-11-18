// Lectura y escritura de CSV sin dependencias.
// Soporta: separador "," ";" o tabulación (se detecta solo), comillas dobles con saltos de línea y comillas escapadas,
// BOM de Excel y finales de línea Windows / Unix.
import { normalizar } from './comun.js';

function detectarSeparador(texto) {
  const primeraLinea = texto.slice(0, texto.search(/\r?\n|$/));
  const cuenta = (c) => primeraLinea.split(c).length - 1;
  const candidatos = [[';', cuenta(';')], [',', cuenta(',')], ['\t', cuenta('\t')]];
  candidatos.sort((a, b) => b[1] - a[1]);
  return candidatos[0][1] > 0 ? candidatos[0][0] : ',';
}

/** Devuelve { columnas: [...], filas: [[...], ...], separador }. Ignora filas totalmente vacías. */
export function leerCSV(texto, { maxFilas = 5000 } = {}) {
  if (typeof texto !== 'string') throw new Error('El archivo no es texto.');
  let t = texto.replace(/^\uFEFF/, '');
  const sep = detectarSeparador(t);
  const filas = [];
  let fila = [], campo = '', comillas = false, i = 0;
  const cerrarCampo = () => { fila.push(campo); campo = ''; };
  const cerrarFila = () => {
    cerrarCampo();
    if (fila.some((c) => c.trim() !== '')) filas.push(fila);
    fila = [];
    if (filas.length > maxFilas + 1) throw new Error(`El archivo tiene más de ${maxFilas} filas. Dividilo en partes.`);
  };
  while (i < t.length) {
    const ch = t[i];
    if (comillas) {
      if (ch === '"') {
        if (t[i + 1] === '"') { campo += '"'; i += 2; continue; }
        comillas = false; i += 1; continue;
      }
      campo += ch; i += 1; continue;
    }
    if (ch === '"' && campo === '') { comillas = true; i += 1; continue; }
    if (ch === sep) { cerrarCampo(); i += 1; continue; }
    if (ch === '\r') { i += 1; continue; }
    if (ch === '\n') { cerrarFila(); i += 1; continue; }
    campo += ch; i += 1;
  }
  if (campo !== '' || fila.length) cerrarFila();
  if (!filas.length) throw new Error('El archivo está vacío.');
  const columnas = filas[0].map((c, j) => c.trim() || `Columna ${j + 1}`);
  return { columnas, filas: filas.slice(1).map((f) => columnas.map((_, j) => (f[j] ?? '').trim())), separador: sep };
}

// Celdas que Excel interpretaría como fórmula: se les antepone un apóstrofo (inyección de fórmulas en CSV).
const PELIGROSO = /^[=+\-@\t\r]/;

/** Arma un CSV con ";" (lo que Excel en español abre directo) y BOM para que respete los acentos. */
export function escribirCSV(columnas, filas) {
  const celda = (v) => {
    let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
    if (typeof v === 'string' && PELIGROSO.test(s)) s = `'${s}`; // los números (p. ej. latitud negativa) quedan tal cual
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\uFEFF' + [columnas, ...filas].map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n';
}

// ---------- Mapeo de columnas ----------

/** Campos del contacto que se pueden importar, con los encabezados que suelen usar HubSpot, Zoho, Excel o Google. */
export const CAMPOS_IMPORTABLES = {
  nombre: { etiqueta: 'Nombre', alias: ['nombre', 'first name', 'firstname', 'nombres', 'name', 'contacto', 'nombre del contacto', 'full name', 'nombre completo'] },
  apellido: { etiqueta: 'Apellido', alias: ['apellido', 'last name', 'lastname', 'apellidos', 'surname'] },
  email: { etiqueta: 'Email', alias: ['email', 'e-mail', 'mail', 'correo', 'correo electronico', 'email address', 'direccion de correo'] },
  telefono: { etiqueta: 'Teléfono', alias: ['telefono', 'phone', 'phone number', 'celular', 'movil', 'mobile', 'mobile phone', 'whatsapp', 'tel'] },
  cargo: { etiqueta: 'Cargo', alias: ['cargo', 'job title', 'title', 'puesto', 'rol'] },
  empresa: { etiqueta: 'Empresa', alias: ['empresa', 'company', 'company name', 'razon social', 'comercio', 'negocio', 'account name', 'nombre de la empresa', 'local', 'establecimiento', 'nombre del comercio', 'nombre del local', 'fantasia', 'nombre de fantasia'] },
  cuit: { etiqueta: 'CUIT de la empresa', alias: ['cuit', 'cuil', 'tax id'] },
  segmento: { etiqueta: 'Tipo de cliente', alias: ['segmento', 'tipo', 'tipo de cliente', 'rubro', 'categoria', 'industry', 'industria', 'tipo de comercio'] },
  direccion: { etiqueta: 'Dirección', alias: ['direccion', 'address', 'street address', 'domicilio', 'calle'] },
  municipio: { etiqueta: 'Municipio / partido', alias: ['municipio', 'partido', 'departamento', 'state', 'provincia'] },
  localidad: { etiqueta: 'Localidad / ciudad', alias: ['localidad', 'ciudad', 'city', 'barrio'] },
  lat: { etiqueta: 'Latitud', alias: ['lat', 'latitud', 'latitude'] },
  lng: { etiqueta: 'Longitud', alias: ['lng', 'lon', 'long', 'longitud', 'longitude'] },
  lifecycleStage: { etiqueta: 'Etapa del contacto', alias: ['lifecycle stage', 'etapa', 'estado', 'etapa del ciclo de vida'] },
  etiquetas: { etiqueta: 'Etiquetas (separadas por coma)', alias: ['etiquetas', 'tags', 'labels'] },
  notas: { etiqueta: 'Notas', alias: ['notas', 'notes', 'observaciones', 'comentarios', 'descripcion'] },
};

/**
 * Sugiere qué campo corresponde a cada columna del archivo. Devuelve { "Columna del archivo": "campo" | "" }.
 * Primero busca coincidencias exactas; después, para las columnas que quedan, la palabra clave más específica
 * contenida en el encabezado ("Nombre del comercio" → empresa, porque "comercio" es más largo que "nombre").
 */
export function sugerirMapeo(columnas) {
  const usados = new Set();
  const r = Object.fromEntries(columnas.map((c) => [c, '']));
  const limpio = (col) => ` ${normalizar(col).replace(/[_.\-/()]/g, ' ').replace(/\s+/g, ' ')} `;
  for (const col of columnas) {
    const n = limpio(col).trim();
    const campo = Object.entries(CAMPOS_IMPORTABLES).find(([k, def]) => !usados.has(k) && def.alias.includes(n))?.[0];
    if (campo) { usados.add(campo); r[col] = campo; }
  }
  for (const col of columnas) {
    if (r[col]) continue;
    const n = limpio(col);
    let mejor = null;
    for (const [k, def] of Object.entries(CAMPOS_IMPORTABLES)) {
      if (usados.has(k)) continue;
      for (const a of def.alias) {
        if (a.length >= 4 && n.includes(` ${a} `) && (!mejor || a.length > mejor.largo)) mejor = { campo: k, largo: a.length };
      }
    }
    if (mejor) { usados.add(mejor.campo); r[col] = mejor.campo; }
  }
  return r;
}

/** Traduce etapas en inglés o español al código interno. */
export function etapaDesdeTexto(t) {
  const n = normalizar(t);
  if (!n) return undefined;
  const mapa = {
    lead: 'lead', subscriber: 'lead', suscriptor: 'lead', prospecto: 'lead', 'marketing qualified lead': 'calificado',
    'sales qualified lead': 'calificado', calificado: 'calificado', sql: 'calificado', mql: 'calificado',
    opportunity: 'oportunidad', oportunidad: 'oportunidad', customer: 'cliente', cliente: 'cliente',
    evangelist: 'fidelizado', fidelizado: 'fidelizado',
  };
  return mapa[n];
}
