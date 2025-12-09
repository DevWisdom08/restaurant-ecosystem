import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  
  // Set status code
  const statusCode = err.statusCode || 500;
  
  // Determine error code
  const errorCode = err.code || (statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR');
  
  // Build error response
  const errorResponse: any = {
    success: false,
    error: {
      code: errorCode,
      message: err.message || 'An unexpected error occurred'
    }
  };
  
  // Add details if available
  if (err.details) {
    errorResponse.error.details = err.details;
  }
  
  // Add request ID for tracking
  errorResponse.error.request_id = req.headers['x-request-id'] || `req_${Date.now()}`;
  
  // In development, include stack trace
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.error.stack = err.stack;
  }
  
  // Send response
  res.status(statusCode).json(errorResponse);
}

// Custom error classes
export class ValidationError extends Error {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details?: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  code = 'UNAUTHORIZED';
  
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error {
  statusCode = 403;
  code = 'FORBIDDEN';
  
  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  statusCode = 409;
  code = 'CONFLICT';
  
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class PaymentError extends Error {
  statusCode = 402;
  code = 'PAYMENT_ERROR';
  details?: any;
  
  constructor(message: string, details?: any) {
    super(message);
    this.name = 'PaymentError';
    this.details = details;
  }
}

