import mongoose from 'mongoose';

const { Schema } = mongoose;
export const MONEDAS = ['ARS', 'USD'];
export const ESTADOS_COBRO = ['pendiente', 'facturado', 'cobrado', 'cancelado'];
export const DISPARADORES = ['fase', 'fecha', 'manual'];

// Hito de cobro de la consultoría. PRIVADO del consultor: el cliente no lo ve.
// "Listo para cobrar" y "vencido" no se guardan: se calculan (ver services/cobros.js).
const cobroSchema = new Schema({
  organizacionId: { type: Schema.Types.ObjectId, ref: 'Organizacion', required: true },
  concepto: { type: String, required: true, trim: true },
  monto: { type: Number, required: true },
  moneda: { type: String, enum: MONEDAS, default: 'ARS' },
  disparador: { type: String, enum: DISPARADORES, default: 'manual' },
  faseCodigo: { type: String, default: '' }, // si el disparador es una fase del plan
  fechaEstimada: { type: Date, default: null },
  estado: { type: String, enum: ESTADOS_COBRO, default: 'pendiente' },
  listoManual: { type: Boolean, default: false }, // disparador manual: el consultor lo marca como listo para cobrar
  fechaFacturado: { type: Date, default: null },
  fechaCobro: { type: Date, default: null },
  comprobanteUrl: { type: String, default: '' },
  notas: { type: String, default: '' },
}, { timestamps: true });

cobroSchema.index({ organizacionId: 1, fechaEstimada: 1 });

export default mongoose.models.Cobro || mongoose.model('Cobro', cobroSchema, 'cobros_consultoria');
