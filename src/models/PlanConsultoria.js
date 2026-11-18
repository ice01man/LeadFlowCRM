import mongoose from 'mongoose';

const { Schema } = mongoose;
export const ESTADOS_PLAN = ['borrador', 'en_curso', 'pausado', 'finalizado'];
export const ESTADOS_TAREA_PLAN = ['pendiente', 'en_progreso', 'completada', 'cancelada'];
export const RESPONSABLES_PLAN = ['consultor', 'cliente'];

const tareaPlan = new Schema({
  codigo: String, titulo: String, responsable: String, fechaVencimiento: Date, estado: String, completadaEn: Date,
}, { _id: false });
const fase = new Schema({ codigo: String, nombre: String, fechaInicio: Date, fechaFin: Date, tareas: [tareaPlan] }, { _id: false });
const meta = new Schema({ codigo: String, nombre: String, unidad: String, valorInicial: Number, valorObjetivo: Number, valorActual: Number }, { _id: false });
const documento = new Schema({ nombre: String, url: String }, { _id: false });

// Plan de consultoría de una organización cliente. Lo edita solo el consultor (superadmin);
// el cliente lo ve en solo lectura como parte de la propuesta de trabajo.
const planSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true, unique: true },
  titulo: { type: String, default: '' },
  objetivo: { type: String, default: '' },
  alcance: { type: String, default: '' },
  fechaInicio: { type: Date, default: null },
  fechaFin: { type: Date, default: null },
  estado: { type: String, enum: ESTADOS_PLAN, default: 'borrador' },
  documentos: [documento], // links (Google Drive u otros)
  metas: [meta],
  fases: [fase],
  // Fotos de las métricas del CRM al iniciar y al cerrar: base para medir el impacto y para que la IA aprenda.
  metricasInicio: { type: Schema.Types.Mixed, default: null },
  metricasCierre: { type: Schema.Types.Mixed, default: null },
  iniciadoEn: { type: Date, default: null },
  finalizadoEn: { type: Date, default: null },
  conclusiones: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.PlanConsultoria || mongoose.model('PlanConsultoria', planSchema, 'planes_consultoria');
