// Rutas del CRM (/api/crm). Todas exigen sesión de un usuario de organización.
// Lectura: todos los roles de la organización. Escritura: admin, consultor y vendedor (los servicios afinan el permiso).
import { Router } from 'express';
import { authRequired, requireRol, requireOrganizacion } from '../middleware/auth.js';
import { contexto } from '../middleware/contexto.js';
import { ROLES_LECTURA, ROLES_CRM, ROLES_IA } from '../config/roles.js';
import * as c from '../controllers/crmController.js';

export const crm = Router();
crm.use(authRequired, requireOrganizacion, requireRol(...ROLES_LECTURA), contexto);
const escribe = requireRol(...ROLES_CRM);
const gestiona = requireRol(...ROLES_IA); // admin y consultor

// Contactos (las rutas fijas van antes de /:id)
crm.get('/contactos', c.listarContactos);
crm.get('/contactos/opciones', c.opcionesContactos);
crm.get('/contactos/exportar', c.exportarContactos);
crm.post('/contactos/asignar', gestiona, c.asignarContactos);
crm.get('/contactos/:id', c.obtenerContacto);
crm.post('/contactos', escribe, c.crearContacto);
crm.patch('/contactos/:id', escribe, c.actualizarContacto);
crm.delete('/contactos/:id', escribe, c.archivarContacto);

// Vistas guardadas
crm.get('/vistas', c.listarVistas);
crm.post('/vistas', c.crearVista);
crm.delete('/vistas/:id', c.borrarVista);

// Importación CSV
crm.post('/importar/previsualizar', gestiona, c.previsualizarImportacion);
crm.post('/importar', gestiona, c.ejecutarImportacion);

// Empresas
crm.get('/empresas', c.listarEmpresas);
crm.get('/empresas/:id', c.obtenerEmpresa);
crm.post('/empresas', escribe, c.crearEmpresa);
crm.patch('/empresas/:id', escribe, c.actualizarEmpresa);
crm.delete('/empresas/:id', gestiona, c.archivarEmpresa);
