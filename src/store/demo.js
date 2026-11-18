// Datos de demostración para modo memoria: un superadmin y dos organizaciones con sus usuarios.
// Las dos organizaciones existen para poder probar que ninguna ve los datos de la otra.
import { db } from './index.js';
import { hashear } from '../services/usuarios.js';

export const PASSWORD_DEMO = 'demo12345';

const ORGANIZACIONES = [
  { nombre: 'Bodega Demo', cuit: '30-11111111-1', usuarios: [['admin', 'admin@bodega.demo'], ['consultor', 'consultor@bodega.demo'], ['vendedor', 'vendedor@bodega.demo'], ['lectura', 'lectura@bodega.demo']] },
  { nombre: 'Granja Demo', cuit: '30-22222222-2', usuarios: [['admin', 'admin@granja.demo'], ['vendedor', 'vendedor@granja.demo']] },
];

/** Carga los datos demo si la base está vacía. Devuelve la lista de usuarios creados con su contraseña. */
export async function cargarDemo() {
  if (await db.plataforma.usuarios.count()) return [];
  const passwordHash = await hashear(PASSWORD_DEMO);
  const creados = [];
  await db.plataforma.usuarios.create({ nombre: 'Superadmin', email: 'super@leadflow.demo', rol: 'superadmin', organizacionId: null, passwordHash, activo: true });
  creados.push({ email: 'super@leadflow.demo', password: PASSWORD_DEMO });
  for (const o of ORGANIZACIONES) {
    const org = await db.plataforma.organizaciones.create({ nombre: o.nombre, cuit: o.cuit, plan: 'prueba', verticalCodigo: '', llmActivo: true, activa: true });
    const repo = db.org(org._id).usuarios;
    for (const [rol, email] of o.usuarios) {
      await repo.create({ nombre: `${rol} ${o.nombre}`, email, rol, passwordHash, activo: true });
      creados.push({ email, password: PASSWORD_DEMO });
    }
  }
  return creados;
}
