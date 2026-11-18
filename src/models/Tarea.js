import mongoose from 'mongoose';

const { Schema } = mongoose;
export const PRIORIDADES = ['baja', 'media', 'alta', 'critica'];
export const ESTADOS_TAREA = ['pendiente', 'en_progreso', 'completada', 'cancelada'];

const tareaSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  owner: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true }, // responsable
  creadaPor: { type: Schema.Types.ObjectId, ref: 'Usuario', required: true },
  contactoId: { type: Schema.Types.ObjectId, ref: 'Contacto', default: null },
  contactoNombre: { type: String, default: '' },
  oportunidadId: { type: Schema.Types.ObjectId, ref: 'Oportunidad', default: null },
  titulo: { type: String, required: true, trim: true },
  descripcion: { type: String, default: '' },
  fechaVencimiento: { type: Date, default: null },
  prioridad: { type: String, enum: PRIORIDADES, default: 'media' },
  estado: { type: String, enum: ESTADOS_TAREA, default: 'pendiente' },
  completadaEn: { type: Date, default: null },
  dependeDe: [{ type: Schema.Types.ObjectId, ref: 'Tarea' }], // no se puede completar hasta que estas estén completas
}, { timestamps: true });

tareaSchema.index({ organizacionId: 1, owner: 1, estado: 1, fechaVencimiento: 1 });
tareaSchema.index({ organizacionId: 1, contactoId: 1 });

export default mongoose.models.Tarea || mongoose.model('Tarea', tareaSchema, 'tareas');
