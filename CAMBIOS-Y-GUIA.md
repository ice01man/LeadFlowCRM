# LeadFlow CRM · Cambios y guía

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
- 30 tests en memoria (aislamiento, roles, auth, store, entorno).

Diferencias con el prompt original y por qué:

- No hay modo LITE ni versión pública reducida (decisión del 18/11/2026).
- No hay `scripts/migrar-datos-paulo.js`: cada organización arranca vacía; la importación CSV será genérica (Fase 2).
- Se agrega la Organización (tenant) y el rol `lectura`; el rol `consultor` administra el vertical de SU organización, no la plantilla global.
- Se agrega un módulo de Ventas en la Fase 2: sin ventas registradas no hay tendencias para aprender.
- La IA se divide en motor estadístico propio (Fase 4) y LLM narrador (Fase 5).
- `app.js` exporta `crearApp()` y `server.js` levanta el puerto, para que los tests corran en el mismo proceso.

Pendiente de esta fase:

- Probar contra un MongoDB real (Atlas) antes de pasar a la Fase 1. Los modelos validan bien, pero la corrida completa todavía no se hizo.

## API (Fase 0)

| Método | Ruta | Quién |
| --- | --- | --- |
| GET | /api/salud | Público |
| POST | /api/auth/login | Público (con limitador) |
| POST | /api/auth/logout | Público |
| GET | /api/auth/me | Cualquier usuario logueado |
| GET, POST | /api/usuarios | admin |
| GET, PATCH | /api/usuarios/:id | admin |
| GET, POST | /api/organizaciones | superadmin |
| GET, PATCH | /api/organizaciones/:id | superadmin |
