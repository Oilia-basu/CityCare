const router = require('express').Router();
const c = require('../controllers/patientController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');

router.use(protect, authorize('patient'));
router.get('/profile', c.getProfile);
router.put('/profile', uploadImage, c.updateProfile);
router.get('/appointments', c.appointments);
router.get('/dashboard', c.dashboard);

module.exports = router;
