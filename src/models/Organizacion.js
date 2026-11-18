import mongoose from 'mongoose';
import { esquemaConfig } from './esquemaConfig.js';

// La Organización es el tenant: cada cliente del SaaS. Ningún dato de negocio cruza de una a otra.
export const PLANES = ['prueba', 'basico', 'profesional'];

const organizacionSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  cuit: { type: String, trim: true, default: '' },
  verticalCodigo: { type: String, trim: true, default: '' }, // plantilla de la que salió su configuración
  // Copia propia de la configuración comercial del vertical: la organización la ajusta sin tocar la plantilla.
  config: { type: esquemaConfig, default: undefined },
  plan: { type: String, enum: PLANES, default: 'prueba' },
  llmActivo: { type: Boolean, default: true }, // la organización puede apagar el LLM externo
  activa: { type: Boolean, default: true },
}, { timestamps: true });

organizacionSchema.index({ nombre: 1 }, { unique: true, collation: { locale: 'es', strength: 2 } });

export default mongoose.models.Organizacion || mongoose.model('Organizacion', organizacionSchema, 'organizaciones');
