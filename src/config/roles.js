// Roles de LeadFlow CRM. El alcance de cada uno está descripto en docs/arquitectura.md.
export const ROL = Object.freeze({
  SUPERADMIN: 'superadmin', // plataforma: organizaciones, plantillas de vertical, LLM global
  ADMIN: 'admin',           // su organización: usuarios, configuración, catálogo, importaciones
  CONSULTOR: 'consultor',   // su organización: todo lo comercial + IA + ajustes del vertical
  VENDEDOR: 'vendedor',     // sus contactos: CRM, tareas, rutas, ventas
  LECTURA: 'lectura',       // su organización: solo dashboard e insights
});

export const ROLES = Object.values(ROL);
export const ROLES_ORGANIZACION = ROLES.filter((r) => r !== ROL.SUPERADMIN);

// Grupos reutilizables para las rutas de las fases siguientes.
export const ROLES_GESTION = [ROL.ADMIN];
export const ROLES_CRM = [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR];
export const ROLES_IA = [ROL.ADMIN, ROL.CONSULTOR];
export const ROLES_LECTURA = [ROL.ADMIN, ROL.CONSULTOR, ROL.VENDEDOR, ROL.LECTURA];
