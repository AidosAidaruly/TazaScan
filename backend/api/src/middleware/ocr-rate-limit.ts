import rateLimit from 'express-rate-limit';

export const ocrRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many photo searches. Try again later.'
    }
  }
});
