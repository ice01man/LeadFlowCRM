// Arma req.ctx para los servicios de negocio: { db, usuario, organizacion() }.
// organizacion() se lee una sola vez por request y se reutiliza (la config del rubro se consulta seguido).
import { db } from '../store/index.js';
import { noEncontrado } from '../utils/errores.js';

export function contexto(req, _res, next) {
  let cache;
  req.ctx = {
    db: req.db,
    usuario: req.usuario,
    async organizacion() {
      if (!cache) {
        cache = await db.plataforma.organizaciones.get(req.usuario.organizacionId);
        if (!cache) throw noEncontrado('Organización no encontrada.');
      }
      return cache;
    },
  };
  next();
}
