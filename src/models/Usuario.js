import mongoose from 'mongoose';
import { ROLES } from '../config/roles.js';

const usuarioSchema = new mongoose.Schema({
  // null solo para el superadmin de la plataforma; cualquier otro rol pertenece a una organización.
  organizacionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organizacion', default: null, index: true },
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  rol: { type: String, enum: ROLES, required: true },
  telefono: { type: String, trim: true, default: '' },
  // Punto de partida del vendedor para optimizar rutas (Fase 3).
  base: { lat: Number, lng: Number },
  activo: { type: Boolean, default: true },
}, { timestamps: true });

usuarioSchema.path('organizacionId').validate(function validar(v) {
  return this.rol === 'superadmin' ? v == null : v != null;
}, 'El superadmin no pertenece a una organización y el resto de los roles sí.');

export default mongoose.models.Usuario || mongoose.model('Usuario', usuarioSchema, 'usuarios');
