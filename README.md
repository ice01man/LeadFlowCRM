# LeadFlow CRM · Revoluxia

Un producto de Revoluxia · soluciones tecnológicas.

SaaS multi-vertical de gestión comercial (contactos, pipeline, visitas, ventas) que aprende tendencias de los datos que genera cada organización.

Estado: Fase 0 (base del proyecto). Ver `CAMBIOS-Y-GUIA.md` y `docs/arquitectura.md`.

## Probarlo en tu máquina (sin MongoDB)

1. `npm install`
2. `npm run dev`
3. Abrí http://localhost:3000 y entrá con cualquiera de los usuarios demo que muestra la consola (contraseña `demo12345`).

## Tests

`npm test` corre todo en memoria: auth, roles, aislamiento entre organizaciones, store y validación del entorno.

## Stack

Node.js 22 + Express 5 (ESM) + Mongoose 9. Frontend HTML/CSS/JS vanilla, sin build. Tests con `node --test`.

## Documentación

- `docs/arquitectura.md`: decisiones, multi-tenant, roles, capas.
- `docs/deploy.md`: cómo publicarlo en Render con MongoDB Atlas.
- `CAMBIOS-Y-GUIA.md`: qué se hizo en cada fase y cómo está aplicada la marca.
