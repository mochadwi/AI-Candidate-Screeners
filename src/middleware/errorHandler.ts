import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode?: number;
  public isOperational?: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log error details
  console.error(`Error ${statusCode}: ${message}`);
  console.error(err.stack);

  // Don't expose stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: {
      message,
      ...(isDevelopment && { stack: err.stack })
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
};