// Configuración comercial de la organización. Admin y consultor la editan; vendedor y lectura la consultan.
import { el, irA, poner, vaciar, sesion, barra, aviso, conBoton } from './ui.js';
import { api } from './api.js';
import { editorConfig, seccion } from './editorConfig.js';

const s = await sesion();
if (!s.organizacion) await irA('/clientes');
barra(s, '/configuracion');

const puedeEditar = ['admin', 'consultor'].includes(s.usuario.rol);
const esAdmin = s.usuario.rol === 'admin';
const app = document.getElementById('app');

let datos;

async function dibujar() {
  datos = await api('GET', '/organizacion/config');
  const vertical = await api('GET', `/verticales/${datos.verticalCodigo}`).catch(() => null);
  poner(vaciar(app), 
    el('h1', {}, 'Configuración comercial'),
    el('p', { class: 'sub' }, `${s.organizacion.nombre} · rubro ${vertical?.nombre || datos.verticalCodigo}. `,
      puedeEditar ? 'Los cambios valen solo para tu organización.' : 'Solo lectura: los cambios los hace el administrador o el consultor.'),
    ...editorConfig(datos.config, { editable: puedeEditar, guardar }),
    seccionGuiones(),
    seccionEmails(),
    seccionKPIs(),
    esAdmin ? seccionRestaurar(vertical) : null,
  );
}

async function guardar(boton, cambios, mensaje) {
  await conBoton(boton, async () => {
    await api('PATCH', '/organizacion/config', cambios);
    aviso(mensaje);
    await dibujar();
  });
}


// ---------- Guiones, emails y KPIs (consulta) ----------
function seccionGuiones() {
  const lista = datos.config.scriptsVisita;
  return seccion('Guiones de visita', 'Pasos sugeridos para cada tipo de visita. La edición llega con el módulo de actividades.',
    lista.length ? lista.map((g) => el('details', {}, el('summary', {}, g.titulo), el('ol', { class: 'pasos' }, g.pasos.map((p) => el('li', {}, p)))))
      : el('p', { class: 'vacio' }, 'Sin guiones cargados.'));
}

function seccionEmails() {
  const lista = datos.config.templatesEmail;
  return seccion('Plantillas de email', 'Las palabras entre llaves dobles se reemplazan por los datos del contacto al enviar.',
    lista.length ? lista.map((t) => el('details', {}, el('summary', {}, t.asunto),
      el('pre', { class: 'email' }, t.cuerpo),
      el('div', { class: 'chips' }, t.variables.map((v) => el('span', { class: 'chip' }, `{{${v}}}`)))))
      : el('p', { class: 'vacio' }, 'Sin plantillas cargadas.'));
}

function seccionKPIs() {
  return seccion('Indicadores (KPIs)', 'Se calculan en el dashboard a partir de las ventas y oportunidades registradas.',
    el('div', { class: 'tabla-scroll' }, el('table', {}, el('tbody', {}, datos.config.kpiConfig.map((k) => el('tr', {}, el('td', {}, el('strong', {}, k.nombre)), el('td', { class: 'suave' }, k.descripcion)))))));
}

// ---------- Restaurar ----------
function seccionRestaurar(vertical) {
  const boton = el('button', { type: 'button', class: 'peligro' }, 'Restaurar desde la plantilla');
  boton.addEventListener('click', () => {
    if (!confirm('Se van a perder todos los ajustes propios y se vuelve a la configuración original del rubro. ¿Continuar?')) return;
    conBoton(boton, async () => {
      await api('POST', '/organizacion/config/restaurar');
      aviso('Configuración restaurada desde la plantilla.');
      await dibujar();
    });
  });
  return seccion('Restaurar configuración', `Vuelve a copiar la configuración original de ${vertical?.nombre || 'tu rubro'}. Solo el administrador puede hacerlo.`,
    el('div', { class: 'acciones' }, boton));
}

// Al final: las funciones y constantes de arriba ya están definidas.
await dibujar();
