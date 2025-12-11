const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: errors.array()
    });
  }
  next();
};

const doctorValidation = [
  body('name').trim().notEmpty().withMessage('Doctor name is required'),
  body('specialization').trim().notEmpty().withMessage('Specialization is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  validate
];

const slotValidation = [
  body('doctor_id').isInt({ min: 1 }).withMessage('Valid doctor ID is required'),
  body('slot_date').isDate().withMessage('Valid date is required (YYYY-MM-DD)'),
  body('slot_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time is required (HH:MM)'),
  body('duration_minutes').optional().isInt({ min: 15, max: 120 }).withMessage('Duration must be between 15-120 minutes'),
  validate
];

const bookingValidation = [
  body('slot_id').isInt({ min: 1 }).withMessage('Valid slot ID is required'),
  body('patient_name').trim().notEmpty().withMessage('Patient name is required'),
  body('patient_email').isEmail().withMessage('Valid email is required'),
  body('patient_phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  validate
];

const idValidation = [
  param('id').isInt({ min: 1 }).withMessage('Valid ID is required'),
  validate
];

module.exports = {
  doctorValidation,
  slotValidation,
  bookingValidation,
  idValidation
};