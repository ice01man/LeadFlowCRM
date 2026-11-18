import * as usuarios from '../services/usuarios.js';
import { noEncontrado } from '../utils/errores.js';

export const listar = async (req, res) => res.json(await usuarios.listar(req.db.usuarios));

export async function obtener(req, res) {
  const u = await req.db.usuarios.get(req.params.id);
  if (!u) throw noEncontrado('Usuario no encontrado.');
  res.json(usuarios.publico(u));
}

export const crear = async (req, res) => res.status(201).json(await usuarios.crear(req.db.usuarios, req.body));

export const actualizar = async (req, res) =>
  res.json(await usuarios.actualizar(req.db.usuarios, req.params.id, req.body, { actorId: req.usuario.id }));
