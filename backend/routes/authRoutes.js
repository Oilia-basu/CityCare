const router = require('express').Router();
const c = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const v = require('../validators/authValidator');

router.post('/register', v.registerRules, validate, c.register);
router.post('/login', v.loginRules, validate, c.login);
router.post('/logout', c.logout);
router.get('/me', protect, c.me);
router.post('/forgot-password', v.forgotRules, validate, c.forgotPassword);
router.post('/reset-password', v.resetRules, validate, c.resetPassword);
router.put('/profile', protect, c.updateAccount);
router.put('/change-password', protect, v.changePasswordRules, validate, c.changePassword);

module.exports = router;
