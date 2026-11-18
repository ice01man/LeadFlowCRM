// Plantillas de vertical (globales, las gestiona el superadmin).
import { db } from '../store/index.js';
import { PLANTILLAS } from '../verticales/plantillas.js';
import { validarConfig, aplicarCambios, extraerConfig } from '../verticales/validacion.js';
import { badRequest, conflicto, noEncontrado, texto } from '../utils/errores.js';

const CODIGO = /^[a-z0-9_]{2,30}$/;

/** Crea las plantillas que falten. No toca las existentes: los ajustes del superadmin se respetan. */
export async function sembrarVerticales() {
  let creadas = 0;
  for (const p of PLANTILLAS) {
    if (await db.plataforma.verticales.findOne({ codigo: p.codigo })) continue;
    await db.plataforma.verticales.create({ codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion, activo: p.activo, ...validarConfig(p) });
    creadas += 1;
  }
  return creadas;
}

/** Resumen para listados y selectores. */
const resumen = (v) => ({ _id: v._id, codigo: v.codigo, nombre: v.nombre, descripcion: v.descripcion, activo: v.activo, etapas: v.etapasPipeline.length });

export async function listar({ soloActivos = false } = {}) {
  const todos = await db.plataforma.verticales.list(soloActivos ? { activo: true } : {}, { sort: { nombre: 1 } });
  return todos.map(resumen);
}

export async function obtener(codigo) {
  const v = typeof codigo === 'string' && CODIGO.test(codigo) ? await db.plataforma.verticales.findOne({ codigo }) : null;
  if (!v) throw noEncontrado('Vertical no encontrado.');
  return v;
}

const aCodigo = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 26);

/** Código libre a partir del nombre: "Ferretería" → ferreteria, ferreteria_2... */
async function codigoLibre(nombre) {
  let base = aCodigo(nombre);
  if (base.length < 2) base = `rubro_${base}`.replace(/_$/, '');
  let codigo = base;
  for (let i = 2; await db.plataforma.verticales.findOne({ codigo }); i += 1) codigo = `${base}_${i}`;
  return codigo;
}

export async function crear(datos = {}) {
  const nombre = texto(datos.nombre, 'El nombre', { max: 80 });
  if (await db.plataforma.verticales.findOne({ nombre: { $regex: `^${nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } })) {
    throw conflicto(`Ya existe una plantilla llamada "${nombre}".`);
  }
  let codigo;
  if (datos.codigo === undefined || datos.codigo === '') codigo = await codigoLibre(nombre);
  else {
    if (typeof datos.codigo !== 'string' || !CODIGO.test(datos.codigo)) throw badRequest('Código inválido (minúsculas, números y guion bajo, 2 a 30 caracteres).');
    if (await db.plataforma.verticales.findOne({ codigo: datos.codigo })) throw conflicto('Ya existe un vertical con ese código.');
    codigo = datos.codigo;
  }
  const base = datos.basadoEn ? extraerConfig(await obtener(datos.basadoEn)) : {};
  const config = validarConfig({ ...base, ...extraerConfig(datos) });
  return db.plataforma.verticales.create({
    codigo,
    nombre,
    descripcion: texto(datos.descripcion, 'La descripción', { max: 300, requerido: false }),
    activo: true,
    ...config,
  });
}

/** Cambia la plantilla. Las organizaciones que ya la copiaron NO cambian (cada una tiene su copia). */
export async function actualizar(codigo, datos = {}) {
  const v = await obtener(codigo);
  const patch = {};
  if (datos.nombre !== undefined) patch.nombre = texto(datos.nombre, 'El nombre', { max: 80 });
  if (datos.descripcion !== undefined) patch.descripcion = texto(datos.descripcion, 'La descripción', { max: 300, requerido: false });
  if (datos.activo !== undefined) {
    if (typeof datos.activo !== 'boolean') throw badRequest('activo debe ser true o false.');
    patch.activo = datos.activo;
  }
  const cambiosConfig = extraerConfig(datos);
  if (Object.keys(cambiosConfig).length) Object.assign(patch, aplicarCambios(v, cambiosConfig));
  if (!Object.keys(patch).length) throw badRequest('No hay cambios para guardar.');
  return db.plataforma.verticales.update(v._id, patch);
}
