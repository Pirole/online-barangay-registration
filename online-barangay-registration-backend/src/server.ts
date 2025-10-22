/**
 * ======================================================
 * server.ts — Entry point for the Barangay Registration API
 * ======================================================
 */
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { createServer } from "http";
import path from "path";
import routes from "./routes";
import registrationRoutes from "./routes/registrations";
import { logger } from "./utils/logger";
import { connectDatabase } from "./config/database";
import eventRoutes from "./routes/events";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { requestLogger } from "./middleware/requestLogger";
import eventManagerRoutes from "./routes/eventManagerRoutes";

// ================================================
// LOAD ENVIRONMENT VARIABLES
// ================================================
dotenv.config();
const isDev = process.env.NODE_ENV !== "production";
const app = express();
const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || "v1";

// ================================================
// SECURITY & MIDDLEWARE
// ================================================
app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false, // ✅ Add this line
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "http://localhost:5000", "blob:"],
        connectSrc: ["'self'", "http://localhost:5000", "http://localhost:5173"],
      },
    },
  })
);



app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

if (!isDev) {
  const rateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: "Too many requests from this IP, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(rateLimiter);
} else {
  logger.info("🧪 Rate limiter disabled in development mode");
}
app.use(`/api/${API_VERSION}/events`, eventRoutes);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);


// ================================================
// STATIC FILES — Serve uploads for Photos & QR Codes
// ================================================

/**
 * ✅ Serve registrant photos (stored in src/uploads/photos)
 * Example URL: http://localhost:5000/uploads/photos/photo-123.jpg
 */
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use(
  "/uploads/photos",
  express.static(path.join(__dirname, "uploads", "photos"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

/**
 * ✅ Serve QR codes (stored in uploads/qr outside src)
 * Example URL: http://localhost:5000/uploads/qr/qr-123.png
 */
app.use(
  "/uploads/qr",
  express.static(path.join(__dirname, "..", "uploads", "qr"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);
app.use(
  "/uploads/events",
  express.static(path.join(__dirname, "..", "uploads", "events"), {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);
// ================================================
// HEALTH CHECK ROUTES
// ================================================
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/health/db", async (req, res) => {
  try {
    const db = await connectDatabase();
    await db.query("SELECT 1 as health_check");
    res.status(200).json({ status: "OK", database: "Connected" });
  } catch (error) {
    logger.error("Database health check failed:", error);
    res.status(503).json({ status: "ERROR", database: "Disconnected" });
  }
});
app.use("/api/v1/event-managers", eventManagerRoutes);
// ================================================
// MAIN API ROUTES
// ================================================
app.use(`/api/${API_VERSION}`, routes);
app.use(`/api/${API_VERSION}/registrations`, registrationRoutes);

// API Index route
app.get(`/api/${API_VERSION}`, (req, res) => {
  res.json({
    message: `Welcome to Barangay Registration System API v${API_VERSION}`,
    endpoints: [
      "/auth",
      "/events",
      "/registrations",
      "/users",
      "/otp",
      "/teams",
      "/upload",
      "/customFields",
      "/admin",
      "/qr",
    ],
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Barangay Registration System API",
    version: "1.0.0",
    apiVersion: API_VERSION,
    description: "Online Barangay Registration System - PWA Backend",
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
    logger.info("✅ Database connection established successfully");

    const server = createServer(app);
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📚 API: http://localhost:${PORT}/api/${API_VERSION}`);
      logger.info(`🏥 Health: http://localhost:${PORT}/health`);
    });

    process.on("SIGTERM", () => {
      logger.info("SIGTERM received, shutting down gracefully...");
      server.close(() => process.exit(0));
    });

    process.on("SIGINT", () => {
      logger.info("SIGINT received, shutting down gracefully...");
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
