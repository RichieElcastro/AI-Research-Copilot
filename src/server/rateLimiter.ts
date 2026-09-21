import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * In-memory sliding window rate limiter for abuse protection
 * Protects public survey endpoints and authentication routes from automated exhaustion.
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message: string;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Periodically clean up expired entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(ip);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Determine client IP
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown-client';

    const now = Date.now();
    const record = store.get(clientIp);

    if (!record || now > record.resetTime) {
      store.set(clientIp, { count: 1, resetTime: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      return next();
    }

    if (record.count >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetTime - now) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', options.maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        success: false,
        error: options.message,
        retryAfter: retryAfterSeconds,
      });
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', options.maxRequests - record.count);
    next();
  };
}

// Preset Limiters
export const publicSurveyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 120,    // 120 requests per minute per IP
  message: 'Too many survey requests from this IP. Please wait a moment.',
});

export const publicSubmissionRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20,     // 20 submissions per minute per IP
  message: 'Submission rate limit reached. Please wait before submitting again.',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30,     // 30 authentication/switch attempts per minute per IP
  message: 'Too many authentication attempts. Please wait a minute before retrying.',
});
