const { body } = require('express-validator');

const loginValidator = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('La contraseña es requerida')
];

const resetPasswordRequestValidator = [
  body('email')
    .isEmail().withMessage('Email inválido')
    .normalizeEmail()
];

const resetPasswordValidator = [
  body('token')
    .notEmpty().withMessage('Token requerido'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Debe contener al menos una letra y un número')
];

const changePasswordValidator = [
  body('oldPassword')
    .notEmpty().withMessage('Contraseña actual requerida'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('La nueva contraseña debe tener al menos 8 caracteres')
    .matches(/^(?=.*[A-Za-z])(?=.*\d)/).withMessage('Debe contener al menos una letra y un número')
    .custom((value, { req }) => {
      if (value === req.body.oldPassword) {
        throw new Error('La nueva contraseña debe ser diferente a la actual');
      }
      return true;
    })
];

module.exports = {
  loginValidator,
  resetPasswordRequestValidator,
  resetPasswordValidator,
  changePasswordValidator
};