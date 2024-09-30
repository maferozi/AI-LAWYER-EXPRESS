const { check, validationResult } = require('express-validator');

const registerRules = [
  check('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ max: 50 })
    .withMessage('First name must be less than 50 characters')
    .matches(/^[a-zA-ZÀ-ÿ0-9\s,.'&-]*$/)
    .withMessage('First name contains invalid characters'),
  check('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),

  check('password')
    .trim()
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .isLength({ max: 100 })
    .withMessage('Password must be less than 100 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one digit')
    .matches(/[@$!%*?&#]/)
    .withMessage('Password must contain at least one special character'),

  // Handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({
        status: 'error',
        message: 'validation_error',
        errors: errors.array(),
      });
    }
    return next();
  },
];


const loginRules = [
  check('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required')
    .isEmail()
    .withMessage('Invalid email format')
    .isLength({ max: 100 })
    .withMessage('Email must be less than 100 characters'),

  check('password').trim().notEmpty().withMessage('Password is required'),

  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({
        status: 'error',
        message: 'validation_error',
        errors: errors.array(),
      });
    }
    return next();
  },
];

module.exports = {
    registerRules,
    loginRules,
  };
  