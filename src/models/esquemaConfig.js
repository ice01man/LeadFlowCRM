// Subesquema de configuración comercial, compartido por Vertical (plantilla) y Organizacion (su copia).
// La validación de negocio vive en src/verticales/validacion.js; acá solo se fija la forma en Mongo.
import mongoose from 'mongoose';

const { Schema } = mongoose;

export const camposConfig = {
  categoriasNegocio: [String],
  categoriasProducto: [String],
  etapasPipeline: [new Schema({ codigo: String, nombre: String, probabilidad: Number }, { _id: false })],
  criteriosBANT: [new Schema({ codigo: String, nombre: String, descripcion: String, peso: Number }, { _id: false })],
  kpiConfig: [new Schema({ codigo: String, nombre: String, descripcion: String }, { _id: false })],
  templatesEmail: [new Schema({ codigo: String, asunto: String, cuerpo: String, variables: [String] }, { _id: false })],
  scriptsVisita: [new Schema({ codigo: String, titulo: String, pasos: [String] }, { _id: false })],
};

export const esquemaConfig = new Schema(camposConfig, { _id: false });
