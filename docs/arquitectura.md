# Arquitectura de LeadFlow CRM

El documento completo (visión, módulos, capa de IA, modelo de datos y plan por fases) está en el doc de arquitectura del proyecto. Acá queda lo que hace falta para trabajar sobre el código.

## Decisiones

- Repo y deploy propios, separados del Sistema BRIE. Sin modo LITE.
- Multi-tenant: cada cliente del SaaS es una Organización. Ningún dato de negocio cruza de una a otra.
- Cada organización arranca vacía y genera su propia información. La importación CSV es genérica.
- Aprendizaje en dos capas: un motor estadístico propio (JS) calcula los números; el LLM solo los redacta y recibe datos anónimos.

## Capas

```
server.js            → valida entorno, conecta la base, levanta el servidor
app.js               → Express: seguridad (helmet + CSP), API, estáticos, manejador de errores
src/routes/          → routers (un archivo por dominio a medida que crezca)
src/controllers/     → traducen HTTP ↔ servicio, sin lógica de negocio
src/services/        → reglas de negocio y validación de entrada
src/store/           → acceso a datos: memoria o Mongo, misma API
src/models/          → esquemas Mongoose
src/middleware/      → auth, roles, limitador
public/              → frontend vanilla (sin scripts inline: la CSP lo prohíbe)
```

## Aislamiento entre organizaciones

- El token JWT lleva `id`, `rol` y `org`. En cada request se relee el usuario y su organización: si se desactiva cualquiera de los dos, la sesión se corta.
- `authRequired` deja `req.db = db.org(organizacionId)`. Los controllers de negocio usan SIEMPRE `req.db.<coleccion>`.
- `store/tenant.js` envuelve cada repo: filtra toda lectura por `organizacionId`, lo fija en toda escritura e ignora el que venga en el body. Un `_id` de otra organización se comporta como inexistente (404).
- `db.org('')` falla: olvidarse la organización es un error de programación, nunca una consulta a todo.
- `db.plataforma.*` (organizaciones, usuarios para el login) se usa solo desde auth y desde los servicios del superadmin.

Regla para las fases siguientes: toda colección de negocio nueva se registra en `db.org()` y lleva índice compuesto `{ organizacionId, ... }`.

## Roles

| Rol | Alcance | Puede |
| --- | --- | --- |
| superadmin | Plataforma | Organizaciones, plantillas de vertical, LLM global |
| admin | Su organización | Usuarios, configuración, catálogo, importaciones |
| consultor | Su organización | Todo lo comercial + IA + ajustes del vertical |
| vendedor | Sus contactos | CRM, tareas, rutas, ventas |
| lectura | Su organización | Dashboard e insights, sin editar |

Grupos listos en `src/config/roles.js`: `ROLES_CRM`, `ROLES_IA`, `ROLES_LECTURA`, `ROLES_GESTION`.

## Seguridad

- El servidor no arranca con configuración insegura (JWT débil, memoria en producción, LLM mal configurado).
- CSP activa: solo scripts propios y los CDN que se habiliten en `app.js`.
- Sesión en cookie httpOnly + SameSite=Strict; también acepta `Authorization: Bearer` para integraciones.
- Login con tiempo constante (no revela si el email existe) y limitador de intentos fallidos por IP.
- El email de usuario es único en toda la plataforma.
