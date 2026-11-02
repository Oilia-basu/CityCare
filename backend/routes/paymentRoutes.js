const router = require('express').Router();
const c = require('../controllers/paymentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

// NOTE: POST /webhook is registered in app.js (needs the raw body, before express.json)
router.use(protect);
router.post('/create-order', authorize('patient', 'receptionist', 'admin'), c.createOrder);
router.post('/verify', authorize('patient', 'receptionist', 'admin'), c.verify);
router.get('/history', authorize('patient', 'receptionist', 'admin'), c.history);
router.post('/refund', authorize('admin'), c.refund);
router.put('/:appointmentId/mark-paid', authorize('receptionist', 'admin'), c.markPaid);

module.exports = router;
