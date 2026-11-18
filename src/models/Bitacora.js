import mongoose from 'mongoose';

const { Schema } = mongoose;
export const TIPOS_BITACORA = ['reunion', 'avance', 'decision', 'riesgo', 'nota'];

// Bitácora privada del consultor sobre un cliente. El cliente NO la ve.
const bitacoraSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  tipo: { type: String, enum: TIPOS_BITACORA, default: 'nota' },
  texto: { type: String, required: true },
  fecha: { type: Date, default: Date.now },
  autorId: { type: Schema.Types.ObjectId, ref: 'Usuario' },
  autorNombre: { type: String, default: '' },
}, { timestamps: true });

bitacoraSchema.index({ organizacionId: 1, fecha: -1 });

export default mongoose.models.Bitacora || mongoose.model('Bitacora', bitacoraSchema, 'bitacora_consultoria');
