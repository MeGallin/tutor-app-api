import jwt from 'jsonwebtoken';
import { APIError } from './error.js';
import config from '../config/config.js';
import db from '../models/index.js';

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError('No token provided', 401);
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;

      // Check if user still exists and is active
      const user = await db.User.findByPk(decoded.id);
      if (!user || !user.active) {
        throw new APIError('User not found or inactive', 401);
      }

      next();
    } catch (err) {
      throw new APIError('Invalid or expired token', 401);
    }
  } catch (error) {
    next(error);
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new APIError('Not authorized to access this resource', 403));
    }
    next();
  };
};

export { verifyToken, authorize };
