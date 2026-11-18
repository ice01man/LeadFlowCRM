# Deploy en Render

## 1. Base de datos (MongoDB Atlas)

1. Creá un cluster y un usuario de base solo para LeadFlow.
2. En Network Access permití las IP de salida de Render (o 0.0.0.0/0 mientras probás).
3. Copiá la cadena de conexión `mongodb+srv://...`.

## 2. Web Service en Render

1. New → Web Service → conectá el repo `ice01man/LeadFlowCRM`, rama `main`.
2. Runtime: Node. Build command: `npm ci`. Start command: `npm start`.
3. Health check path: `/api/salud`.
4. Variables de entorno (Environment): las de `.env.example`. Como mínimo `NODE_ENV=production`, `PERSISTENCIA=mongo`, `MONGODB_URI`, `MONGODB_DB`, `JWT_SECRET`.
5. Plan: el free se duerme a los 15 minutos sin tráfico. Para producción y para los jobs nocturnos de las fases 4 y 5 hace falta Starter.

## 3. Primer superadmin

Desde la Shell del servicio en Render (o local apuntando a Atlas):

```
SUPERADMIN_PASSWORD='una-clave-larga' npm run superadmin -- tu-email@dominio.com "Paulo Reta"
```

Después entrá con ese usuario y creá la primera organización con `POST /api/organizaciones` (la pantalla llega en la Fase 1).
