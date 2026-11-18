// "Mis clientes": panel del consultor con el estado de cada organización (plan, CRM y uso).
import { el, poner, vaciar, sesion, barra, aviso, moneda, fecha } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.esSuperadmin) location.replace('/inicio');
barra(s, '/clientes');

const app = vaciar(document.getElementById('app'));
const ESTADO_PLAN = { borrador: 'Propuesta en borrador', en_curso: 'Plan en curso', pausado: 'Plan pausado', finalizado: 'Plan finalizado' };
const [clientes, verticales] = await Promise.all([api('GET', '/plataforma/clientes'), api('GET', '/verticales')]);
const rubro = new Map(verticales.map((v) => [v.codigo, v.nombre]));

async function ir(orgId, destino) {
  try {
    await api('POST', '/auth/organizacion', { organizacionId: orgId });
    location.href = destino;
  } catch (e) { aviso(e.message, 'error'); }
}

function tarjeta(c) {
  const p = c.consultoria;
  const m = c.metricas;
  const mini = (n, t) => el('div', {}, el('strong', {}, n), t);
  return el('article', { class: 'cliente' },
    el('div', { class: 'encabezado' },
      el('div', {}, el('h2', {}, c.nombre), el('span', { class: 'suave chico-texto' }, `${rubro.get(c.verticalCodigo) || c.verticalCodigo}${c.activa ? '' : ' · suspendida'}`)),
      el('span', { class: `semaforo ${c.uso.color}` }, c.uso.texto)),
    p ? el('div', {},
      el('div', { class: 'encabezado' }, el('span', { class: 'estado-plan' }, ESTADO_PLAN[p.estado]), el('strong', {}, `${p.avance} %`)),
      el('div', { class: 'barra-avance', role: 'progressbar', 'aria-valuenow': p.avance, 'aria-valuemin': 0, 'aria-valuemax': 100 }, el('span', { style: undefined, 'data-ancho': p.avance })),
      el('div', { class: 'suave chico-texto' }, [p.titulo, p.faseActual ? `Fase: ${p.faseActual}` : null, p.fechaFin ? `Termina ${fecha(p.fechaFin)}` : null].filter(Boolean).join(' · ')),
      p.proxima ? el('div', { class: 'chico-texto' }, `Próximo: ${p.proxima.titulo} (${fecha(p.proxima.fecha)}, ${p.proxima.responsable})`) : null,
      p.atrasadas ? el('div', { class: 'alerta' }, `${p.atrasadas} tarea${p.atrasadas === 1 ? '' : 's'} del plan atrasada${p.atrasadas === 1 ? '' : 's'}${p.atrasadasCliente ? ` (${p.atrasadasCliente} del cliente)` : ''}`) : null)
      : el('p', { class: 'suave' }, 'Sin plan de consultoría cargado.'),
    el('div', { class: 'mini-metricas' },
      mini(String(m.contactos), 'contactos'), mini(String(m.clientes), 'clientes'), mini(String(m.oportunidadesAbiertas), 'oport. abiertas'),
      mini(moneda(m.valorAbierto), 'en juego'), mini(String(m.ganadas30), 'ganadas (30 d)'), mini(String(m.tareasVencidas), 'tareas vencidas')),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', onclick: () => ir(c._id, '/plan') }, p ? 'Ver plan' : 'Cargar plan'),
      el('button', { type: 'button', class: 'secundario', onclick: () => ir(c._id, '/inicio') }, 'Entrar al CRM')));
}

const enCurso = clientes.filter((c) => c.consultoria?.estado === 'en_curso').length;
const atrasos = clientes.reduce((a, c) => a + (c.consultoria?.atrasadas || 0), 0);
poner(app,
  el('div', { class: 'encabezado' },
    el('div', {}, el('h1', {}, 'Mis clientes'), el('p', { class: 'sub' }, `${clientes.length} organizaciones · ${enCurso} con plan en curso${atrasos ? ` · ${atrasos} tarea${atrasos === 1 ? '' : 's'} de plan atrasada${atrasos === 1 ? '' : 's'}` : ''}`)),
    el('div', { class: 'acciones' }, el('a', { class: 'boton', href: '/plataforma' }, 'Nuevo cliente'))),
  clientes.length ? el('div', { class: 'clientes-grilla' }, clientes.map(tarjeta)) : el('p', { class: 'vacio' }, 'Todavía no hay clientes. Creá el primero desde Plataforma.'),
);
// La CSP no permite estilos en línea escritos en el HTML: el ancho de la barra se fija desde JS.
document.querySelectorAll('.barra-avance span[data-ancho]').forEach((b) => { b.style.width = `${b.dataset.ancho}%`; });
