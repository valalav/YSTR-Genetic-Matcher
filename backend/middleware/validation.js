const Joi = require('joi');

// Request validation middleware
const validateRequest = (schema, source = 'body') => {
  return (req, res, next) => {
    const data = source === 'query' ? req.query : req.body;

    const { error, value } = schema.validate(data, {
      allowUnknown: false,
      stripUnknown: true,
      abortEarly: false
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context.value
        }))
      });
    }

    // Replace original data with validated and sanitized data
    if (source === 'query') {
      req.query = value;
    } else {
      req.body = value;
    }

    next();
  };
};

// Async route handler wrapper
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Common validation schemas
const commonSchemas = {
  kitNumber: Joi.string().pattern(/^[A-Z0-9-]+$/).min(1).max(20),
  haplogroup: Joi.string().pattern(/^[A-Z0-9-]+$/).max(50),
  pagination: Joi.object({
    limit: Joi.number().integer().min(1).max(1000).default(100),
    offset: Joi.number().integer().min(0).default(0)
  })
};

module.exports = {
  validateRequest,
  asyncHandler,
  commonSchemas
};