import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode?: number;
  public isOperational?: boolean;
  public code?: string;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Error logging utility
export const logError = (err: Error, req: Request): void => {
  const errorInfo = {
    message: err.message,
    statusCode: (err as AppError).statusCode || 500,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    stack: err.stack
  };

  console.error('🚨 Error:', JSON.stringify(errorInfo, null, 2));
};

// Get error type for better handling
export const getErrorType = (err: AppError): string => {
  if (err.statusCode === 400) return 'VALIDATION_ERROR';
  if (err.statusCode === 401) return 'AUTHENTICATION_ERROR';
  if (err.statusCode === 403) return 'AUTHORIZATION_ERROR';
  if (err.statusCode === 404) return 'NOT_FOUND_ERROR';
  if (err.statusCode === 409) return 'CONFLICT_ERROR';
  if (err.statusCode === 422) return 'UNPROCESSABLE_ENTITY';
  if (err.statusCode === 429) return 'RATE_LIMIT_ERROR';
  if (err.statusCode === 500) return 'INTERNAL_SERVER_ERROR';
  if (err.statusCode === 502) return 'BAD_GATEWAY_ERROR';
  if (err.statusCode === 503) return 'SERVICE_UNAVAILABLE_ERROR';
  return 'UNKNOWN_ERROR';
};

// Sanitize error message for production
export const sanitizeErrorMessage = (err: AppError, isDevelopment: boolean): string => {
  if (isDevelopment) {
    return err.message;
  }

  // In production, return generic messages for internal errors
  if (err.statusCode && err.statusCode >= 500) {
    return 'An internal server error occurred';
  }

  return err.message;
};

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Log error details
  logError(err, req);

  // Prepare error response
  const errorResponse: any = {
    error: {
      message: sanitizeErrorMessage(err, isDevelopment),
      type: getErrorType(err),
      code: err.code
    },
    timestamp: new Date().toISOString(),
    path: req.path,
    requestId: req.headers['x-request-id'] || generateRequestId()
  };

  // Include additional details in development
  if (isDevelopment) {
    errorResponse.error.stack = err.stack;
    errorResponse.error.details = {
      name: err.name,
      isOperational: err.isOperational,
      originalMessage: err.message
    };
  }

  // Include specific error codes for certain scenarios
  if (statusCode === 429) {
    errorResponse.error.retryAfter = 60; // Suggest retry after 60 seconds
  }

  res.status(statusCode).json(errorResponse);
};

// Generate request ID for tracking
const generateRequestId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Validation error helper
export class ValidationError extends AppError {
  constructor(message: string, field?: string) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

// Not found error helper
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// Unauthorized error helper
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, true, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

// Forbidden error helper
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, true, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

// Conflict error helper
export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409, true, 'CONFLICT');
    this.name = 'ConflictError';
  }
}