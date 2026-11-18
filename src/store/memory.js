// Repositorio EN MEMORIA (modo demo y tests). Expone la misma API que store/mongo.js,
// así los servicios se escriben una sola vez para los dos modos.
// Soporta: igualdad, $in, $nin, $ne, $gt, $gte, $lt, $lte, $regex (+ $options), $exists, $or
// y campos anidados con punto ("direccion.municipio").
import crypto from 'node:crypto';

const nuevoId = () => crypto.randomBytes(12).toString('hex'); // mismo formato que un ObjectId
const OPS = ['$in', '$nin', '$ne', '$gt', '$gte', '$lt', '$lte', '$regex', '$options', '$exists'];

const esOperadores = (v) =>
  v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp) &&
  Object.keys(v).length > 0 && Object.keys(v).every((k) => OPS.includes(k));

const igual = (a, b) => {
  if (a instanceof Date || b instanceof Date) return a != null && b != null && new Date(a).getTime() === new Date(b).getTime();
  return a === b || (a != null && b != null && String(a) === String(b));
};
// Como en Mongo: si el campo es un array, alcanza con que UN elemento coincida.
const algunoIgual = (val, ref) => (Array.isArray(val) ? val.some((v) => igual(v, ref)) : igual(val, ref));

const leer = (doc, ruta) => ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), doc);

function cumpleCondicion(val, cond) {
  if (cond instanceof RegExp) return typeof val === 'string' && cond.test(val);
  if (!esOperadores(cond)) return algunoIgual(val, cond);
  return Object.entries(cond).every(([op, ref]) => {
    switch (op) {
      case '$in': return ref.some((r) => algunoIgual(val, r));
      case '$nin': return !ref.some((r) => algunoIgual(val, r));
      case '$ne': return !algunoIgual(val, ref);
      case '$gt': return val != null && val > ref;
      case '$gte': return val != null && val >= ref;
      case '$lt': return val != null && val < ref;
      case '$lte': return val != null && val <= ref;
      case '$exists': return ref ? val !== undefined : val === undefined;
      case '$regex': {
        const re = ref instanceof RegExp ? ref : new RegExp(ref, cond.$options || '');
        return typeof val === 'string' && re.test(val);
      }
      case '$options': return true; // se usa junto con $regex
      default: return false;
    }
  });
}

export function coincide(doc, filtro) {
  return Object.entries(filtro).every(([campo, cond]) => {
    if (campo === '$or') return cond.some((sub) => coincide(doc, sub));
    if (campo === '$and') return cond.every((sub) => coincide(doc, sub));
    return cumpleCondicion(leer(doc, campo), cond);
  });
}

const copia = (d) => (d ? structuredClone(d) : null);

export function repoMemoria({ unique = [], defaults = {} } = {}) {
  let docs = [];

  // unique admite campos simples ('email') o compuestos (['organizacionId', 'nombre']).
  const comprobarUnico = (data, propioId = null) => {
    for (const regla of unique) {
      const campos = Array.isArray(regla) ? regla : [regla];
      const base = propioId ? { ...docs.find((d) => d._id === propioId), ...data } : data;
      if (campos.some((c) => base[c] === undefined)) continue;
      const choca = docs.find((d) => d._id !== propioId &&
        campos.every((c) => String(d[c]).toLowerCase() === String(base[c]).toLowerCase()));
      if (choca) {
        const e = new Error(`Valor duplicado en "${campos.join(' + ')}"`);
        e.code = 11000; // mismo código que MongoDB, así el manejador de errores lo trata igual
        throw e;
      }
    }
  };

  return {
    async list(filtro = {}, { sort, limit, skip } = {}) {
      let r = docs.filter((d) => coincide(d, filtro));
      if (sort) {
        const claves = Object.entries(sort);
        r = [...r].sort((a, b) => {
          for (const [campo, dir] of claves) {
            const va = leer(a, campo), vb = leer(b, campo);
            if (va > vb) return dir < 0 ? -1 : 1;
            if (va < vb) return dir < 0 ? 1 : -1;
          }
          return 0;
        });
      }
      if (skip) r = r.slice(skip);
      if (limit) r = r.slice(0, limit);
      return r.map(copia);
    },
    async get(id) { return copia(docs.find((d) => d._id === String(id))); },
    async findOne(filtro) { return copia(docs.find((d) => coincide(d, filtro))); },
    async count(filtro = {}) { return docs.filter((d) => coincide(d, filtro)).length; },
    async create(data) {
      comprobarUnico(data);
      const ahora = new Date();
      const doc = { ...structuredClone(defaults), ...structuredClone(data), _id: nuevoId(), createdAt: ahora, updatedAt: ahora };
      docs.push(doc);
      return copia(doc);
    },
    async update(id, patch) {
      const doc = docs.find((d) => d._id === String(id));
      if (!doc) return null;
      comprobarUnico(patch, doc._id);
      Object.assign(doc, structuredClone(patch), { updatedAt: new Date() });
      return copia(doc);
    },
    /** Actualiza SOLO si el documento cumple el filtro (sirve como "compare-and-set"). */
    async updateOne(filtro, patch) {
      const doc = docs.find((d) => coincide(d, filtro));
      if (!doc) return null;
      comprobarUnico(patch, doc._id);
      Object.assign(doc, structuredClone(patch), { updatedAt: new Date() });
      return copia(doc);
    },
    async remove(id) {
      const antes = docs.length;
      docs = docs.filter((d) => d._id !== String(id));
      return docs.length < antes;
    },
    /** Solo para tests: vacía la colección. */
    async _vaciar() { docs = []; },
  };
}
