import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';
import fs from 'fs';
import path from 'path';
import routes from './routes';

import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Load environment variables
dotenv.config();

const isDev = process.env.NODE_ENV !== 'production';

const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// ================================================
// MIDDLEWARE SETUP
// ================================================
helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:", "http://localhost:5000"], // ✅ add this line
      },
    },
  })

app.use(cors({
  origin: "http://localhost:5173",  // or "*" for all origins (not recommended in production)
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Apply limiter only in production
if (process.env.NODE_ENV === 'production') {
  app.use(rateLimiter);
} else {
  logger.info('🧪 Rate limiter disabled in dev');
}

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);
app.use(
  "/uploads",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"], // 👈 match your frontend URL
    methods: ["GET"],
    allowedHeaders: ["Content-Type"],
  }),
  express.static("uploads")
);

// ================================================
// HEALTH CHECK
// ================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.get('/health/db', async (req, res) => {
  try {
    const db = await connectDatabase();
    await db.query('SELECT 1 as health_check');
    res.status(200).json({ status: 'OK', database: 'Connected' });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({ status: 'ERROR', database: 'Disconnected' });
  }
});

// ================================================
// AUTOLOAD ROUTES
// ================================================


app.use(`/api/${API_VERSION}`, routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Barangay Registration System API',
    version: '1.0.0',
    description: 'Online Barangay Registration System - PWA Backend',
    apiVersion: API_VERSION,
    endpoints: { health: '/health', api: `/api/${API_VERSION}` },
    timestamp: new Date().toISOString(),
  });
});

// ================================================
// ERROR HANDLERS
// ================================================
app.use(notFoundHandler);
app.use(errorHandler);

// ================================================
// START SERVER
// ================================================
async function startServer() {
  try {
    await connectDatabase();
    logger.info('Database connection established successfully');

    const server = createServer(app);
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API: http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info(`🏥 Health: http://localhost:${PORT}/health`);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => process.exit(0));
    });
    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}


// Add an index response for `/api/v1`
app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    message: `Welcome to API v${API_VERSION}`,
    availableRoutes: [
      '/auth',
      '/events',
      '/registrations',
      '/users',
      '/otp',
      '/teams',
      '/upload',
      '/customFields',
      '/admin',
      '/qr'
    ]
  });
});

startServer();
