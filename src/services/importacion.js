// Importación masiva de contactos desde CSV en dos pasos:
//   1) previsualizar: lee el archivo, sugiere el mapeo de columnas y muestra las primeras filas;
//   2) importar: aplica el mapeo elegido, crea empresas que falten y resuelve duplicados.
import { leerCSV, sugerirMapeo, CAMPOS_IMPORTABLES, etapaDesdeTexto, escribirCSV } from '../crm/csv.js';
import { normalizar, soloDigitos, puedeAsignar, EMAIL } from '../crm/comun.js';
import * as contactos from './contactos.js';
import * as empresas from './empresas.js';
import { badRequest, prohibido } from '../utils/errores.js';

const MAX_FILAS = 5000;
const MAX_ERRORES = 200;

function leer(csv) {
  if (typeof csv !== 'string' || !csv.trim()) throw badRequest('Falta el contenido del archivo.');
  try { return leerCSV(csv, { maxFilas: MAX_FILAS }); } catch (e) { throw badRequest(e.message); }
}

export function previsualizar(ctx, { csv } = {}) {
  if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor importan contactos.');
  const { columnas, filas, separador } = leer(csv);
  return {
    columnas,
    total: filas.length,
    separador: { ';': 'punto y coma', ',': 'coma', '\t': 'tabulación' }[separador],
    mapeo: sugerirMapeo(columnas),
    muestra: filas.slice(0, 5),
    campos: Object.entries(CAMPOS_IMPORTABLES).map(([codigo, d]) => ({ codigo, etiqueta: d.etiqueta })),
  };
}

function validarMapeo(columnas, mapeo) {
  if (!mapeo || typeof mapeo !== 'object' || Array.isArray(mapeo)) throw badRequest('Falta el mapeo de columnas.');
  const usados = new Set();
  for (const [col, campo] of Object.entries(mapeo)) {
    if (!columnas.includes(col)) throw badRequest(`La columna "${col}" no está en el archivo.`);
    if (campo === '' || campo === null) continue;
    if (!CAMPOS_IMPORTABLES[campo]) throw badRequest(`Campo desconocido: ${campo}.`);
    if (usados.has(campo)) throw badRequest(`El campo "${CAMPOS_IMPORTABLES[campo].etiqueta}" está asignado a dos columnas.`);
    usados.add(campo);
  }
  if (!usados.has('nombre') && !usados.has('empresa')) throw badRequest('Asigná al menos la columna del nombre o la de la empresa.');
  return mapeo;
}

export async function importar(ctx, { csv, mapeo, opciones = {} } = {}) {
  if (!puedeAsignar(ctx.usuario)) throw prohibido('Solo el administrador o el consultor importan contactos.');
  const { columnas, filas } = leer(csv);
  validarMapeo(columnas, mapeo);
  const duplicados = opciones.duplicados ?? 'omitir';
  if (!['omitir', 'actualizar'].includes(duplicados)) throw badRequest('Opción de duplicados inválida.');
  const etiquetaLote = typeof opciones.etiqueta === 'string' ? opciones.etiqueta.trim().slice(0, 40) : '';

  const org = await ctx.organizacion();
  const segmentos = new Map((org.config?.categoriasNegocio || []).map((s) => [normalizar(s), s]));
  const idx = Object.fromEntries(Object.entries(mapeo).filter(([, c]) => c).map(([col, campo]) => [campo, columnas.indexOf(col)]));
  const valor = (fila, campo) => (idx[campo] === undefined ? '' : fila[idx[campo]] ?? '').trim();

  // Precarga de lo existente: así cada fila no consulta la base para detectar duplicados.
  const existentes = await ctx.db.contactos.list({ activo: true }, { limit: 100000 });
  const porEmail = new Map(existentes.filter((c) => c.email).map((c) => [c.email, c]));
  const porTel = new Map(existentes.filter((c) => c.telefonoNormalizado).map((c) => [c.telefonoNormalizado, c]));
  const empresasCache = new Map();
  const claveUbicacion = (c) => [c.nombre, c.apellido, c.direccion, c.localidad].map(normalizar).join('|');
  const porUbicacion = new Map(existentes.filter((c) => !c.email && !c.telefonoNormalizado).map((c) => [claveUbicacion(c), c]));

  const r = { total: filas.length, creados: 0, actualizados: 0, omitidos: 0, empresasCreadas: 0, advertencias: 0, errores: [] };
  const error = (n, motivo) => { if (r.errores.length < MAX_ERRORES) r.errores.push({ fila: n, motivo }); };

  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i];
    const n = i + 2; // número de fila como se ve en Excel (la 1 es el encabezado)
    try {
      const empresaNombre = valor(fila, 'empresa');
      let nombre = valor(fila, 'nombre');
      let apellido = valor(fila, 'apellido');
      if (!nombre && empresaNombre) nombre = empresaNombre; // listados de comercios sin persona de contacto
      if (!nombre) { error(n, 'Sin nombre ni empresa.'); continue; }
      if (!apellido && idx.apellido === undefined && nombre.includes(' ') && !empresaNombre) {
        // "Juan Pérez" en una sola columna: se separa en nombre y apellido.
        const partes = nombre.split(' ');
        apellido = partes.slice(1).join(' ');
        nombre = partes[0];
      }

      // Datos sucios (un email mal escrito, una fecha en la columna del teléfono): no se pierde la fila.
      // El dato se guarda en las notas y se avisa; el contacto se carga igual.
      const notasExtra = [];
      let advertencia = false;
      let email = valor(fila, 'email').toLowerCase();
      if (email && !EMAIL.test(email)) { notasExtra.push(`Email inválido en el archivo: ${email}`); email = ''; advertencia = true; }
      let telefono = valor(fila, 'telefono');
      if (telefono && (soloDigitos(telefono).length < 6 || /^\d{4}-\d{2}-\d{2}/.test(telefono) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(telefono))) { notasExtra.push(`Teléfono inválido en el archivo: ${telefono}`); telefono = ''; advertencia = true; }
      const etiquetas = valor(fila, 'etiquetas').split(/[,|]/).map((e) => e.trim()).filter(Boolean);
      if (etiquetaLote) etiquetas.push(etiquetaLote);

      let segmento = '';
      const segTexto = valor(fila, 'segmento');
      if (segTexto) {
        segmento = segmentos.get(normalizar(segTexto)) || '';
        if (!segmento) { etiquetas.push(segTexto.slice(0, 40)); advertencia = true; } // tipo desconocido: queda como etiqueta
      }

      const datos = {
        nombre, apellido, email, telefono, cargo: valor(fila, 'cargo'),
        direccion: valor(fila, 'direccion'), municipio: valor(fila, 'municipio'), localidad: valor(fila, 'localidad'),
        notas: [valor(fila, 'notas'), ...notasExtra].filter(Boolean).join(' | ').slice(0, 3000), segmento, etiquetas: [...new Set(etiquetas)].slice(0, 20),
      };
      const etapa = etapaDesdeTexto(valor(fila, 'lifecycleStage'));
      if (etapa) datos.lifecycleStage = etapa;
      const lat = valor(fila, 'lat').replace(',', '.'), lng = valor(fila, 'lng').replace(',', '.');
      if (lat && lng) { datos.lat = lat; datos.lng = lng; }

      if (empresaNombre) {
        // Mismo nombre en otra localidad = otro comercio (por ejemplo, sucursales de "Bebidas La Esquina").
        const clave = `${normalizar(empresaNombre)}|${normalizar(datos.localidad)}`;
        let emp = empresasCache.get(clave);
        if (!emp) {
          emp = await empresas.buscarPorNombre(ctx, empresaNombre, datos.localidad);
          if (!emp) {
            const cuit = valor(fila, 'cuit');
            emp = await empresas.crear(ctx, { razonSocial: empresaNombre, cuit: /^\d{2}-?\d{8}-?\d$/.test(cuit) ? cuit : '', municipio: datos.municipio, localidad: datos.localidad, direccion: datos.direccion, segmento });
            r.empresasCreadas += 1;
          }
          empresasCache.set(clave, emp);
        }
        datos.empresaId = String(emp._id);
      }

      const tel = soloDigitos(datos.telefono);
      const claveSinContacto = !email && !tel ? claveUbicacion(datos) : '';
      const dup = (email && porEmail.get(email)) || (tel && porTel.get(tel)) || (claveSinContacto && porUbicacion.get(claveSinContacto));
      if (dup) {
        if (duplicados === 'omitir') { r.omitidos += 1; continue; }
        // Actualizar: solo se completan los campos que vienen con dato; no se pisa con vacíos.
        const patch = Object.fromEntries(Object.entries(datos).filter(([k, v]) => (Array.isArray(v) ? v.length : v !== '' && v !== undefined) && k !== 'etiquetas'));
        if (datos.etiquetas.length) patch.etiquetas = [...new Set([...(dup.etiquetas || []), ...datos.etiquetas])].slice(0, 20);
        const act = await contactos.actualizar(ctx, String(dup._id), patch);
        if (act.email) porEmail.set(act.email, { ...dup, ...act });
        r.actualizados += 1;
        if (advertencia) r.advertencias += 1;
        continue;
      }

      if (opciones.owner) datos.owner = opciones.owner;
      const nuevo = await contactos.crear(ctx, datos, { origen: 'importacion', omitirDuplicados: true });
      if (nuevo.email) porEmail.set(nuevo.email, nuevo);
      if (tel) porTel.set(tel, { ...nuevo, telefonoNormalizado: tel });
      if (claveSinContacto) porUbicacion.set(claveSinContacto, nuevo);
      r.creados += 1;
      if (advertencia) r.advertencias += 1;
    } catch (e) {
      if (e.status === 400 && /vendedor asignado/.test(e.message)) throw e; // error de opciones: corta toda la importación
      error(n, e.message);
    }
  }
  return r;
}

/** Exporta los contactos filtrados a CSV (abre directo en Excel). */
export async function exportar(ctx, q) {
  const lista = await contactos.todosLosFiltrados(ctx, q);
  const vendedores = new Map((await ctx.db.usuarios.list({})).map((u) => [String(u._id), u.nombre]));
  const columnas = ['Nombre', 'Apellido', 'Email', 'Teléfono', 'Cargo', 'Empresa', 'Tipo de cliente', 'Etapa', 'Dirección', 'Municipio', 'Localidad', 'Latitud', 'Longitud', 'Etiquetas', 'Vendedor', 'Última interacción', 'Alta'];
  const filas = lista.map((c) => [c.nombre, c.apellido, c.email, c.telefono, c.cargo, c.empresaNombre, c.segmento, c.lifecycleStage, c.direccion, c.municipio, c.localidad, c.lat ?? '', c.lng ?? '', (c.etiquetas || []).join(', '), vendedores.get(String(c.owner)) || '', c.fechaUltimaInteraccion ? new Date(c.fechaUltimaInteraccion) : '', new Date(c.createdAt)]);
  return { nombreArchivo: `contactos-${new Date().toISOString().slice(0, 10)}.csv`, contenido: escribirCSV(columnas, filas), cantidad: lista.length };
}
