/**
 * @module AuthController
 * @description Authentication controller handling user registration, login and profile management
 */

import db from '../models/index.js';
import { APIError } from '../middleware/error.js';
import logger from '../utils/logger.js';
import jwt from 'jsonwebtoken';
import config from '../config/config.js';

const User = db.User;
const BlacklistedToken = db.BlacklistedToken;

/**
 * Register a new user
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      throw new APIError('Please provide name, email and password', 400);
    }

    if (password.length < 6) {
      throw new APIError('Password must be at least 6 characters long', 400);
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new APIError('Please provide a valid email address', 400);
    }

    // Check if user already exists
    const userExists = await User.findOne({ where: { email } });
    if (userExists) {
      throw new APIError('User with that email already exists', 400);
    }

    // Create new user
    const user = await User.create({
      name,
      email,
      password,
    });

    // Generate token
    const token = user.generateToken();

    logger.info(`User registered successfully: ${email}`);

    res.status(201).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`);
    next(error);
  }
};

/**
 * Log in a user
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Input validation
    if (!email || !password) {
      throw new APIError('Please provide email and password', 400);
    }

    // Check if user exists
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new APIError('Invalid credentials', 401);
    }

    // Check if password is correct
    const isMatch = await user.validPassword(password);
    if (!isMatch) {
      // Add a short delay to prevent timing attacks
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 500),
      );
      throw new APIError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.active) {
      throw new APIError('Your account has been deactivated', 403);
    }

    // Update last login time
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = user.generateToken();

    logger.info(`User logged in: ${email}`);

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        token,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`);
    next(error);
  }
};

/**
 * Get current user profile
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    if (!userId) {
      throw new APIError('User ID not found in request', 401);
    }

    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] },
    });

    if (!user) {
      throw new APIError('User not found', 404);
    }

    logger.debug(`Profile accessed for user ID: ${userId}`);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error(`Get profile error: ${error.message}`);
    next(error);
  }
};

/**
 * Log out a user by invalidating their token
 * @async
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const logout = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new APIError('No token provided', 400);
    }

    const token = authHeader.split(' ')[1];
    const userId = req.user.id;

    try {
      // Decode token to get expiration time
      const decoded = jwt.verify(token, config.jwtSecret);

      // Add token to blacklist
      await BlacklistedToken.create({
        token,
        userId,
        expiresAt: new Date(decoded.exp * 1000), // Convert Unix timestamp to Date
      });

      logger.info(`User logged out: ID ${userId}`);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (err) {
      // If token is invalid, still return success since user will be logged out
      logger.warn(
        `Invalid token during logout for user ID: ${userId}, Error: ${err.message}`,
      );
      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    }
  } catch (error) {
    logger.error(`Logout error: ${error.message}`);
    next(error);
  }
};

export { register, login, getProfile, logout };
