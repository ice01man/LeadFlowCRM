import mongoose from 'mongoose';
import { camposConfig } from './esquemaConfig.js';

// Plantilla global de un rubro (vinos, granja, seguros...). No pertenece a ninguna organización.
const verticalSchema = new mongoose.Schema({
  codigo: { type: String, required: true, unique: true, lowercase: true, trim: true },
  nombre: { type: String, required: true, trim: true },
  descripcion: { type: String, trim: true, default: '' },
  activo: { type: Boolean, default: true },
  ...camposConfig,
}, { timestamps: true });

export default mongoose.models.Vertical || mongoose.model('Vertical', verticalSchema, 'verticales');
