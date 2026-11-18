// Construye la aplicación Express (sin escuchar puerto). server.js la levanta; los tests la usan directo.
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { CORS_ORIGIN } from './src/config/env.js';
import { api } from './src/routes/index.js';
import { ErrorHttp } from './src/utils/errores.js';

const RAIZ = dirname(fileURLToPath(import.meta.url));

export function crearApp() {
  const app = express();
  app.set('trust proxy', 1); // detrás de Render, req.ip es la IP real (lo usa el limitador)
  app.disable('x-powered-by');

  // CSP activa desde el día uno: sin scripts ni estilos inline. Los CDN permitidos se suman acá
  // cuando una fase los necesite (Chart.js y Leaflet en jsdelivr / unpkg, teselas de OpenStreetMap).
  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'script-src': ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
        'style-src': ["'self'", 'https://unpkg.com', 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
        'connect-src': ["'self'"],
      },
    },
  }));
  app.use(cors({ origin: CORS_ORIGIN.length ? CORS_ORIGIN : false }));
  // JSON chico para todo, salvo la importación de CSV (que viaja como texto dentro del JSON).
  const jsonChico = express.json({ limit: '200kb' });
  const jsonImportacion = express.json({ limit: '6mb' });
  app.use((req, res, next) => (req.path.startsWith('/api/crm/importar') ? jsonImportacion : jsonChico)(req, res, next));

  app.use('/api', api);
  app.use(express.static(join(RAIZ, 'public'), { extensions: ['html'] }));

  // Errores: los esperados salen con su código; los demás se loguean y no filtran detalles.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof ErrorHttp) return res.status(err.status).json({ error: err.message });
    if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido.' });
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'El pedido es demasiado grande.' });
    if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: 'Datos inválidos.' });
    if (err?.code === 11000) return res.status(409).json({ error: 'Ya existe un registro con ese valor.' });
    console.error('Error no controlado:', err);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}
