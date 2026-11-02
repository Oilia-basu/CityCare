const router = require('express').Router();
const c = require('../controllers/appointmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const v = require('../validators/appointmentValidator');

router.use(protect);
router.get('/available-slots', c.availableSlots);
router.post('/', authorize('patient', 'receptionist', 'admin'), v.createAppointmentRules, validate, c.create);
router.get('/', c.list);
router.get('/:id', c.getOne);
router.get('/:id/receipt', c.receipt);
router.put('/:id/cancel', c.cancel);
router.put('/:id/reschedule', authorize('patient', 'receptionist', 'admin'), v.rescheduleRules, validate, c.reschedule);
router.put('/:id/status', v.statusRules, validate, c.updateStatus);

module.exports = router;
