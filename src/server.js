import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import local modules
import config from './config/config.js';
import db from './models/index.js';
import logger from './utils/logger.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import tutorRoutes from './routes/tutor.routes.js';

/**
 * Express server setup with API routes, middleware, and documentation
 * @module Server
 */

// ES module dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  logger.info('Logs directory created successfully');
}

// Initialize express application
const app = express();
const PORT = config.port || 8000;

// Request logger middleware (first to capture all requests)
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

/**
 * Health check endpoints - defined early to ensure availability
 * These endpoints are used to verify the API is running
 */
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.env,
  });
});

// Security and parsing middleware
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = Array.isArray(config.corsOrigin)
        ? config.corsOrigin
        : [config.corsOrigin];

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`Origin ${origin} not allowed by CORS policy`);
        callback(null, false);
      }
    },
    credentials: true,
    optionsSuccessStatus: 200,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/tutor', tutorRoutes);

// Swagger documentation setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Tutor API Documentation',
      version: '1.0.0',
      description: 'API documentation for the Tutor application',
    },
    servers: [
      { url: `http://localhost:${PORT}`, description: 'Development server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Rate limiting for API routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// Error handling middleware (must be last)
app.use(notFound);
app.use(errorHandler);

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`✅ Express API server running on port ${PORT}`);
  logger.info(
    `✅ API Documentation available at http://localhost:${PORT}/api-docs`,
  );
});

// Initialize database connection
(async () => {
  try {
    await db.sequelize.sync({ force: false });
    logger.info('✅ Database synchronized successfully');
  } catch (error) {
    logger.error(`Database initialization error: ${error.message}`);
    // Continue running server even if database fails
  }
})();

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Promise Rejection at: ${promise}, reason: ${reason}`);
  // Do not exit the process here, just log the error
});

export default app;
