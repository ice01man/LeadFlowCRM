import mongoose from 'mongoose';

// Vista guardada: un conjunto de filtros con nombre ("Zona Oeste", "Vinotecas sin teléfono").
const vistaSchema = new mongoose.Schema({
  organizacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  nombre: { type: String, required: true, trim: true },
  filtros: { type: mongoose.Schema.Types.Mixed, default: {} },
  creadaPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  compartida: { type: Boolean, default: false }, // visible para toda la organización
}, { timestamps: true });

vistaSchema.index({ organizacionId: 1, creadaPor: 1 });

export default mongoose.models.VistaContactos || mongoose.model('VistaContactos', vistaSchema, 'vistas_contactos');
