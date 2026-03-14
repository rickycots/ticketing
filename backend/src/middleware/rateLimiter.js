const rateLimit = require('express-rate-limit');

// Global API rate limit — 100 requests per minute per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste. Riprova tra un minuto.' },
});

// Login rate limit — 5 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di login. Riprova tra 15 minuti.' },
  skipSuccessfulRequests: true,
});

// AI rate limit — 20 requests per minute per IP
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppe richieste AI. Riprova tra un minuto.' },
});

// Upload rate limit — 10 uploads per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi upload. Riprova tra un minuto.' },
});

// Impersonation rate limit — 5 per hour per IP
const impersonateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi tentativi di impersonation. Riprova tra un\'ora.' },
});

module.exports = { globalLimiter, loginLimiter, aiLimiter, uploadLimiter, impersonateLimiter };
