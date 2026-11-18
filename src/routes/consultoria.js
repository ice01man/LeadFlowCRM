// Rutas de consultoría.
//   /api/plataforma/clientes          → panel "Mis clientes" (solo el consultor / superadmin)
//   /api/consultoria/plan ...         → plan del cliente en el que se está trabajando
//   /api/consultoria/bitacora ...     → bitácora privada del consultor
import { Router } from 'express';
import { authRequired, requireOrganizacion, requireSuperadmin } from '../middleware/auth.js';
import { contexto } from '../middleware/contexto.js';
import * as consultoria from '../services/consultoria.js';
import * as cobros from '../services/cobros.js';

export const plataforma = Router();
plataforma.use(authRequired, requireSuperadmin);
plataforma.get('/clientes', async (_req, res) => res.json(await consultoria.resumenClientes()));

export const rutasConsultoria = Router();
rutasConsultoria.use(authRequired, requireOrganizacion, contexto);
rutasConsultoria.get('/plan', async (req, res) => res.json(await consultoria.obtenerPlan(req.ctx)));
rutasConsultoria.put('/plan', async (req, res) => res.json(await consultoria.guardarPlan(req.ctx, req.body)));
rutasConsultoria.post('/plan/estado', async (req, res) => res.json(await consultoria.cambiarEstado(req.ctx, req.body)));
rutasConsultoria.patch('/plan/tareas/:codigo', async (req, res) => res.json(await consultoria.marcarTarea(req.ctx, req.params.codigo, req.body)));
rutasConsultoria.get('/bitacora', async (req, res) => res.json(await consultoria.listarBitacora(req.ctx)));
rutasConsultoria.post('/bitacora', async (req, res) => res.status(201).json(await consultoria.agregarBitacora(req.ctx, req.body)));
rutasConsultoria.delete('/bitacora/:id', async (req, res) => res.json(await consultoria.borrarBitacora(req.ctx, req.params.id)));

// Cobros (privados del consultor)
rutasConsultoria.get('/cobros', async (req, res) => res.json(await cobros.listar(req.ctx)));
rutasConsultoria.post('/cobros', async (req, res) => res.status(201).json(await cobros.crear(req.ctx, req.body)));
rutasConsultoria.patch('/cobros/:id', async (req, res) => res.json(await cobros.actualizar(req.ctx, req.params.id, req.body)));
rutasConsultoria.post('/cobros/:id/estado', async (req, res) => res.json(await cobros.cambiarEstado(req.ctx, req.params.id, req.body)));
rutasConsultoria.delete('/cobros/:id', async (req, res) => res.json(await cobros.borrar(req.ctx, req.params.id)));
