// Plan de consultoría del cliente.
// Consultor (superadmin): edita propuesta, documentos, metas y fases; cambia el estado; lleva la bitácora privada.
// Cliente: lo ve en solo lectura; su administrador marca las tareas que le tocan.
import { el, poner, vaciar, sesion, barra, aviso, conBoton, campo, selector, fecha, fechaInput, fechaHora, moneda } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (!s.organizacion) location.replace('/clientes');
barra(s, '/plan');

const app = document.getElementById('app');
const ESTADO = { borrador: 'Borrador', en_curso: 'En curso', pausado: 'Pausado', finalizado: 'Finalizado' };
const ESTADO_TAREA = { pendiente: 'Pendiente', en_progreso: 'En progreso', completada: 'Completada', cancelada: 'Cancelada' };
const RESP = { consultor: 'Consultor', cliente: 'Cliente' };
const TIPO_BIT = { reunion: 'Reunión', avance: 'Avance', decision: 'Decisión', riesgo: 'Riesgo', nota: 'Nota' };
const PLANTILLA = [
  { nombre: 'Diagnóstico', tareas: [{ titulo: 'Relevar cartera y proceso comercial actual', responsable: 'consultor' }, { titulo: 'Compartir listados de clientes y ventas', responsable: 'cliente' }] },
  { nombre: 'Diseño del plan comercial', tareas: [{ titulo: 'Definir segmentos, etapas y criterios BANT', responsable: 'consultor' }, { titulo: 'Validar propuesta con la dirección', responsable: 'cliente' }] },
  { nombre: 'Implementación', tareas: [{ titulo: 'Cargar contactos y asignar vendedores', responsable: 'consultor' }, { titulo: 'Capacitar al equipo en el CRM', responsable: 'consultor' }] },
  { nombre: 'Seguimiento y cierre', tareas: [{ titulo: 'Revisión mensual de indicadores', responsable: 'consultor' }, { titulo: 'Informe final y recomendaciones', responsable: 'consultor' }] },
];

let datos; // respuesta de /consultoria/plan
let borrador; // copia editable (solo consultor)

async function cargar() {
  datos = await api('GET', '/consultoria/plan');
  borrador = datos.plan ? structuredClone(datos.plan) : { titulo: '', objetivo: '', alcance: '', fechaInicio: null, fechaFin: null, documentos: [], metas: [], fases: [] };
  dibujar();
  if (datos.esConsultor) await Promise.all([cargarBitacora(), cargarCobros()]);
}

function dibujar() {
  vaciar(app);
  const { plan, resumen, esConsultor } = datos;
  poner(app,
    el('div', { class: 'encabezado' },
      el('div', {}, el('h1', {}, plan?.titulo || 'Plan de consultoría'),
        el('p', { class: 'sub' }, `${s.organizacion.nombre}${plan ? ` · ${fecha(plan.fechaInicio)} al ${fecha(plan.fechaFin)}` : ''}`)),
      plan ? el('div', { class: 'acciones' }, el('span', { class: 'estado-plan' }, ESTADO[plan.estado]), ...(esConsultor ? accionesEstado(plan) : [])) : null),
    resumen ? seccionResumen(resumen) : null,
    esConsultor ? editor() : lectura(),
    esConsultor ? seccionCobros() : null,
    esConsultor && plan?.metricasInicio ? seccionImpacto(plan, datos.metricasActuales) : null,
    esConsultor ? seccionBitacora() : null,
  );
  document.querySelectorAll('.barra-avance span[data-ancho]').forEach((b) => { b.style.width = `${b.dataset.ancho}%`; });
}

// ---------- Resumen y estado ----------
function seccionResumen(r) {
  return el('section', { class: 'seccion' },
    el('div', { class: 'encabezado' }, el('h2', {}, `Avance ${r.avance} %`), el('span', { class: 'suave' }, `${r.tareasCompletadas} de ${r.tareasTotal} tareas`)),
    el('div', { class: 'barra-avance' }, el('span', { 'data-ancho': r.avance })),
    el('p', { class: 'suave' }, [r.faseActual ? `Fase actual: ${r.faseActual}` : null, r.proxima ? `Próximo: ${r.proxima.titulo} (${fecha(r.proxima.fecha)}, ${RESP[r.proxima.responsable]})` : null].filter(Boolean).join(' · ')),
    r.atrasadas ? el('p', { class: 'alerta' }, `${r.atrasadas} tarea${r.atrasadas === 1 ? '' : 's'} atrasada${r.atrasadas === 1 ? '' : 's'}${r.atrasadasCliente ? `, ${r.atrasadasCliente} a cargo del cliente` : ''}.`) : null);
}

function accionesEstado(plan) {
  const boton = (texto, accion, clase = 'secundario') => {
    const b = el('button', { type: 'button', class: clase }, texto);
    b.addEventListener('click', () => conBoton(b, async () => {
      let conclusiones;
      if (accion === 'finalizar') {
        conclusiones = prompt('Conclusiones del plan (resultados, aprendizajes):');
        if (conclusiones === null) return;
      } else if (accion === 'iniciar' && !confirm('Al iniciar se guarda una foto de las métricas actuales del CRM para medir el impacto. ¿Iniciar el plan?')) return;
      await api('POST', '/consultoria/plan/estado', { accion, conclusiones });
      aviso(`Plan ${{ iniciar: 'iniciado', pausar: 'pausado', reanudar: 'reanudado', finalizar: 'finalizado', reabrir: 'reabierto' }[accion]}.`);
      await cargar();
    }));
    return b;
  };
  return {
    borrador: [boton('Iniciar plan', 'iniciar', '')],
    en_curso: [boton('Pausar', 'pausar'), boton('Finalizar', 'finalizar', '')],
    pausado: [boton('Reanudar', 'reanudar', ''), boton('Finalizar', 'finalizar')],
    finalizado: [boton('Reabrir', 'reabrir')],
  }[plan.estado] || [];
}

// ---------- Vista del cliente (solo lectura) ----------
function lectura() {
  const { plan } = datos;
  if (!plan) return el('section', { class: 'seccion' }, el('p', { class: 'vacio' }, 'Tu consultor todavía no cargó el plan de trabajo.'));
  const marca = s.usuario.rol === 'admin' && plan.estado === 'en_curso';
  return el('div', {},
    el('section', { class: 'seccion' }, el('h2', {}, 'Propuesta de trabajo'),
      plan.objetivo ? el('div', {}, el('strong', {}, 'Objetivo'), el('p', {}, plan.objetivo)) : null,
      plan.alcance ? el('div', {}, el('strong', {}, 'Alcance'), el('p', {}, plan.alcance)) : null,
      plan.documentos.length ? el('div', {}, el('strong', {}, 'Documentos'), el('ul', {}, plan.documentos.map((d) => el('li', {}, el('a', { href: d.url, target: '_blank', rel: 'noopener' }, d.nombre))))) : null),
    plan.metas.length ? el('section', { class: 'seccion' }, el('h2', {}, 'Metas'), tablaMetasLectura(plan.metas)) : null,
    el('section', { class: 'seccion' }, el('h2', {}, 'Fases y tareas'),
      marca ? el('p', { class: 'sub' }, 'Podés marcar como completadas las tareas que le tocan a tu organización.') : null,
      plan.fases.map((f) => el('div', { class: 'fase' },
        el('strong', {}, f.nombre), el('span', { class: 'suave chico-texto' }, f.fechaInicio || f.fechaFin ? ` · ${fecha(f.fechaInicio)} al ${fecha(f.fechaFin)}` : ''),
        el('ul', { class: 'lista-tareas' }, f.tareas.map((t) => {
          const puede = marca && t.responsable === 'cliente' && t.estado !== 'cancelada';
          const check = el('input', { type: 'checkbox', 'aria-label': `Completar ${t.titulo}`, checked: t.estado === 'completada', disabled: !puede });
          check.addEventListener('change', async () => {
            try { await api('PATCH', `/consultoria/plan/tareas/${t.codigo}`, { estado: check.checked ? 'completada' : 'pendiente' }); aviso('Tarea actualizada.'); } catch (e) { aviso(e.message, 'error'); }
            await cargar();
          });
          return el('li', { class: t.estado === 'completada' ? 'hecha' : '' }, check, el('div', { class: 'info' }, el('strong', {}, t.titulo),
            el('div', { class: 'suave chico-texto' }, `${RESP[t.responsable]} · ${ESTADO_TAREA[t.estado]}${t.fechaVencimiento ? ` · vence ${fecha(t.fechaVencimiento)}` : ''}`)));
        }))))));
}

function tablaMetasLectura(metas) {
  return el('div', { class: 'tabla-scroll' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Meta', 'Inicial', 'Objetivo', 'Actual'].map((t, i) => el('th', { class: i ? 'num' : '' }, t)))),
    el('tbody', {}, metas.map((m) => el('tr', {}, el('td', {}, m.nombre),
      ...[m.valorInicial, m.valorObjetivo, m.valorActual].map((v) => el('td', { class: 'num' }, v === null || v === undefined ? '—' : `${v.toLocaleString('es-AR')} ${m.unidad || ''}`)))))));
}

// ---------- Editor del consultor ----------
function editor() {
  const finalizado = datos.plan?.estado === 'finalizado';
  const inp = (obj, clave, attrs = {}) => {
    const n = el(attrs.tag || 'input', { ...attrs, tag: undefined, disabled: finalizado });
    if (attrs.tag === 'textarea') n.value = obj[clave] || ''; else n.value = attrs.type === 'date' ? fechaInput(obj[clave]) : (obj[clave] ?? '');
    n.addEventListener('input', () => { obj[clave] = n.value === '' ? null : n.value; });
    return n;
  };

  const propuesta = el('section', { class: 'seccion' }, el('h2', {}, 'Propuesta de trabajo'), el('p', { class: 'sub' }, 'El cliente ve esta sección (y metas y fases) en solo lectura.'),
    el('div', { class: 'campos' },
      campo('Título', inp(borrador, 'titulo', { id: 'p-titulo', maxlength: 150, placeholder: 'Ej.: Plan comercial Zona Oeste 2027' })),
      el('div', { class: 'campos' }, campo('Inicio', inp(borrador, 'fechaInicio', { id: 'p-inicio', type: 'date' })), campo('Fin', inp(borrador, 'fechaFin', { id: 'p-fin', type: 'date' })))),
    campo('Objetivo', inp(borrador, 'objetivo', { id: 'p-objetivo', tag: 'textarea', rows: 3 })),
    campo('Alcance', inp(borrador, 'alcance', { id: 'p-alcance', tag: 'textarea', rows: 4 })));

  // Documentos (links a Drive)
  const docs = el('div');
  const dibujarDocs = () => {
    vaciar(docs).append(...borrador.documentos.map((d, i) => el('div', { class: 'fila-doc' },
      inp(d, 'nombre', { 'aria-label': 'Nombre del documento', placeholder: 'Propuesta firmada', maxlength: 100 }),
      inp(d, 'url', { 'aria-label': 'Link del documento', placeholder: 'https://drive.google.com/…', type: 'url' }),
      el('button', { type: 'button', class: 'icono', disabled: finalizado, onclick: () => { borrador.documentos.splice(i, 1); dibujarDocs(); } }, 'Quitar'))));
  };
  dibujarDocs();
  const secDocs = el('section', { class: 'seccion' }, el('h2', {}, 'Documentos'), el('p', { class: 'sub' }, 'Links a tu Drive de consultorías. Revisá que el cliente tenga permiso para abrirlos.'), docs,
    finalizado ? null : el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'secundario chico', onclick: () => { borrador.documentos.push({ nombre: '', url: '' }); dibujarDocs(); } }, 'Agregar link')));

  // Metas
  const metas = el('tbody');
  const dibujarMetas = () => {
    vaciar(metas).append(...borrador.metas.map((m, i) => el('tr', {},
      el('td', {}, inp(m, 'nombre', { 'aria-label': 'Meta', maxlength: 120, placeholder: 'Clientes activos' })),
      el('td', {}, inp(m, 'unidad', { 'aria-label': 'Unidad', maxlength: 20, placeholder: 'clientes' })),
      ...['valorInicial', 'valorObjetivo', 'valorActual'].map((k) => el('td', {}, inp(m, k, { 'aria-label': k, type: 'number', class: 'num' }))),
      el('td', {}, el('button', { type: 'button', class: 'icono', disabled: finalizado, onclick: () => { borrador.metas.splice(i, 1); dibujarMetas(); } }, 'Quitar')))));
  };
  dibujarMetas();
  const secMetas = el('section', { class: 'seccion' }, el('h2', {}, 'Metas'), el('p', { class: 'sub' }, 'Lo que se compromete a mover el plan. Actualizá el valor actual en cada revisión.'),
    el('div', { class: 'tabla-scroll' }, el('table', { class: 'metas-tabla' }, el('thead', {}, el('tr', {}, ['Meta', 'Unidad', 'Inicial', 'Objetivo', 'Actual', ''].map((t) => el('th', {}, t)))), metas)),
    finalizado ? null : el('div', { class: 'acciones' }, el('button', { type: 'button', class: 'secundario chico', onclick: () => { borrador.metas.push({ nombre: '', unidad: '', valorInicial: null, valorObjetivo: null, valorActual: null }); dibujarMetas(); } }, 'Agregar meta')));

  // Fases
  const fases = el('div');
  const dibujarFases = () => {
    vaciar(fases).append(...borrador.fases.map((f, i) => {
      const tareas = el('tbody', {}, f.tareas.map((t, j) => el('tr', {},
        el('td', {}, inp(t, 'titulo', { 'aria-label': 'Tarea', maxlength: 200 })),
        el('td', {}, selConEfecto(t, 'responsable', Object.entries(RESP))),
        el('td', {}, inp(t, 'fechaVencimiento', { 'aria-label': 'Vence', type: 'date' })),
        el('td', {}, selConEfecto(t, 'estado', Object.entries(ESTADO_TAREA))),
        el('td', {}, el('button', { type: 'button', class: 'icono', disabled: finalizado, onclick: () => { f.tareas.splice(j, 1); dibujarFases(); } }, 'Quitar')))));
      return el('div', { class: 'fase' },
        el('div', { class: 'fase-cab' },
          campo(`Fase ${i + 1}`, inp(f, 'nombre', { id: `fase-${i}`, maxlength: 120 })),
          campo('Inicio', inp(f, 'fechaInicio', { id: `fase-${i}-ini`, type: 'date' })),
          campo('Fin', inp(f, 'fechaFin', { id: `fase-${i}-fin`, type: 'date' })),
          el('button', { type: 'button', class: 'peligro chico', disabled: finalizado, onclick: () => { if (confirm(`¿Quitar la fase "${f.nombre || i + 1}" y sus tareas?`)) { borrador.fases.splice(i, 1); dibujarFases(); } } }, 'Quitar fase')),
        el('div', { class: 'tabla-scroll' }, el('table', {}, el('thead', {}, el('tr', {}, ['Tarea', 'Responsable', 'Vence', 'Estado', ''].map((x) => el('th', {}, x)))), tareas)),
        finalizado ? null : el('button', { type: 'button', class: 'secundario chico', onclick: () => { f.tareas.push({ titulo: '', responsable: 'consultor', estado: 'pendiente', fechaVencimiento: null }); dibujarFases(); } }, 'Agregar tarea'));
    }));
  };
  function selConEfecto(obj, clave, opciones) {
    const sel = selector({ 'aria-label': clave, disabled: finalizado }, opciones, obj[clave]);
    sel.addEventListener('change', () => { obj[clave] = sel.value; });
    return sel;
  }
  dibujarFases();
  const secFases = el('section', { class: 'seccion' }, el('h2', {}, 'Fases y tareas'), el('p', { class: 'sub' }, 'El avance del plan se calcula con las tareas completadas. Las canceladas no cuentan.'), fases,
    finalizado ? null : el('div', { class: 'acciones' },
      el('button', { type: 'button', class: 'secundario chico', onclick: () => { borrador.fases.push({ nombre: '', tareas: [] }); dibujarFases(); } }, 'Agregar fase'),
      borrador.fases.length ? null : el('button', { type: 'button', class: 'secundario chico', onclick: () => { borrador.fases = structuredClone(PLANTILLA).map((f) => ({ ...f, tareas: f.tareas.map((t) => ({ ...t, estado: 'pendiente' })) })); dibujarFases(); } }, 'Usar fases sugeridas')));

  const guardar = el('button', { type: 'button' }, datos.plan ? 'Guardar cambios del plan' : 'Crear plan');
  guardar.addEventListener('click', () => conBoton(guardar, async () => {
    await api('PUT', '/consultoria/plan', borrador);
    aviso('Plan guardado.');
    await cargar();
  }));
  return el('div', {}, propuesta, secDocs, secMetas, secFases,
    finalizado ? el('section', { class: 'seccion' }, el('h2', {}, 'Conclusiones'), el('p', {}, datos.plan.conclusiones || '—'))
      : el('div', { class: 'acciones' }, guardar));
}

// ---------- Impacto (foto inicial vs hoy vs cierre) ----------
function seccionImpacto(plan, actuales) {
  const filas = [['contactos', 'Contactos'], ['clientes', 'Clientes'], ['leads', 'Leads'], ['oportunidadesAbiertas', 'Oportunidades abiertas'], ['valorAbierto', 'Valor en juego', true], ['ganadas30', 'Ganadas (últimos 30 días)'], ['valorGanado30', 'Valor ganado (30 días)', true], ['actividades30', 'Actividades (30 días)'], ['tareasVencidas', 'Tareas vencidas']];
  const fin = plan.metricasCierre;
  const v = (m, k, $) => (m ? ($ ? moneda(m[k]) : String(m[k] ?? '—')) : '—');
  return el('section', { class: 'seccion' }, el('h2', {}, 'Impacto en el CRM'),
    el('p', { class: 'sub' }, `Foto tomada al iniciar (${fechaHora(plan.metricasInicio.fecha)}) comparada con hoy${fin ? ' y con el cierre' : ''}. Esto es lo que la IA va a usar para aprender qué funcionó.`),
    el('div', { class: 'tabla-scroll' }, el('table', { class: 'comparacion' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Indicador'), el('th', { class: 'num' }, 'Al iniciar'), el('th', { class: 'num' }, 'Hoy'), fin ? el('th', { class: 'num' }, 'Al cerrar') : null)),
      el('tbody', {}, filas.map(([k, t, $]) => el('tr', {}, el('td', {}, t), el('td', { class: 'num' }, v(plan.metricasInicio, k, $)), el('td', { class: 'num' }, v(actuales, k, $)), fin ? el('td', { class: 'num' }, v(fin, k, $)) : null))))));
}

// ---------- Bitácora privada ----------
const listaBitacora = el('ul', { class: 'linea-tiempo' });
function seccionBitacora() {
  const tipo = selector({ id: 'b-tipo' }, Object.entries(TIPO_BIT), 'reunion');
  const texto = el('textarea', { id: 'b-texto', rows: 3, placeholder: 'Qué se habló, qué se decidió, qué riesgo apareció…' });
  const agregar = el('button', { type: 'button' }, 'Agregar a la bitácora');
  agregar.addEventListener('click', () => conBoton(agregar, async () => {
    await api('POST', '/consultoria/bitacora', { tipo: tipo.value, texto: texto.value });
    texto.value = '';
    aviso('Entrada agregada.');
    await cargarBitacora();
  }));
  return el('section', { class: 'seccion' }, el('h2', {}, 'Bitácora'), el('p', { class: 'sub' }, 'Privada: el cliente no la ve.'),
    el('div', { class: 'campos' }, campo('Tipo', tipo)), campo('Detalle', texto), el('div', { class: 'acciones' }, agregar), listaBitacora);
}

async function cargarBitacora() {
  const lista = await api('GET', '/consultoria/bitacora');
  vaciar(listaBitacora).append(...(lista.length ? lista.map((b) => el('li', {},
    el('div', { class: 'cabecera' }, el('strong', {}, TIPO_BIT[b.tipo]), el('span', { class: 'suave chico-texto' }, fechaHora(b.fecha)),
      el('button', { type: 'button', class: 'icono', onclick: async () => { if (!confirm('¿Borrar esta entrada?')) return; await api('DELETE', `/consultoria/bitacora/${b._id}`); await cargarBitacora(); } }, 'Borrar')),
    el('p', {}, b.texto))) : [el('li', { class: 'vacio' }, 'Sin entradas todavía.')]));
}


// ---------- Cobros (privados del consultor) ----------
const SITUACION = { pendiente: 'Pendiente', listo: 'Listo para cobrar', facturado: 'Facturado', cobrado: 'Cobrado', cancelado: 'Cancelado' };
const dinero = (n, moneda) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: moneda, maximumFractionDigits: 2 }).format(n || 0);
const cajaCobros = el('div');
const totalesCobros = el('div', { class: 'totales' });

function seccionCobros() {
  const fases = datos.plan?.fases || [];
  const concepto = el('input', { id: 'c-concepto', maxlength: 150, placeholder: 'Ej.: Anticipo 30 %' });
  const monto = el('input', { id: 'c-monto', type: 'number', min: 0, step: '0.01' });
  const moneda = selector({ id: 'c-moneda' }, [['ARS', 'Pesos (ARS)'], ['USD', 'Dólares (USD)']], 'ARS');
  const disparador = selector({ id: 'c-disparador' }, [['manual', 'Lo marco yo'], ['fase', 'Al completar una fase'], ['fecha', 'En una fecha']], 'manual');
  const fase = selector({ id: 'c-fase' }, fases.map((f) => [f.codigo, f.nombre]));
  const fechaEst = el('input', { id: 'c-fecha', type: 'date' });
  const campoFase = campo('Fase', fase, fases.length ? null : 'Guardá primero el plan con sus fases.');
  const ajustar = () => campoFase.classList.toggle('oculto', disparador.value !== 'fase');
  disparador.addEventListener('change', ajustar);
  ajustar();
  const agregar = el('button', { type: 'button' }, 'Agregar cobro');
  agregar.addEventListener('click', () => conBoton(agregar, async () => {
    await api('POST', '/consultoria/cobros', { concepto: concepto.value, monto: monto.value, moneda: moneda.value, disparador: disparador.value, faseCodigo: disparador.value === 'fase' ? fase.value : '', fechaEstimada: fechaEst.value || null });
    concepto.value = ''; monto.value = ''; fechaEst.value = '';
    aviso('Cobro agregado.');
    await cargarCobros();
  }));
  return el('section', { class: 'seccion' }, el('h2', {}, 'Cobros'), el('p', { class: 'sub' }, 'Privado: el cliente no ve esta sección. Un cobro atado a una fase pasa solo a "Listo para cobrar" cuando se completan sus tareas.'),
    totalesCobros, cajaCobros,
    el('h3', { class: 'sub' }, 'Nuevo hito de cobro'),
    el('div', { class: 'campos' }, campo('Concepto', concepto), campo('Monto', monto), campo('Moneda', moneda), campo('Se cobra', disparador), campoFase, campo('Fecha estimada de cobro', fechaEst)),
    el('div', { class: 'acciones' }, agregar));
}

async function cargarCobros() {
  const r = await api('GET', '/consultoria/cobros');
  vaciar(totalesCobros).append(...Object.entries(r.totales).flatMap(([mon, t]) => [
    el('div', {}, el('strong', {}, dinero(t.cobrado, mon)), `cobrado de ${dinero(t.total, mon)}`),
    el('div', {}, el('strong', {}, dinero(t.listo, mon)), 'listo para cobrar'),
    t.vencido ? el('div', { class: 'alerta' }, el('strong', {}, dinero(t.vencido, mon)), 'vencido') : el('div', {}, el('strong', {}, dinero(t.porCobrar, mon)), 'por cobrar'),
  ]));
  vaciar(cajaCobros);
  if (!r.items.length) { cajaCobros.append(el('p', { class: 'vacio' }, 'Sin hitos de cobro. Cargá los de la propuesta (anticipo, cierre de fases, abonos).')); return; }
  const accion = (texto, fn, clase = 'icono') => el('button', { type: 'button', class: clase, onclick: fn }, texto);
  const estado = async (c, est) => {
    let comprobanteUrl;
    if (est === 'cobrado') {
      comprobanteUrl = prompt('Link de la factura o comprobante (opcional):', c.comprobanteUrl || '');
      if (comprobanteUrl === null) return;
    }
    try { await api('POST', `/consultoria/cobros/${c._id}/estado`, { estado: est, comprobanteUrl: comprobanteUrl || undefined }); aviso('Cobro actualizado.'); } catch (e) { aviso(e.message, 'error'); }
    await cargarCobros();
  };
  cajaCobros.append(el('div', { class: 'tabla-scroll' }, el('table', {},
    el('thead', {}, el('tr', {}, ['Concepto', 'Monto', 'Cuándo', 'Situación', ''].map((t, i) => el('th', { class: i === 1 ? 'num' : '' }, t)))),
    el('tbody', {}, r.items.map((c) => el('tr', {},
      el('td', {}, el('strong', {}, c.concepto), c.comprobanteUrl ? el('div', {}, el('a', { href: c.comprobanteUrl, target: '_blank', rel: 'noopener', class: 'chico-texto' }, 'Comprobante')) : null),
      el('td', { class: 'num sin-corte' }, dinero(c.monto, c.moneda)),
      el('td', { class: 'chico-texto' }, c.disparador === 'fase' ? `Al completar "${c.faseNombre || 'fase eliminada'}"` : c.disparador === 'fecha' ? 'En la fecha' : 'Lo marco yo',
        c.fechaEstimada ? el('div', { class: 'suave' }, `Estimado ${fecha(c.fechaEstimada)}`) : null,
        c.fechaCobro ? el('div', { class: 'suave' }, `Cobrado ${fecha(c.fechaCobro)}`) : c.fechaFacturado ? el('div', { class: 'suave' }, `Facturado ${fecha(c.fechaFacturado)}`) : null),
      el('td', {}, el('span', { class: `etiqueta ${c.situacion === 'cobrado' ? 'ok' : c.vencido ? 'no' : c.situacion === 'listo' ? 'ok' : ''}` }, `${SITUACION[c.situacion]}${c.vencido ? ' · vencido' : ''}`)),
      el('td', {}, el('div', { class: 'acciones-celda' },
        c.disparador === 'manual' && c.situacion === 'pendiente' ? accion('Listo', async () => { await api('PATCH', `/consultoria/cobros/${c._id}`, { listoManual: true }); await cargarCobros(); }) : null,
        ['pendiente', 'listo'].includes(c.situacion) ? accion('Facturado', () => estado(c, 'facturado')) : null,
        ['pendiente', 'listo', 'facturado'].includes(c.situacion) ? accion('Cobrado', () => estado(c, 'cobrado')) : null,
        ['facturado', 'cobrado', 'cancelado'].includes(c.situacion) ? accion('Deshacer', () => estado(c, 'pendiente')) : null,
        c.situacion !== 'cobrado' ? accion('Borrar', async () => { if (!confirm(`¿Borrar "${c.concepto}"?`)) return; try { await api('DELETE', `/consultoria/cobros/${c._id}`); } catch (e) { aviso(e.message, 'error'); } await cargarCobros(); }) : null))))))));
}

// Al final: todas las funciones y constantes de arriba ya están definidas.
await cargar();
