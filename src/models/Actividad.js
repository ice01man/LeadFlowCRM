import mongoose from 'mongoose';

const { Schema } = mongoose;
export const TIPOS_ACTIVIDAD = ['llamada', 'email', 'reunion', 'visita', 'whatsapp', 'nota'];
export const RESULTADOS_ACTIVIDAD = ['positivo', 'neutro', 'negativo', 'sin_respuesta'];

// Interacción con un contacto: alimenta su línea de tiempo y la fecha de última interacción.
const actividadSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  contactoId: { type: Schema.Types.ObjectId, ref: 'Contacto', required: true },
  oportunidadId: { type: Schema.Types.ObjectId, ref: 'Oportunidad', default: null },
  owner: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }, // quién la registró
  ownerNombre: { type: String, default: '' },
  tipo: { type: String, enum: TIPOS_ACTIVIDAD, required: true },
  asunto: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '' },
  resultado: { type: String, enum: [...RESULTADOS_ACTIVIDAD, ''], default: '' },
  fecha: { type: Date, default: Date.now },
  proximoPaso: { type: String, default: '' },
  fechaProximoPaso: { type: Date, default: null },
  tareaId: { type: Schema.Types.ObjectId, ref: 'Tarea', default: null }, // tarea creada a partir del próximo paso
}, { timestamps: true });

actividadSchema.index({ organizacionId: 1, contactoId: 1, fecha: -1 });
actividadSchema.index({ organizacionId: 1, owner: 1, fecha: -1 });

export default mongoose.models.Actividad || mongoose.model('Actividad', actividadSchema, 'actividades');
