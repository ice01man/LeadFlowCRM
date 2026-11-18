// Validación de la configuración comercial: la usan las plantillas de vertical (superadmin)
// y la copia que ajusta cada organización (admin / consultor). Devuelve siempre un objeto limpio:
// solo los campos conocidos, con los tipos correctos. Nunca guarda lo que manda el cliente tal cual.
import { badRequest } from '../utils/errores.js';

export const CODIGOS_BANT = ['presupuesto', 'autoridad', 'necesidad', 'tiempo'];
export const VARIABLES_EMAIL = ['contacto', 'empresa', 'vendedor', 'organizacion', 'producto'];
export const CAMPOS_CONFIG = ['categoriasNegocio', 'categoriasProducto', 'etapasPipeline', 'criteriosBANT', 'kpiConfig', 'templatesEmail', 'scriptsVisita'];

const SLUG = /^[a-z0-9_]{2,30}$/;

function cadena(v, campo, { max = 120, min = 1 } = {}) {
  if (typeof v !== 'string') throw badRequest(`${campo}: tiene que ser texto.`);
  const t = v.trim();
  if (t.length < min) throw badRequest(`${campo}: no puede estar vacío.`);
  if (t.length > max) throw badRequest(`${campo}: máximo ${max} caracteres.`);
  return t;
}

function lista(v, campo, { min = 0, max = 50 } = {}) {
  if (!Array.isArray(v)) throw badRequest(`${campo}: tiene que ser una lista.`);
  if (v.length < min) throw badRequest(`${campo}: tiene que tener al menos ${min} elemento(s).`);
  if (v.length > max) throw badRequest(`${campo}: máximo ${max} elementos.`);
  return v;
}

function objeto(v, campo) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw badRequest(`${campo}: formato inválido.`);
  return v;
}

function codigo(v, campo) {
  if (typeof v !== 'string' || !SLUG.test(v)) throw badRequest(`${campo}: código inválido (minúsculas, números y guion bajo, 2 a 30 caracteres).`);
  return v;
}

function sinRepetir(items, clave, campo) {
  const vistos = new Set();
  for (const it of items) {
    const k = String(clave(it)).toLowerCase();
    if (vistos.has(k)) throw badRequest(`${campo}: "${clave(it)}" está repetido.`);
    vistos.add(k);
  }
  return items;
}

function numeroEn(v, campo, min, max, { entero = false } = {}) {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) {
    throw badRequest(`${campo}: tiene que ser un número${entero ? ' entero' : ''} entre ${min} y ${max}.`);
  }
  return n;
}

const categorias = (v, campo) => sinRepetir(lista(v, campo, { min: 1, max: 50 }).map((c, i) => cadena(c, `${campo} #${i + 1}`, { max: 60 })), (c) => c, campo);

function etapas(v) {
  const r = lista(v, 'Etapas del pipeline', { min: 2, max: 10 }).map((e, i) => {
    const campo = `Etapa #${i + 1}`;
    objeto(e, campo);
    return { codigo: codigo(e.codigo, campo), nombre: cadena(e.nombre, `${campo} (nombre)`, { max: 60 }), probabilidad: numeroEn(e.probabilidad, `${campo} (probabilidad)`, 0, 100, { entero: true }) };
  });
  sinRepetir(r, (e) => e.codigo, 'Etapas del pipeline');
  for (let i = 1; i < r.length; i += 1) {
    if (r[i].probabilidad < r[i - 1].probabilidad) throw badRequest(`Etapas del pipeline: la probabilidad no puede bajar de una etapa a la siguiente ("${r[i - 1].nombre}" → "${r[i].nombre}").`);
  }
  return r;
}

function bant(v) {
  const r = lista(v, 'Criterios BANT', { min: 4, max: 4 }).map((c, i) => {
    const campo = `Criterio BANT #${i + 1}`;
    objeto(c, campo);
    if (!CODIGOS_BANT.includes(c.codigo)) throw badRequest(`${campo}: el código tiene que ser uno de ${CODIGOS_BANT.join(', ')}.`);
    return {
      codigo: c.codigo,
      nombre: cadena(c.nombre, `${campo} (nombre)`, { max: 40 }),
      descripcion: cadena(c.descripcion ?? '', `${campo} (descripción)`, { max: 200, min: 0 }),
      peso: numeroEn(c.peso, `${campo} (peso)`, 0, 10),
    };
  });
  sinRepetir(r, (c) => c.codigo, 'Criterios BANT');
  if (r.reduce((s, c) => s + c.peso, 0) <= 0) throw badRequest('Criterios BANT: al menos un peso tiene que ser mayor que cero.');
  // Siempre en el mismo orden: B, A, N, T.
  return CODIGOS_BANT.map((cod) => r.find((c) => c.codigo === cod));
}

function kpis(v) {
  const r = lista(v, 'KPIs', { max: 20 }).map((k, i) => {
    const campo = `KPI #${i + 1}`;
    objeto(k, campo);
    return { codigo: codigo(k.codigo, campo), nombre: cadena(k.nombre, `${campo} (nombre)`, { max: 60 }), descripcion: cadena(k.descripcion ?? '', `${campo} (descripción)`, { max: 300, min: 0 }) };
  });
  return sinRepetir(r, (k) => k.codigo, 'KPIs');
}

function emails(v) {
  const r = lista(v, 'Plantillas de email', { max: 30 }).map((t, i) => {
    const campo = `Plantilla de email #${i + 1}`;
    objeto(t, campo);
    const asunto = cadena(t.asunto, `${campo} (asunto)`, { max: 150 });
    const cuerpo = cadena(t.cuerpo, `${campo} (cuerpo)`, { max: 5000 });
    // Las variables se calculan del texto: así nunca quedan desalineadas con lo que se escribió.
    const usadas = [...new Set([...`${asunto}\n${cuerpo}`.matchAll(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g)].map((m) => m[1]))];
    const desconocida = usadas.find((x) => !VARIABLES_EMAIL.includes(x));
    if (desconocida) throw badRequest(`${campo}: la variable {{${desconocida}}} no existe. Disponibles: ${VARIABLES_EMAIL.join(', ')}.`);
    return { codigo: codigo(t.codigo, campo), asunto, cuerpo, variables: usadas };
  });
  return sinRepetir(r, (t) => t.codigo, 'Plantillas de email');
}

function scripts(v) {
  const r = lista(v, 'Guiones de visita', { max: 30 }).map((s, i) => {
    const campo = `Guion de visita #${i + 1}`;
    objeto(s, campo);
    return {
      codigo: codigo(s.codigo, campo),
      titulo: cadena(s.titulo, `${campo} (título)`, { max: 100 }),
      pasos: lista(s.pasos, `${campo} (pasos)`, { min: 1, max: 20 }).map((p, j) => cadena(p, `${campo}, paso ${j + 1}`, { max: 300 })),
    };
  });
  return sinRepetir(r, (s) => s.codigo, 'Guiones de visita');
}

const VALIDADORES = {
  categoriasNegocio: (v) => categorias(v, 'Categorías de negocio'),
  categoriasProducto: (v) => categorias(v, 'Categorías de producto'),
  etapasPipeline: etapas,
  criteriosBANT: bant,
  kpiConfig: kpis,
  templatesEmail: emails,
  scriptsVisita: scripts,
};

/** Valida una configuración COMPLETA (todos los campos obligatorios). */
export function validarConfig(datos) {
  objeto(datos, 'Configuración');
  const r = {};
  for (const campo of CAMPOS_CONFIG) {
    if (datos[campo] === undefined) throw badRequest(`Falta ${campo} en la configuración.`);
    r[campo] = VALIDADORES[campo](datos[campo]);
  }
  return r;
}

/** Aplica cambios parciales sobre una configuración existente y valida el resultado completo. */
export function aplicarCambios(actual, cambios) {
  objeto(cambios, 'Cambios');
  const desconocidos = Object.keys(cambios).filter((k) => !CAMPOS_CONFIG.includes(k));
  if (desconocidos.length) throw badRequest(`Campos no permitidos: ${desconocidos.join(', ')}.`);
  if (!Object.keys(cambios).length) throw badRequest('No hay cambios para guardar.');
  return validarConfig({ ...extraerConfig(actual), ...cambios });
}

/** Toma solo los campos de configuración de un vertical u organización. */
export function extraerConfig(origen = {}) {
  const r = {};
  for (const campo of CAMPOS_CONFIG) if (origen[campo] !== undefined) r[campo] = structuredClone(origen[campo]);
  return r;
}

/** Score BANT 0-100 con los pesos de la configuración. valores: { presupuesto: 0..1, ... }. Lo usa la Fase 3. */
export function calcularScoreBANT(criterios, valores = {}) {
  let suma = 0, pesos = 0;
  for (const c of criterios) {
    const v = Number(valores[c.codigo]);
    if (!Number.isFinite(v) || v < 0 || v > 1) throw badRequest(`BANT: el valor de "${c.nombre}" tiene que estar entre 0 y 1.`);
    suma += v * c.peso;
    pesos += c.peso;
  }
  return pesos ? Math.round((suma / pesos) * 100) : 0;
}
