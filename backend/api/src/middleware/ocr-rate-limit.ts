import rateLimit from 'express-rate-limit';

const ocrWindowMs = 15 * 60 * 1000;

/**
 * Per-endpoint OCR limits keyed on request.ip (proxy-aware via configureTrustProxy). Each
 * endpoint has its own counter, so using up photo search never blocks product-submission
 * scans and vice versa. Overall OCR load is bounded separately by the shared OCR worker pool
 * (concurrency, queue and timeout: 503/504), not by a shared rate budget.
 */
function createOcrRateLimit(limit: number, message: string) {
  return rateLimit({
    windowMs: ocrWindowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message } }
  });
}

export const photoSearchRateLimit = createOcrRateLimit(
  20,
  'Too many photo searches. Try again later.'
);

// The two submission scans together keep the previous per-IP budget of 20 per window.
export const nutritionOcrRateLimit = createOcrRateLimit(
  10,
  'Too many nutrition label scans. Try again later.'
);

export const ingredientsOcrRateLimit = createOcrRateLimit(
  10,
  'Too many ingredient list scans. Try again later.'
);
