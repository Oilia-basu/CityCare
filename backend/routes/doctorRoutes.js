const router = require('express').Router();
const c = require('../controllers/doctorController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');

// Doctor-only (must be declared before "/:id")
router.get('/profile', protect, authorize('doctor'), c.getProfile);
router.put('/profile', protect, authorize('doctor'), uploadImage, c.updateProfile);
router.get('/dashboard', protect, authorize('doctor'), c.dashboard);
router.get('/appointments', protect, authorize('doctor'), c.appointments);
router.put('/availability', protect, authorize('doctor'), c.updateAvailability);
router.get('/patients/:patientId', protect, authorize('doctor'), c.patientDetails);

// Public
router.get('/', c.list);
router.get('/:id', c.getById);
router.get('/:id/availability', c.availability);

module.exports = router;
