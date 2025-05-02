import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse comma-separated CORS origins into an array
const parseCorsOrigins = (origins) => {
  if (!origins) return 'http://localhost:8000';
  return origins.includes(',')
    ? origins.split(',').map((o) => o.trim())
    : origins;
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 8000,
  jwtSecret: process.env.JWT_SECRET || 'YOUR_SECRET_KEY',
  jwtExpirationInMinutes: process.env.JWT_EXPIRATION_MINUTES || 60,
  dbPath:
    process.env.DB_PATH || path.join(__dirname, '../../data/tutor.sqlite'),
  openAI: {
    apiKey: process.env.OPENAI_API_KEY,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o-mini',
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  corsOrigin: parseCorsOrigins(process.env.CORS_ORIGIN) || [
    'http://localhost:8000',
    'http://localhost:5173',
  ],
};

export default config;
