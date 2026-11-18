// Todas las rutas de la API. Cada fase agrega acá su router.
import { Router } from 'express';
import { authRequired, requireRol, requireOrganizacion } from '../middleware/auth.js';
import { limitador } from '../middleware/limitador.js';
import { ROL } from '../config/roles.js';
import { MODO, LLM } from '../config/env.js';
import * as authC from '../controllers/authController.js';
import * as usuarioC from '../controllers/usuarioController.js';
import * as orgC from '../controllers/organizacionController.js';

export const api = Router();

// Salud: la usa Render como health check. No expone nada sensible.
api.get('/salud', (_req, res) => res.json({ ok: true, persistencia: MODO, llm: LLM.activo ? 'activo' : 'apagado' }));

// Auth
const auth = Router();
auth.post('/login', limitador({ max: 10 }), authC.login);
auth.post('/logout', authC.logout);
auth.get('/me', authRequired, authC.me);
api.use('/auth', auth);

// Usuarios de la propia organización (solo admin)
const usuarios = Router();
usuarios.use(authRequired, requireOrganizacion, requireRol(ROL.ADMIN));
usuarios.get('/', usuarioC.listar);
usuarios.get('/:id', usuarioC.obtener);
usuarios.post('/', usuarioC.crear);
usuarios.patch('/:id', usuarioC.actualizar);
api.use('/usuarios', usuarios);

// Organizaciones (solo superadmin de la plataforma)
const orgs = Router();
orgs.use(authRequired, requireRol(ROL.SUPERADMIN));
orgs.get('/', orgC.listar);
orgs.get('/:id', orgC.obtener);
orgs.post('/', orgC.crear);
orgs.patch('/:id', orgC.actualizar);
api.use('/organizaciones', orgs);

api.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
