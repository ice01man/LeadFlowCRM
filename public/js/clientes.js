// "Mis clientes": panel del consultor con el estado de cada organización (plan, CRM y uso).
import { el, poner, vaciar, sesion, barra, aviso, moneda, fecha } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.esSuperadmin) location.replace('/inicio');
barra(s, '/clientes');

const app = vaciar(document.getElementById('app'));
const ESTADO_PLAN = { borrador: 'Propuesta en borrador', en_curso: 'Plan en curso', pausado: 'Plan pausado', finalizado: 'Plan finalizado' };
const [{ clientes, cartera }, verticales] = await Promise.all([api('GET', '/plataforma/clientes'), api('GET', '/verticales')]);
const dinero = (n, moneda) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, maximumFractionDigits: 0 }).format(n || 0);
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
    lineaCobros(c.cobros),
    el('div', { class: 'mini-metricas' },
      mini(String(m.contactos), 'contactos'), mini(String(m.clientes), 'clientes'), mini(String(m.oportunidadesAbiertas), 'oport. abiertas'),
      mini(moneda(m.valorAbierto), 'en juego'), mini(String(m.ganadas30), 'ganadas (30 d)'), mini(String(m.tareasVencidas), 'tareas vencidas')),
    el('div', { class: 'acciones' },
      el('button', { type: 'button', onclick: () => ir(c._id, '/plan') }, p ? 'Ver plan' : 'Cargar plan'),
      el('button', { type: 'button', class: 'secundario', onclick: () => ir(c._id, '/inicio') }, 'Entrar al CRM')));
}

function lineaCobros(cb) {
  if (!cb.cantidad) return null;
  const partes = Object.entries(cb.totales).map(([mon, t]) => `${dinero(t.cobrado, mon)} cobrado de ${dinero(t.total, mon)}`);
  const vencido = Object.entries(cb.totales).filter(([, t]) => t.vencido).map(([mon, t]) => dinero(t.vencido, mon));
  const listo = Object.entries(cb.totales).filter(([, t]) => t.listo).map(([mon, t]) => dinero(t.listo, mon));
  return el('div', { class: 'cobros-linea' },
    el('div', { class: 'chico-texto' }, partes.join(' · ')),
    listo.length ? el('div', { class: 'chico-texto ok-texto' }, `Listo para cobrar: ${listo.join(' + ')}`) : null,
    vencido.length ? el('div', { class: 'alerta' }, `Cobro vencido: ${vencido.join(' + ')}`) : null,
    cb.proximo ? el('div', { class: 'suave chico-texto' }, `Próximo cobro: ${cb.proximo.concepto}, ${dinero(cb.proximo.monto, cb.proximo.moneda)} (${fecha(cb.proximo.fechaEstimada)})`) : null);
}

function resumenCartera() {
  const monedas = Object.entries(cartera);
  if (!monedas.length) return null;
  return el('section', { class: 'seccion' }, el('h2', {}, 'Cobros de la cartera'), el('p', { class: 'sub' }, 'Privado. Cada moneda por separado, sin conversión.'),
    el('div', { class: 'tabla-scroll' }, el('table', { class: 'comparacion' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Moneda'), ...['Total', 'Cobrado', 'Por cobrar', 'Listo para cobrar', 'Facturado', 'Vencido'].map((t) => el('th', { class: 'num' }, t)))),
      el('tbody', {}, monedas.map(([mon, t]) => el('tr', {}, el('td', {}, mon),
        ...['total', 'cobrado', 'porCobrar', 'listo', 'facturado', 'vencido'].map((k) => el('td', { class: `num${k === 'vencido' && t[k] ? ' alerta' : ''}` }, dinero(t[k], mon)))))))));
}

const enCurso = clientes.filter((c) => c.consultoria?.estado === 'en_curso').length;
const atrasos = clientes.reduce((a, c) => a + (c.consultoria?.atrasadas || 0), 0);
poner(app,
  el('div', { class: 'encabezado' },
    el('div', {}, el('h1', {}, 'Mis clientes'), el('p', { class: 'sub' }, `${clientes.length} organizaciones · ${enCurso} con plan en curso${atrasos ? ` · ${atrasos} tarea${atrasos === 1 ? '' : 's'} de plan atrasada${atrasos === 1 ? '' : 's'}` : ''}`)),
    el('div', { class: 'acciones' }, el('a', { class: 'boton', href: '/plataforma' }, 'Nuevo cliente'))),
  resumenCartera(),
  clientes.length ? el('div', { class: 'clientes-grilla' }, clientes.map(tarjeta)) : el('p', { class: 'vacio' }, 'Todavía no hay clientes. Creá el primero desde Plataforma.'),
);
// La CSP no permite estilos en línea escritos en el HTML: el ancho de la barra se fija desde JS.
document.querySelectorAll('.barra-avance span[data-ancho]').forEach((b) => { b.style.width = `${b.dataset.ancho}%`; });
