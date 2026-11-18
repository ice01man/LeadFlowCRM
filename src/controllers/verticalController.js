import * as verticales from '../services/verticales.js';
import { ROL } from '../config/roles.js';

// El superadmin ve todos los verticales; el resto, solo los activos.
export const listar = async (req, res) => res.json(await verticales.listar({ soloActivos: req.usuario.rol !== ROL.SUPERADMIN }));
export const obtener = async (req, res) => res.json(await verticales.obtener(req.params.codigo));
export const crear = async (req, res) => res.status(201).json(await verticales.crear(req.body));
export const actualizar = async (req, res) => res.json(await verticales.actualizar(req.params.codigo, req.body));
