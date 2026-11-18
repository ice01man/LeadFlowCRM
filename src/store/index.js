// Punto único de acceso a datos. `db` se llena al iniciar con repos de Mongo o de memoria
// según PERSISTENCIA; el resto del código solo conoce `db`.
//
// Dos niveles de acceso:
//   db.plataforma.*   → colecciones globales (organizaciones, verticales, usuarios para el login). Uso restringido.
//   db.org(id).*      → colecciones de negocio atadas a UNA organización (ver store/tenant.js).
import mongoose from 'mongoose';
import { MODO, MONGODB_URI, MONGODB_DB } from '../config/env.js';
import { repoMemoria } from './memory.js';
import { repoMongo } from './mongo.js';
import { repoTenant } from './tenant.js';

export const db = {
  plataforma: {},
  /** Repos crudos de las colecciones de negocio. NUNCA se usan directo: solo a través de db.org(id). */
  _negocio: {},
  /** Repos de una organización. Cada fase agrega acá sus colecciones (contactos, ventas, etc.). */
  org(organizacionId) {
    const id = organizacionId ? String(organizacionId) : '';
    return {
      organizacionId: id,
      usuarios: repoTenant(this.plataforma.usuarios, id),
      empresas: repoTenant(this._negocio.empresas, id),
      contactos: repoTenant(this._negocio.contactos, id),
      vistas: repoTenant(this._negocio.vistas, id),
      oportunidades: repoTenant(this._negocio.oportunidades, id),
      actividades: repoTenant(this._negocio.actividades, id),
      tareas: repoTenant(this._negocio.tareas, id),
      planes: repoTenant(this._negocio.planes, id),
      bitacora: repoTenant(this._negocio.bitacora, id),
    };
  },
};

export async function iniciarStore() {
  if (MODO === 'mongo') {
    await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB, serverSelectionTimeoutMS: 8000 });
    console.log(`MongoDB conectado (base: ${MONGODB_DB})`);
    const [Organizacion, Usuario, Vertical] = (await Promise.all([
      import('../models/Organizacion.js'), import('../models/Usuario.js'), import('../models/Vertical.js'),
    ])).map((m) => m.default);
    await Promise.all([Organizacion.init(), Usuario.init(), Vertical.init()]); // índices únicos antes de recibir tráfico
    db.plataforma.organizaciones = repoMongo(Organizacion);
    db.plataforma.usuarios = repoMongo(Usuario);
    db.plataforma.verticales = repoMongo(Vertical);
    const [Empresa, Contacto, Vista] = (await Promise.all([
      import('../models/Empresa.js'), import('../models/Contacto.js'), import('../models/VistaContactos.js'),
    ])).map((m) => m.default);
    await Promise.all([Empresa.init(), Contacto.init(), Vista.init()]);
    db._negocio.empresas = repoMongo(Empresa);
    db._negocio.contactos = repoMongo(Contacto);
    db._negocio.vistas = repoMongo(Vista);
    const [Oportunidad, Actividad, Tarea] = (await Promise.all([
      import('../models/Oportunidad.js'), import('../models/Actividad.js'), import('../models/Tarea.js'),
    ])).map((m) => m.default);
    await Promise.all([Oportunidad.init(), Actividad.init(), Tarea.init()]);
    db._negocio.oportunidades = repoMongo(Oportunidad);
    db._negocio.actividades = repoMongo(Actividad);
    db._negocio.tareas = repoMongo(Tarea);
    const [Plan, Bitacora] = (await Promise.all([import('../models/PlanConsultoria.js'), import('../models/Bitacora.js')])).map((m) => m.default);
    await Promise.all([Plan.init(), Bitacora.init()]);
    db._negocio.planes = repoMongo(Plan);
    db._negocio.bitacora = repoMongo(Bitacora);
  } else {
    db.plataforma.organizaciones = repoMemoria({ unique: ['nombre'], defaults: { cuit: '', verticalCodigo: '', plan: 'prueba', llmActivo: true, activa: true } });
    db.plataforma.usuarios = repoMemoria({ unique: ['email'], defaults: { telefono: '', activo: true, organizacionId: null } });
    db.plataforma.verticales = repoMemoria({ unique: ['codigo'], defaults: { descripcion: '', activo: true } });
    db._negocio.empresas = repoMemoria({ defaults: { cuit: '', segmento: '', direccion: '', municipio: '', localidad: '', telefono: '', sitioWeb: '', notas: '', busqueda: '', activa: true } });
    db._negocio.contactos = repoMemoria({ defaults: { empresaId: null, empresaNombre: '', owner: null, apellido: '', email: '', telefono: '', telefonoNormalizado: '', cargo: '', segmento: '', direccion: '', municipio: '', localidad: '', lifecycleStage: 'lead', etiquetas: [], notas: '', origen: 'manual', scoreBANT: 0, scoreIA: 0, scoreChurn: 0, fechaUltimaInteraccion: null, fechaUltimaCompra: null, busqueda: '', activo: true } });
    db._negocio.vistas = repoMemoria({ defaults: { filtros: {}, compartida: false } });
    db._negocio.oportunidades = repoMemoria({ defaults: { contactoNombre: '', empresaId: null, empresaNombre: '', owner: null, valorEstimado: 0, probabilidad: 0, fechaCierreEsperada: null, estado: 'abierta', fechaCierre: null, motivoPerdida: '', notas: '', historialEtapas: [] } });
    db._negocio.actividades = repoMemoria({ defaults: { oportunidadId: null, ownerNombre: '', descripcion: '', resultado: '', proximoPaso: '', fechaProximoPaso: null, tareaId: null } });
    db._negocio.planes = repoMemoria({ unique: ['organizacionId'], defaults: { titulo: '', objetivo: '', alcance: '', fechaInicio: null, fechaFin: null, estado: 'borrador', documentos: [], metas: [], fases: [], metricasInicio: null, metricasCierre: null, iniciadoEn: null, finalizadoEn: null, conclusiones: '' } });
    db._negocio.bitacora = repoMemoria({ defaults: { tipo: 'nota', autorNombre: '' } });
    db._negocio.tareas = repoMemoria({ defaults: { contactoId: null, contactoNombre: '', oportunidadId: null, descripcion: '', fechaVencimiento: null, prioridad: 'media', estado: 'pendiente', completadaEn: null, dependeDe: [] } });
  }
}

export async function cerrarStore() {
  if (MODO === 'mongo') await mongoose.disconnect();
}
