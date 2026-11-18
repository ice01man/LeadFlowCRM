// Resumen para la pantalla de Inicio, en un solo pedido. Respeta el alcance de cada rol:
// el vendedor ve sus oportunidades, sus contactos y sus tareas; el resto, los de toda la organización.
import * as oportunidades from './oportunidades.js';
import * as tareas from './tareas.js';
import * as contactos from './contactos.js';
import * as actividades from './actividades.js';
import { ROL } from '../config/roles.js';

export async function resumen(ctx) {
  const hace30 = new Date(Date.now() - 30 * 864e5);
  const alcance = ctx.usuario.rol === ROL.VENDEDOR ? { owner: ctx.usuario.id } : {};
  const [pipeline, misTareas, dormidos, recientes, ganadas, totalContactos] = await Promise.all([
    oportunidades.pipeline(ctx),
    tareas.listar(ctx, { owner: 'yo' }),
    contactos.listar(ctx, { vista: 'dormidos', porPagina: 5, orden: 'nombre' }),
    actividades.listar(ctx, { porPagina: 6 }),
    ctx.db.oportunidades.list({ ...alcance, estado: 'ganada', fechaCierre: { $gte: hace30 } }, { limit: 10000 }),
    ctx.db.contactos.count({ ...alcance, activo: true }),
  ]);
  const paraHoy = [...misTareas.vencidas, ...misTareas.hoy];
  return {
    pipeline: {
      totales: pipeline.totales,
      etapas: pipeline.columnas.map(({ items, ...c }) => c),
    },
    ganadas30: { cantidad: ganadas.length, valor: ganadas.reduce((a, o) => a + (o.valorEstimado || 0), 0) },
    tareas: { vencidas: misTareas.vencidas.length, hoy: misTareas.hoy.length, proximas: misTareas.proximas.length, lista: paraHoy.slice(0, 7) },
    dormidos: { total: dormidos.total, lista: dormidos.items },
    actividad: recientes.items,
    contactos: totalContactos,
  };
}
