const router = require('express').Router();
const c = require('../controllers/receptionistController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { validate } = require('../middleware/validationMiddleware');
const v = require('../validators/appointmentValidator');

router.use(protect, authorize('receptionist', 'admin'));
router.get('/dashboard', c.dashboard);
router.post('/patients', c.registerPatient);
router.get('/patients', c.searchPatients);
router.post('/appointments', v.createAppointmentRules, validate, c.book);
router.put('/appointments/:id', c.update);
router.put('/appointments/:id/check-in', c.checkIn);
router.get('/queue', c.queue);

module.exports = router;
