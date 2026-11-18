# LeadFlow CRM · Cambios y guía

LeadFlow CRM es un producto de Revoluxia · soluciones tecnológicas.

## Marca Revoluxia

- Toda la identidad está en dos archivos: `src/config/marca.js` (servidor y API) y `public/css/marca.css` (colores del frontend). Cambiando esos dos, cambia todo el sistema.
- Colores tomados del logo: azul petróleo `#1f4e6e` (primario), `#163a53` (hover), `#6fa3c7` (acento en modo oscuro), negro `#0b0f14` (texto).
- Logos en `public/img/`: completo e isotipo, cada uno en versión azul (modo claro) y clara (modo oscuro), con fondo transparente. Favicon de 32 px, íconos de app de 180 y 512 px y `manifest.webmanifest` (instalable en el celular).
- `GET /api/marca` devuelve nombre, eslogan, colores y logos; `GET /api/salud` informa "LeadFlow CRM · Revoluxia".
- Los tokens de sesión salen firmados con el emisor `revoluxia-leadflow`.
- El logo original quedó en `docs/marca/revoluxia-original.png`. Es de 196 px: para pantallas grandes e impresos conviene reemplazar los PNG por una versión en alta resolución o SVG.

## Fase 1 — Verticales (rubros)

Qué quedó:

- Tres plantillas de rubro: vinos, granja y seguros (`src/verticales/plantillas.js`). Cada una trae etapas del pipeline con probabilidad, criterios BANT con pesos, KPIs, tipos de cliente, categorías de producto, guiones de visita y plantillas de email.
- Las plantillas se cargan solas al arrancar si no existen. Si después se modifican, el arranque no las pisa.
- Cada organización se da de alta con un rubro obligatorio y recibe una COPIA de su configuración. Cambiar la plantilla no afecta a las organizaciones existentes.
- Admin y consultor ajustan la configuración de su organización. Vendedor y lectura la consultan. El admin puede restaurarla desde la plantilla.
- Toda la configuración se valida en el servidor (`src/verticales/validacion.js`): probabilidades que no bajan entre etapas, los cuatro criterios BANT con al menos un peso mayor que cero, variables de email permitidas, códigos sin repetir, campos desconocidos rechazados.
- Función de score BANT ponderado lista para la Fase 3.
- Pantallas nuevas: `/plataforma` (superadmin: alta y suspensión de organizaciones, plantillas) y `/configuracion` (configuración comercial de la organización). El inicio muestra accesos según el rol.
- Node fijado en 22.x en `package.json` (Render había tomado Node 26).
- 47 tests.

Cómo probarlo en Render después del deploy:

1. Entrá como superadmin y andá a Plataforma.
2. Creá una organización eligiendo el rubro, con su administrador.
3. Salí y entrá con ese administrador: en Configuración comercial vas a ver la copia del rubro y la podés ajustar.

Pendiente: la edición de guiones de visita y plantillas de email desde la pantalla llega con el módulo de actividades (Fase 2). Por API ya se pueden cambiar.

## Fase 0 — Base del proyecto

Qué quedó:

- Esqueleto Express 5 + store doble (memoria / Mongo) con la misma API que SistemaBase.
- Multi-tenant desde el día uno: `store/tenant.js` ata cada repo a una organización.
- Modelos `Organizacion` y `Usuario`. Roles: superadmin, admin, consultor, vendedor, lectura.
- Auth con JWT en cookie httpOnly (o Bearer), relectura del usuario y de la organización en cada request.
- Endpoints: salud, login/logout/me, usuarios (admin de su organización), organizaciones (superadmin).
- Variables `LLM_*` validadas en `env.js` (la capa LLM llega en la Fase 5).
- CSP activa, limitador de login, manejador de errores sin filtrar detalles.
- Frontend mínimo: login e inicio.
- Sin usuarios ni contraseñas fijas en el código. En desarrollo (memoria) se crea un superadmin local con contraseña aleatoria que se muestra en la consola; en producción el superadmin se crea con `npm run superadmin`.
- 34 tests en memoria (aislamiento, roles, auth, store, entorno, marca). Arman sus datos por la API con contraseñas aleatorias en cada corrida.

Diferencias con el prompt original y por qué:

- No hay modo LITE ni versión pública reducida (decisión del 18/11/2026).
- No hay `scripts/migrar-datos-paulo.js`: cada organización arranca vacía; la importación CSV será genérica (Fase 2).
- Se agrega la Organización (tenant) y el rol `lectura`; el rol `consultor` administra el vertical de SU organización, no la plantilla global.
- Se agrega un módulo de Ventas en la Fase 2: sin ventas registradas no hay tendencias para aprender.
- La IA se divide en motor estadístico propio (Fase 4) y LLM narrador (Fase 5).
- `app.js` exporta `crearApp()` y `server.js` levanta el puerto, para que los tests corran en el mismo proceso.

Pendiente de esta fase:

- Probar contra un MongoDB real (Atlas) antes de pasar a la Fase 1. Los modelos validan bien, pero la corrida completa todavía no se hizo.

## API

| Método | Ruta | Quién |
| --- | --- | --- |
| GET | /api/salud | Público |
| GET | /api/marca | Público |
| POST | /api/auth/login | Público (con limitador) |
| POST | /api/auth/logout | Público |
| GET | /api/auth/me | Cualquier usuario logueado |
| GET, POST | /api/usuarios | admin |
| GET, PATCH | /api/usuarios/:id | admin |
| GET, POST | /api/organizaciones | superadmin |
| GET, PATCH | /api/organizaciones/:id | superadmin |
| GET | /api/verticales | Cualquier usuario (superadmin ve también los inactivos) |
| GET | /api/verticales/:codigo | Cualquier usuario |
| POST | /api/verticales | superadmin (se puede basar en otro con `basadoEn`) |
| PATCH | /api/verticales/:codigo | superadmin |
| GET | /api/organizacion/config | Usuarios de una organización |
| PATCH | /api/organizacion/config | admin, consultor |
| POST | /api/organizacion/config/restaurar | admin |
