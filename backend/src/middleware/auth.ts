import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    user_id: number;
    email: string;
    role: string;
    location_id?: number;
  };
}

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      throw new UnauthorizedError('Access token required');
    }
    
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET not configured');
    }
    
    const decoded = jwt.verify(token, secret) as any;
    
    req.user = {
      user_id: decoded.user_id,
      email: decoded.email,
      role: decoded.role,
      location_id: decoded.location_id
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid or expired token'));
    } else {
      next(error);
    }
  }
}

export function authorizeRoles(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('You do not have permission to access this resource'));
    }
    
    next();
  };
}

// Middleware to check if user can access specific location
export function authorizeLocation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(new UnauthorizedError('Authentication required'));
  }
  
  // Admin can access all locations
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Check if location_id in request matches user's location
  const requestedLocationId = parseInt(req.params.location_id || req.body.location_id);
  
  if (requestedLocationId && req.user.location_id && requestedLocationId !== req.user.location_id) {
    return next(new ForbiddenError('You do not have access to this location'));
  }
  
  next();
}

