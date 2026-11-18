import mongoose from 'mongoose';

export const ETAPAS_CICLO = ['lead', 'calificado', 'oportunidad', 'cliente', 'fidelizado'];

const contactoSchema = new mongoose.Schema({
  organizacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null },
  empresaNombre: { type: String, trim: true, default: '' }, // copia para listar y buscar sin cruzar colecciones
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }, // vendedor asignado
  nombre: { type: String, required: true, trim: true },
  apellido: { type: String, trim: true, default: '' },
  email: { type: String, trim: true, lowercase: true, default: '' },
  telefono: { type: String, trim: true, default: '' },
  telefonoNormalizado: { type: String, default: '' }, // solo dígitos: para detectar duplicados
  cargo: { type: String, trim: true, default: '' },
  segmento: { type: String, trim: true, default: '' }, // tipo de cliente según la configuración del rubro
  direccion: { type: String, trim: true, default: '' },
  municipio: { type: String, trim: true, default: '' },
  localidad: { type: String, trim: true, default: '' },
  lat: Number,
  lng: Number,
  lifecycleStage: { type: String, enum: ETAPAS_CICLO, default: 'lead' },
  etiquetas: [String],
  notas: { type: String, default: '' },
  origen: { type: String, default: 'manual' }, // manual | importacion
  scoreBANT: { type: Number, default: 0 },
  scoreIA: { type: Number, default: 0 },
  scoreChurn: { type: Number, default: 0 },
  fechaUltimaInteraccion: { type: Date, default: null },
  fechaUltimaCompra: { type: Date, default: null },
  busqueda: { type: String, default: '' },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

contactoSchema.index({ organizacionId: 1, activo: 1, createdAt: -1 });
contactoSchema.index({ organizacionId: 1, owner: 1 });
contactoSchema.index({ organizacionId: 1, email: 1 });
contactoSchema.index({ organizacionId: 1, telefonoNormalizado: 1 });
contactoSchema.index({ organizacionId: 1, empresaId: 1 });

export default mongoose.models.Contacto || mongoose.model('Contacto', contactoSchema, 'contactos');
