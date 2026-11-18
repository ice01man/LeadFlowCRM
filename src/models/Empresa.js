import mongoose from 'mongoose';

// Organización cliente del usuario (la vinoteca, el restaurante, la pyme asegurada).
const empresaSchema = new mongoose.Schema({
  organizacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  razonSocial: { type: String, required: true, trim: true },
  cuit: { type: String, trim: true, default: '' },
  segmento: { type: String, trim: true, default: '' },
  direccion: { type: String, trim: true, default: '' },
  municipio: { type: String, trim: true, default: '' },
  localidad: { type: String, trim: true, default: '' },
  lat: Number,
  lng: Number,
  telefono: { type: String, trim: true, default: '' },
  sitioWeb: { type: String, trim: true, default: '' },
  notas: { type: String, default: '' },
  busqueda: { type: String, default: '' }, // texto normalizado para buscar sin acentos
  activa: { type: Boolean, default: true },
}, { timestamps: true });

empresaSchema.index({ organizacionId: 1, razonSocial: 1 });
empresaSchema.index({ organizacionId: 1, cuit: 1 });

export default mongoose.models.Empresa || mongoose.model('Empresa', empresaSchema, 'empresas');
