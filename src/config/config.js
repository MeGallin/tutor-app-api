import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
};

export default config;
