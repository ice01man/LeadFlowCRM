// Pantalla del superadmin: organizaciones (clientes del SaaS) y plantillas de vertical.
import { el, poner, vaciar, sesion, barra, aviso, conBoton } from './ui.js';
import { api } from './api.js';

const s = await sesion();
if (s.usuario.rol !== 'superadmin') location.replace('/inicio');
barra(s, '/plataforma');

const app = vaciar(document.getElementById('app'));
const PLANES = [['prueba', 'Prueba'], ['basico', 'Básico'], ['profesional', 'Profesional']];
const fecha = (d) => new Date(d).toLocaleDateString('es-AR');

const listaOrgs = el('div', { class: 'tabla-scroll' });
const listaVerticales = el('div');
const selectVertical = el('select', { id: 'org-vertical', name: 'verticalCodigo', required: true });

poner(app, 
  el('h1', {}, 'Plataforma'),
  el('p', { class: 'sub' }, 'Clientes del SaaS y plantillas de rubro.'),
  seccionAlta(),
  el('section', { class: 'seccion' }, el('h2', {}, 'Organizaciones'), el('p', { class: 'sub' }, 'Suspender una organización corta el acceso de todos sus usuarios al instante.'), listaOrgs),
  el('section', { class: 'seccion', id: 'verticales' }, el('h2', {}, 'Plantillas de vertical'),
    el('p', { class: 'sub' }, 'Cada organización recibe una copia al darse de alta. Cambiar una plantilla no modifica a las organizaciones que ya la usan.'), listaVerticales),
);

let verticales = [];
await Promise.all([cargarVerticales(), cargarOrgs()]);
if (location.hash === '#verticales') document.getElementById('verticales').scrollIntoView();

// ---------- Alta ----------
function campo(etiqueta, input) {
  return el('div', {}, el('label', { for: input.id }, etiqueta), input);
}

function seccionAlta() {
  const form = el('form', { novalidate: true },
    el('div', { class: 'campos' },
      campo('Nombre de la organización', el('input', { id: 'org-nombre', name: 'nombre', required: true, maxlength: 120 })),
      campo('CUIT (opcional)', el('input', { id: 'org-cuit', name: 'cuit', placeholder: '30-12345678-9', maxlength: 13 })),
      campo('Rubro', selectVertical),
      campo('Plan', el('select', { id: 'org-plan', name: 'plan' }, PLANES.map(([v, t]) => el('option', { value: v }, t)))),
    ),
    el('h3', { class: 'sub' }, 'Administrador de la organización'),
    el('div', { class: 'campos' },
      campo('Nombre y apellido', el('input', { id: 'adm-nombre', name: 'admNombre', required: true, maxlength: 120 })),
      campo('Email', el('input', { id: 'adm-email', name: 'admEmail', type: 'email', required: true, autocomplete: 'off' })),
      campo('Contraseña inicial (mínimo 8)', el('input', { id: 'adm-pass', name: 'admPass', type: 'password', required: true, minlength: 8, autocomplete: 'new-password' })),
    ),
    el('div', { class: 'acciones' }, el('button', { type: 'submit' }, 'Crear organización')),
  );
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const f = form.elements;
    conBoton(form.querySelector('button[type=submit]'), async () => {
      const r = await api('POST', '/organizaciones', {
        nombre: f.nombre.value, cuit: f.cuit.value, verticalCodigo: f.verticalCodigo.value, plan: f.plan.value,
        admin: { nombre: f.admNombre.value, email: f.admEmail.value, password: f.admPass.value },
      });
      form.reset();
      aviso(`Organización "${r.organizacion.nombre}" creada. Su admin ya puede ingresar con ${r.admin.email}.`);
      await cargarOrgs();
    });
  });
  return el('section', { class: 'seccion' }, el('h2', {}, 'Nueva organización'),
    el('p', { class: 'sub' }, 'Se crea con la configuración del rubro elegido y un usuario administrador.'), form);
}

// ---------- Organizaciones ----------
async function cargarOrgs() {
  const orgs = await api('GET', '/organizaciones');
  const nombreVertical = (c) => verticales.find((v) => v.codigo === c)?.nombre || c || '—';
  vaciar(listaOrgs);
  if (!orgs.length) { listaOrgs.append(el('p', { class: 'vacio' }, 'Todavía no hay organizaciones. Creá la primera con el formulario de arriba.')); return; }
  listaOrgs.append(el('table', {},
    el('thead', {}, el('tr', {}, ['Nombre', 'Rubro', 'Plan', 'Estado', 'Alta', ''].map((t) => el('th', {}, t)))),
    el('tbody', {}, orgs.map((o) => {
      const boton = el('button', { type: 'button', class: o.activa ? 'peligro chico' : 'secundario chico' }, o.activa ? 'Suspender' : 'Reactivar');
      boton.addEventListener('click', () => conBoton(boton, async () => {
        if (o.activa && !confirm(`¿Suspender "${o.nombre}"? Sus usuarios no van a poder ingresar.`)) return;
        await api('PATCH', `/organizaciones/${o._id}`, { activa: !o.activa });
        aviso(o.activa ? 'Organización suspendida.' : 'Organización reactivada.');
        await cargarOrgs();
      }));
      return el('tr', {},
        el('td', {}, o.nombre, o.cuit ? el('div', { class: 'suave' }, o.cuit) : null),
        el('td', {}, nombreVertical(o.verticalCodigo)),
        el('td', {}, PLANES.find(([v]) => v === o.plan)?.[1] || o.plan),
        el('td', {}, el('span', { class: `etiqueta ${o.activa ? 'ok' : 'no'}` }, o.activa ? 'Activa' : 'Suspendida')),
        el('td', {}, fecha(o.createdAt)),
        el('td', { class: 'num' }, boton));
    }))));
}

// ---------- Verticales ----------
async function cargarVerticales() {
  verticales = await api('GET', '/verticales');
  poner(vaciar(selectVertical), el('option', { value: '' }, 'Elegí un rubro…'),
    ...verticales.filter((v) => v.activo).map((v) => el('option', { value: v.codigo }, v.nombre)));
  const detalles = await Promise.all(verticales.map((v) => api('GET', `/verticales/${v.codigo}`)));
  poner(vaciar(listaVerticales), ...detalles.map(tarjetaVertical));
}

function tarjetaVertical(v) {
  const boton = el('button', { type: 'button', class: 'secundario chico' }, v.activo ? 'Desactivar' : 'Activar');
  boton.addEventListener('click', () => conBoton(boton, async () => {
    await api('PATCH', `/verticales/${v.codigo}`, { activo: !v.activo });
    aviso(v.activo ? 'Plantilla desactivada: ya no se ofrece en altas nuevas.' : 'Plantilla activada.');
    await cargarVerticales();
  }));
  const totalPesos = v.criteriosBANT.reduce((a, c) => a + c.peso, 0) || 1;
  return el('details', {},
    el('summary', {}, v.nombre, ' ', el('span', { class: `etiqueta ${v.activo ? 'ok' : 'no'}` }, v.activo ? 'Activa' : 'Inactiva')),
    el('p', { class: 'suave' }, v.descripcion),
    el('div', { class: 'grilla dos' },
      el('div', {}, el('strong', {}, 'Etapas del pipeline'),
        el('ol', { class: 'pasos' }, v.etapasPipeline.map((e) => el('li', {}, `${e.nombre} · ${e.probabilidad} %`)))),
      el('div', {}, el('strong', {}, 'Pesos BANT'),
        el('ul', { class: 'pasos' }, v.criteriosBANT.map((c) => el('li', {}, `${c.nombre}: ${Math.round((c.peso / totalPesos) * 100)} %`)))),
      el('div', {}, el('strong', {}, 'Tipos de cliente'), el('div', { class: 'chips' }, v.categoriasNegocio.map((c) => el('span', { class: 'chip' }, c)))),
      el('div', {}, el('strong', {}, 'Categorías de producto'), el('div', { class: 'chips' }, v.categoriasProducto.map((c) => el('span', { class: 'chip' }, c)))),
    ),
    el('p', { class: 'suave' }, `${v.kpiConfig.length} KPIs · ${v.scriptsVisita.length} guiones de visita · ${v.templatesEmail.length} plantillas de email`),
    el('div', { class: 'acciones' }, boton));
}
