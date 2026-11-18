// Configuración de entorno validada al arrancar. Si algo es inseguro o inválido,
// el servidor NO arranca: es preferible fallar al inicio que correr mal configurado.
import 'dotenv/config';
import crypto from 'node:crypto';

const env = process.env;

export const MODO = (env.PERSISTENCIA || 'mongo').toLowerCase();
export const PRODUCCION = env.NODE_ENV === 'production';

if (!['mongo', 'memoria'].includes(MODO)) {
  throw new Error(`PERSISTENCIA="${env.PERSISTENCIA}" inválida. Usá "mongo" o "memoria".`);
}
if (MODO === 'memoria' && PRODUCCION) {
  throw new Error('PERSISTENCIA=memoria no está permitida con NODE_ENV=production.');
}

// ---- JWT ----
let secreto = env.JWT_SECRET;
if (!secreto || secreto.length < 32) {
  if (MODO === 'mongo') {
    throw new Error(
      'Falta JWT_SECRET o es débil (mínimo 32 caracteres). Generá uno con:\n' +
      '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  secreto = crypto.randomBytes(32).toString('hex'); // solo modo memoria: las sesiones mueren al reiniciar
  console.warn('Aviso: JWT_SECRET no definido, se usa un secreto aleatorio (modo memoria).');
}
export const JWT_SECRET = secreto;
export const JWT_EXPIRA = env.JWT_EXPIRA || '8h';

// ---- Servidor y base ----
export const MONGODB_URI = env.MONGODB_URI || '';
export const MONGODB_DB = env.MONGODB_DB || 'leadflow';
export const PORT = Number(env.PORT) || 3000;
export const CORS_ORIGIN = (env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);

if (MODO === 'mongo' && !MONGODB_URI) {
  throw new Error('Falta MONGODB_URI (PERSISTENCIA=mongo).');
}

// ---- IA / LLM (opcional: sin clave, la capa LLM queda apagada y el motor estadístico sigue funcionando) ----
const PROVEEDORES_LLM = ['anthropic', 'openai', 'gemini', 'zai', 'ollama'];
const proveedor = (env.LLM_PROVIDER || '').toLowerCase();
if (proveedor && !PROVEEDORES_LLM.includes(proveedor)) {
  throw new Error(`LLM_PROVIDER="${env.LLM_PROVIDER}" inválido. Opciones: ${PROVEEDORES_LLM.join(', ')}.`);
}
const numeroEnRango = (valor, defecto, min, max, nombre) => {
  if (valor === undefined || valor === '') return defecto;
  const n = Number(valor);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(`${nombre} debe ser un número entre ${min} y ${max}.`);
  return n;
};

export const LLM = Object.freeze({
  proveedor,
  apiKey: env.LLM_API_KEY || '',
  modelo: env.LLM_MODEL || '',
  baseUrl: env.LLM_BASE_URL || '',
  maxTokens: numeroEnRango(env.LLM_MAX_TOKENS, 2000, 100, 32000, 'LLM_MAX_TOKENS'),
  temperatura: numeroEnRango(env.LLM_TEMPERATURE, 0.3, 0, 1, 'LLM_TEMPERATURE'),
  cacheHoras: numeroEnRango(env.LLM_CACHE_TTL_HOURS, 24, 0, 720, 'LLM_CACHE_TTL_HOURS'),
  // Activo solo si hay proveedor y (clave o Ollama local, que no la necesita).
  activo: Boolean(proveedor && (env.LLM_API_KEY || proveedor === 'ollama')),
});
