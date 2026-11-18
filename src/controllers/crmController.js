// Controllers del CRM: traducen HTTP a llamadas de servicio. Sin lógica de negocio.
import * as contactos from '../services/contactos.js';
import * as empresas from '../services/empresas.js';
import * as importacion from '../services/importacion.js';

// Contactos
export const listarContactos = async (req, res) => res.json(await contactos.listar(req.ctx, req.query));
export const opcionesContactos = async (req, res) => res.json(await contactos.opciones(req.ctx));
export const obtenerContacto = async (req, res) => res.json(await contactos.obtener(req.ctx, req.params.id));
export const crearContacto = async (req, res) => res.status(201).json(await contactos.crear(req.ctx, req.body));
export const actualizarContacto = async (req, res) => res.json(await contactos.actualizar(req.ctx, req.params.id, req.body));
export const archivarContacto = async (req, res) => res.json(await contactos.archivar(req.ctx, req.params.id));
export const asignarContactos = async (req, res) => res.json(await contactos.asignar(req.ctx, req.body));

export async function exportarContactos(req, res) {
  const r = await importacion.exportar(req.ctx, req.query);
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${r.nombreArchivo}"`);
  res.set('X-Cantidad', String(r.cantidad));
  res.send(r.contenido);
}

// Vistas
export const listarVistas = async (req, res) => res.json(await contactos.listarVistas(req.ctx));
export const crearVista = async (req, res) => res.status(201).json(await contactos.crearVista(req.ctx, req.body));
export const borrarVista = async (req, res) => res.json(await contactos.borrarVista(req.ctx, req.params.id));

// Importación
export const previsualizarImportacion = async (req, res) => res.json(importacion.previsualizar(req.ctx, req.body));
export const ejecutarImportacion = async (req, res) => res.json(await importacion.importar(req.ctx, req.body));

// Empresas
export const listarEmpresas = async (req, res) => res.json(await empresas.listar(req.ctx, req.query));
export const obtenerEmpresa = async (req, res) => res.json(await empresas.obtener(req.ctx, req.params.id));
export const crearEmpresa = async (req, res) => res.status(201).json(await empresas.crear(req.ctx, req.body));
export const actualizarEmpresa = async (req, res) => res.json(await empresas.actualizar(req.ctx, req.params.id, req.body));
export const archivarEmpresa = async (req, res) => res.json(await empresas.archivar(req.ctx, req.params.id));
