// Configuración comercial de la organización del usuario logueado.
import * as organizaciones from '../services/organizaciones.js';

export const obtener = async (req, res) => res.json(await organizaciones.obtenerConfig(req.usuario.organizacionId));
export const actualizar = async (req, res) => res.json(await organizaciones.actualizarConfig(req.usuario.organizacionId, req.body));
export const restaurar = async (req, res) => res.json(await organizaciones.restaurarConfig(req.usuario.organizacionId, req.body?.verticalCodigo));
