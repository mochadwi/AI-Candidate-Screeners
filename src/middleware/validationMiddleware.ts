import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

// Generic validation middleware
export const validateRequest = (schema: {
  body?: any;
  query?: any;
  params?: any;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      if (schema.body) {
        const bodyValidation = schema.body.safeParse(req.body);
        if (!bodyValidation.success) {
          const errors = bodyValidation.error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }));
          throw new AppError(`Validation failed: ${errors.map((e: any) => e.message).join(', ')}`, 400);
        }
        req.body = bodyValidation.data;
      }

      // Validate query parameters
      if (schema.query) {
        const queryValidation = schema.query.safeParse(req.query);
        if (!queryValidation.success) {
          const errors = queryValidation.error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }));
          throw new AppError(`Query validation failed: ${errors.map((e: any) => e.message).join(', ')}`, 400);
        }
        req.query = queryValidation.data;
      }

      // Validate path parameters
      if (schema.params) {
        const paramsValidation = schema.params.safeParse(req.params);
        if (!paramsValidation.success) {
          const errors = paramsValidation.error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message
          }));
          throw new AppError(`Parameter validation failed: ${errors.map((e: any) => e.message).join(', ')}`, 400);
        }
        req.params = paramsValidation.data;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

// UUID validation middleware
export const validateUUID = (paramName: string = 'id') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const value = req.params[paramName];

    if (!value) {
      throw new AppError(`${paramName} is required`, 400);
    }

    if (!uuidRegex.test(value)) {
      throw new AppError(`Invalid ${paramName} format`, 400);
    }

    next();
  };
};

// Rate limiting middleware (simple in-memory implementation)
export const rateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
}) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [ip, data] of requests.entries()) {
      if (now > data.resetTime) {
        requests.delete(ip);
      }
    }

    // Check current request count
    const requestData = requests.get(key);

    if (!requestData) {
      // First request from this IP
      requests.set(key, {
        count: 1,
        resetTime: now + options.windowMs
      });
      return next();
    }

    if (now > requestData.resetTime) {
      // Window has reset
      requestData.count = 1;
      requestData.resetTime = now + options.windowMs;
      return next();
    }

    if (requestData.count >= options.max) {
      // Rate limit exceeded
      return res.status(429).json({
        error: {
          message: options.message || 'Too many requests, please try again later',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
        },
        timestamp: new Date().toISOString()
      });
    }

    // Increment request count
    requestData.count++;
    next();
  };
};

// Request logging middleware
export const requestLogger = (options: {
  logBody?: boolean;
  logHeaders?: boolean;
  excludePaths?: string[];
} = {}) => {
  const { logBody = false, logHeaders = false, excludePaths = ['/health'] } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Skip logging for excluded paths
    if (excludePaths.some(path => req.path === path)) {
      return next();
    }

    // Log request
    const logData: any = {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    if (logBody && req.body) {
      logData.body = req.body;
    }

    if (logHeaders) {
      logData.headers = req.headers;
    }

    console.log(`📥 Request: ${JSON.stringify(logData)}`);

    // Log response
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseLog = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      };

      console.log(`📤 Response: ${JSON.stringify(responseLog)}`);
    });

    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Remove Express signature
  res.removeHeader('X-Powered-By');

  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API specific headers
  res.setHeader('X-API-Version', '1.0.0');
  res.setHeader('X-Response-Time', Date.now().toString());

  next();
};