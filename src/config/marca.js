// Identidad de marca en un solo lugar. LeadFlow CRM es un producto de Revoluxia.
// Los colores salen del logo y se repiten en public/css/marca.css (el frontend no tiene build).
export const MARCA = Object.freeze({
  empresa: 'Revoluxia',
  eslogan: 'soluciones tecnológicas',
  producto: 'LeadFlow CRM',
  firma: 'LeadFlow CRM · Revoluxia',
  sitio: 'https://www.facebook.com/profile.php?id=100095303406062',
  colores: Object.freeze({
    primario: '#1f4e6e',  // azul petróleo del isotipo
    primarioOscuro: '#163a53',
    primarioClaro: '#6fa3c7', // acento legible sobre fondo oscuro
    texto: '#0b0f14',     // negro del eslogan
  }),
  logos: Object.freeze({
    completo: '/img/revoluxia-logo.png',
    completoClaro: '/img/revoluxia-logo-claro.png',
    isotipo: '/img/revoluxia-isotipo.png',
    isotipoClaro: '/img/revoluxia-isotipo-claro.png',
  }),
});
