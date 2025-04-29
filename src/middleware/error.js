import logger from '../utils/logger.js';

class APIError extends Error {
  constructor(message, statusCode, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;

  if (!err.isOperational) {
    statusCode = statusCode || 500;
    message = err.message || 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  const response = {
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  if (process.env.NODE_ENV === 'development') {
    logger.error(`${err.stack}`);
  } else {
    logger.error(`${err.message}`);
  }

  res.status(statusCode).json(response);
};

const notFound = (req, res, next) => {
  const error = new APIError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

export { APIError, errorHandler, notFound };
