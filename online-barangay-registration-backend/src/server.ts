import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createServer } from 'http';

import { logger } from './utils/logger';
import { connectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/users';  
import eventRoutes from './routes/events';
import registrationRoutes from './routes/registrations';
import adminRoutes from './routes/admin';
import qrRoutes from './routes/qr';
import uploadRoutes from './routes/upload';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// ================================================
// MIDDLEWARE SETUP
// ================================================

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil(parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000),
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// ================================================
// HEALTH CHECK ENDPOINTS
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
    const result = await db.query('SELECT 1 as health_check');
    res.status(200).json({
      status: 'OK',
      database: 'Connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Database health check failed:', error);
    res.status(503).json({
      status: 'ERROR',
      database: 'Disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// ================================================
// API ROUTES
// ================================================

const apiRouter = express.Router();

// Mount route modules
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);
apiRouter.use('/events', eventRoutes);
apiRouter.use('/registrations', registrationRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/qr', qrRoutes);
apiRouter.use('/upload', uploadRoutes);

// Mount API router with version prefix
app.use(`/api/${API_VERSION}`, apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Barangay Registration System API',
    version: '1.0.0',
    description: 'Online Barangay Registration System - PWA Backend',
    apiVersion: API_VERSION,
    endpoints: {
      health: '/health',
      api: `/api/${API_VERSION}`,
      docs: `/api/${API_VERSION}/docs`
    },
    timestamp: new Date().toISOString(),
  });
});

// ================================================
// ERROR HANDLING MIDDLEWARE
// ================================================

app.use(notFoundHandler);
app.use(errorHandler);

// ================================================
// SERVER STARTUP
// ================================================

async function startServer() {
  try {
    // Test database connection
    await connectDatabase();
    logger.info('Database connection established successfully');

    // Create HTTP server
    const server = createServer(app);

    // Start listening
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API Documentation: http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info(`🏥 Health Check: http://localhost:${PORT}/health`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
