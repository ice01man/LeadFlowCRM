// Todas las rutas de la API. Cada fase agrega acá su router.
import { Router } from 'express';
import { authRequired, requireRol, requireOrganizacion } from '../middleware/auth.js';
import { limitador } from '../middleware/limitador.js';
import { ROL, ROLES_IA } from '../config/roles.js';
import { MODO, LLM } from '../config/env.js';
import { MARCA } from '../config/marca.js';
import * as authC from '../controllers/authController.js';
import * as usuarioC from '../controllers/usuarioController.js';
import * as orgC from '../controllers/organizacionController.js';
import * as verticalC from '../controllers/verticalController.js';
import * as configC from '../controllers/configController.js';
import { crm } from './crm.js';

export const api = Router();

// Salud: la usa Render como health check. No expone nada sensible.
api.get('/salud', (_req, res) => res.json({ ok: true, producto: MARCA.firma, persistencia: MODO, llm: LLM.activo ? 'activo' : 'apagado' }));

// Auth
const auth = Router();
auth.post('/login', limitador({ max: 10 }), authC.login);
auth.post('/logout', authC.logout);
auth.get('/me', authRequired, authC.me);
api.use('/auth', auth);

// Marca: nombre, eslogan, colores y logos (público, para que el frontend y futuras integraciones usen lo mismo).
api.get('/marca', (_req, res) => res.json(MARCA));

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

// Verticales: cualquier usuario logueado los consulta; solo el superadmin los crea o modifica.
const verts = Router();
verts.use(authRequired);
verts.get('/', verticalC.listar);
verts.get('/:codigo', verticalC.obtener);
verts.post('/', requireRol(ROL.SUPERADMIN), verticalC.crear);
verts.patch('/:codigo', requireRol(ROL.SUPERADMIN), verticalC.actualizar);
api.use('/verticales', verts);

// Configuración comercial de la propia organización: todos la leen; admin y consultor la ajustan.
const config = Router();
config.use(authRequired, requireOrganizacion);
config.get('/', configC.obtener);
config.patch('/', requireRol(...ROLES_IA), configC.actualizar);
config.post('/restaurar', requireRol(ROL.ADMIN), configC.restaurar);
api.use('/organizacion/config', config);

// CRM: contactos, empresas, vistas, importación
api.use('/crm', crm);

api.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));
