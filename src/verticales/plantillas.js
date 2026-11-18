// Plantillas iniciales de verticales. Se cargan al arrancar si no existen (no pisan cambios hechos después).
// Cada organización recibe una COPIA de la configuración de su vertical y la ajusta sin tocar la plantilla.
//
// Variables disponibles en los emails: {{contacto}}, {{empresa}}, {{vendedor}}, {{organizacion}}, {{producto}}.

const BANT_BASE = [
  { codigo: 'presupuesto', nombre: 'Presupuesto', descripcion: '¿Tiene capacidad de compra para el volumen que manejamos?', peso: 1 },
  { codigo: 'autoridad', nombre: 'Autoridad', descripcion: '¿Hablamos con quien decide la compra?', peso: 1 },
  { codigo: 'necesidad', nombre: 'Necesidad', descripcion: '¿Tiene una necesidad concreta que resolvemos?', peso: 1 },
  { codigo: 'tiempo', nombre: 'Tiempo', descripcion: '¿Va a comprar en los próximos 60 días?', peso: 1 },
];

const KPIS_BASE = [
  { codigo: 'ticket_promedio', nombre: 'Ticket promedio', descripcion: 'Total vendido dividido por cantidad de ventas del período.' },
  { codigo: 'recurrencia', nombre: 'Recurrencia', descripcion: 'Porcentaje de clientes que compraron en dos o más meses del período.' },
  { codigo: 'conversion', nombre: 'Conversión de oportunidades', descripcion: 'Oportunidades ganadas sobre oportunidades cerradas.' },
  { codigo: 'cross_sell', nombre: 'Ratio de cross-sell', descripcion: 'Promedio de categorías distintas compradas por cliente.' },
  { codigo: 'nps', nombre: 'NPS', descripcion: 'Promotores menos detractores, sobre el total de encuestas.' },
];

export const PLANTILLAS = [
  {
    codigo: 'vinos',
    nombre: 'Vinos y bodegas',
    descripcion: 'Bodegas y distribuidoras que venden a vinotecas, restaurantes y almacenes de bebidas.',
    activo: true,
    categoriasNegocio: ['Vinoteca', 'Restaurante', 'Bar', 'Almacén de bebidas', 'Supermercado', 'Hotel', 'Distribuidor'],
    categoriasProducto: ['Malbec', 'Cabernet Sauvignon', 'Bonarda', 'Blend tinto', 'Torrontés', 'Chardonnay', 'Rosado', 'Espumante'],
    etapasPipeline: [
      { codigo: 'prospecto', nombre: 'Prospecto', probabilidad: 10 },
      { codigo: 'contactado', nombre: 'Contactado', probabilidad: 20 },
      { codigo: 'degustacion', nombre: 'Degustación o visita', probabilidad: 40 },
      { codigo: 'propuesta', nombre: 'Propuesta enviada', probabilidad: 60 },
      { codigo: 'negociacion', nombre: 'Negociación', probabilidad: 80 },
    ],
    criteriosBANT: BANT_BASE.map((c) => ({ ...c, peso: { presupuesto: 3, autoridad: 2, necesidad: 3, tiempo: 2 }[c.codigo] })),
    kpiConfig: [...KPIS_BASE, { codigo: 'mix_varietal', nombre: 'Mix de varietales', descripcion: 'Cantidad de varietales distintos por cliente activo.' }],
    templatesEmail: [
      { codigo: 'bienvenida', asunto: 'Bienvenido a {{organizacion}}', cuerpo: 'Hola {{contacto}}:\n\nGracias por sumarte como cliente. Soy {{vendedor}} y voy a acompañarte con el surtido y las reposiciones de {{empresa}}.\n\nCualquier consulta, respondé este correo.\n\nSaludos,\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor', 'organizacion'] },
      { codigo: 'reactivacion', asunto: '{{contacto}}, tenemos novedades para {{empresa}}', cuerpo: 'Hola {{contacto}}:\n\nHace un tiempo que no hacemos un pedido juntos. Llegaron nuevas cosechas y queremos invitarte a una degustación sin cargo en tu local.\n\n¿Te queda bien que coordinemos una visita esta semana?\n\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor'] },
      { codigo: 'cross_sell', asunto: 'Una recomendación para tu carta', cuerpo: 'Hola {{contacto}}:\n\nLos clientes que trabajan las mismas etiquetas que {{empresa}} están sumando {{producto}} con muy buena rotación.\n\nSi querés, te acerco muestras en la próxima visita.\n\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor', 'producto'] },
    ],
    scriptsVisita: [
      { codigo: 'primera_visita', titulo: 'Primera visita a vinoteca', pasos: ['Presentarse y presentar la bodega en dos minutos.', 'Preguntar qué etiquetas rotan más y cuáles le cuesta vender.', 'Ofrecer degustación de dos o tres vinos alineados a su público.', 'Validar BANT: quién decide, volumen mensual, cuándo repone.', 'Acordar próximo paso con fecha: propuesta o pedido de prueba.'] },
      { codigo: 'reposicion', titulo: 'Visita de reposición', pasos: ['Revisar stock en góndola y depósito.', 'Comentar novedades y promociones vigentes.', 'Proponer un producto nuevo según lo que ya compra.', 'Cerrar el pedido y confirmar fecha de entrega.'] },
    ],
  },
  {
    codigo: 'granja',
    nombre: 'Granja',
    descripcion: 'Productores y distribuidores de pollo, huevos y embutidos que abastecen comercios de cercanía.',
    activo: true,
    categoriasNegocio: ['Granja minorista', 'Carnicería', 'Almacén', 'Supermercado', 'Restaurante', 'Rotisería', 'Distribuidor'],
    categoriasProducto: ['Pollo entero', 'Pollo trozado', 'Pechuga', 'Huevos', 'Embutidos', 'Congelados', 'Elaborados'],
    etapasPipeline: [
      { codigo: 'prospecto', nombre: 'Prospecto', probabilidad: 10 },
      { codigo: 'contactado', nombre: 'Contactado', probabilidad: 25 },
      { codigo: 'muestra', nombre: 'Muestra o pedido de prueba', probabilidad: 50 },
      { codigo: 'condiciones', nombre: 'Acuerdo de condiciones', probabilidad: 75 },
      { codigo: 'alta', nombre: 'Alta como cliente', probabilidad: 90 },
    ],
    criteriosBANT: BANT_BASE.map((c) => ({ ...c, peso: { presupuesto: 2, autoridad: 2, necesidad: 3, tiempo: 3 }[c.codigo] })),
    kpiConfig: [...KPIS_BASE, { codigo: 'frecuencia_reposicion', nombre: 'Frecuencia de reposición', descripcion: 'Días promedio entre pedidos por cliente.' }],
    templatesEmail: [
      { codigo: 'bienvenida', asunto: 'Bienvenido a {{organizacion}}', cuerpo: 'Hola {{contacto}}:\n\nYa quedó dado de alta {{empresa}}. Te paso los días de reparto de tu zona y el listado de productos.\n\nSaludos,\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor', 'organizacion'] },
      { codigo: 'reactivacion', asunto: '{{contacto}}, ¿seguimos abasteciendo a {{empresa}}?', cuerpo: 'Hola {{contacto}}:\n\nNotamos que hace unas semanas no recibimos pedidos tuyos. Si algo no funcionó con la entrega o el precio, queremos saberlo.\n\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor'] },
      { codigo: 'cross_sell', asunto: 'Sumá {{producto}} a tu próximo pedido', cuerpo: 'Hola {{contacto}}:\n\nComercios como {{empresa}} están sumando {{producto}} y les rota bien. ¿Te agrego una caja de prueba al próximo pedido?\n\n{{vendedor}}', variables: ['contacto', 'empresa', 'vendedor', 'producto'] },
    ],
    scriptsVisita: [
      { codigo: 'primera_visita', titulo: 'Primera visita a comercio', pasos: ['Presentarse y contar zona y días de reparto.', 'Preguntar volumen semanal y proveedor actual.', 'Mostrar calidad del producto y cadena de frío.', 'Validar BANT: quién compra, cuánto, desde cuándo podría cambiar.', 'Dejar lista de precios y acordar pedido de prueba.'] },
    ],
  },
  {
    codigo: 'seguros',
    nombre: 'Seguros',
    descripcion: 'Productores y brokers de seguros: automotores, hogar, vida y comercio.',
    activo: true,
    categoriasNegocio: ['Particular', 'Profesional independiente', 'Comercio', 'Pyme', 'Flota', 'Consorcio'],
    categoriasProducto: ['Automotor', 'Moto', 'Hogar', 'Vida', 'Accidentes personales', 'Integral de comercio', 'ART'],
    etapasPipeline: [
      { codigo: 'prospecto', nombre: 'Prospecto', probabilidad: 10 },
      { codigo: 'relevamiento', nombre: 'Relevamiento de riesgo', probabilidad: 30 },
      { codigo: 'cotizacion', nombre: 'Cotización enviada', probabilidad: 50 },
      { codigo: 'negociacion', nombre: 'Negociación', probabilidad: 70 },
      { codigo: 'emision', nombre: 'Emisión de póliza', probabilidad: 90 },
    ],
    criteriosBANT: BANT_BASE.map((c) => ({ ...c, peso: { presupuesto: 2, autoridad: 3, necesidad: 3, tiempo: 2 }[c.codigo] })),
    kpiConfig: [...KPIS_BASE, { codigo: 'renovacion', nombre: 'Tasa de renovación', descripcion: 'Pólizas renovadas sobre pólizas que vencieron en el período.' }],
    templatesEmail: [
      { codigo: 'bienvenida', asunto: 'Tu póliza con {{organizacion}}', cuerpo: 'Hola {{contacto}}:\n\nGracias por confiar en nosotros. Soy {{vendedor}}, tu productor asesor. Ante cualquier siniestro o consulta, escribime directamente.\n\nSaludos,\n{{vendedor}}', variables: ['contacto', 'vendedor', 'organizacion'] },
      { codigo: 'renovacion', asunto: '{{contacto}}, se acerca el vencimiento de tu póliza', cuerpo: 'Hola {{contacto}}:\n\nTu póliza vence en los próximos días. Revisé las condiciones y quiero mostrarte opciones antes de renovar.\n\n¿Coordinamos una llamada?\n\n{{vendedor}}', variables: ['contacto', 'vendedor'] },
      { codigo: 'cross_sell', asunto: 'Una cobertura que te puede interesar', cuerpo: 'Hola {{contacto}}:\n\nVarios clientes con un perfil como el tuyo sumaron {{producto}} con un costo mensual bajo. Si querés, te preparo una cotización sin compromiso.\n\n{{vendedor}}', variables: ['contacto', 'vendedor', 'producto'] },
    ],
    scriptsVisita: [
      { codigo: 'relevamiento', titulo: 'Reunión de relevamiento', pasos: ['Entender qué tiene asegurado hoy y con quién.', 'Relevar bienes, actividad y personas a cargo.', 'Detectar coberturas faltantes o duplicadas.', 'Validar BANT: quién firma, presupuesto mensual, fecha de vencimiento actual.', 'Acordar envío de cotización con fecha.'] },
    ],
  },
];
