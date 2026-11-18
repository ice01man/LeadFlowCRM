import * as organizaciones from '../services/organizaciones.js';

export const listar = async (_req, res) => res.json(await organizaciones.listar());
export const obtener = async (req, res) => res.json(await organizaciones.obtener(req.params.id));
export const crear = async (req, res) => res.status(201).json(await organizaciones.crear(req.body));
export const actualizar = async (req, res) => res.json(await organizaciones.actualizar(req.params.id, req.body));
