import rateLimit from 'express-rate-limit';

export const submissionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      message: 'Too many submissions. Try again later.'
    }
  }
});
