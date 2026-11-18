import mongoose from 'mongoose';

const { Schema } = mongoose;
export const ESTADOS_OPORTUNIDAD = ['abierta', 'ganada', 'perdida'];

// Venta en curso. La etapa es un código de las etapas del pipeline de la organización (su configuración).
const oportunidadSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  contactoId: { type: Schema.Types.ObjectId, ref: 'Contacto', required: true },
  contactoNombre: { type: String, default: '' }, // copias para mostrar el tablero sin cruzar colecciones
  empresaId: { type: Schema.Types.ObjectId, ref: 'Empresa', default: null },
  empresaNombre: { type: String, default: '' },
  owner: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
  titulo: { type: String, required: true, trim: true },
  etapa: { type: String, required: true },
  valorEstimado: { type: Number, default: 0 },
  probabilidad: { type: Number, default: 0 },
  fechaCierreEsperada: { type: Date, default: null },
  estado: { type: String, enum: ESTADOS_OPORTUNIDAD, default: 'abierta' },
  fechaCierre: { type: Date, default: null },
  motivoPerdida: { type: String, default: '' },
  notas: { type: String, default: '' },
  historialEtapas: [new Schema({ etapa: String, fecha: Date, usuarioId: Schema.Types.ObjectId }, { _id: false })],
}, { timestamps: true });

oportunidadSchema.index({ organizacionId: 1, estado: 1, etapa: 1 });
oportunidadSchema.index({ organizacionId: 1, contactoId: 1 });
oportunidadSchema.index({ organizacionId: 1, owner: 1 });

export default mongoose.models.Oportunidad || mongoose.model('Oportunidad', oportunidadSchema, 'oportunidades');
