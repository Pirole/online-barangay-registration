import rateLimit from 'express-rate-limit';

// ✅ General API limiter (safe for production)
export const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 min
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ OTP or login limiter (stricter)
export const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    error: 'Too many authentication attempts. Try again in 1 minute.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ✅ Development-safe limiter (for localhost)
export const devLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000, // effectively no limit in dev
  message: { error: 'Too many requests (dev mode)' },
  standardHeaders: true,
  legacyHeaders: false,
});
