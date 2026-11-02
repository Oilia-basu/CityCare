const router = require('express').Router();
const c = require('../controllers/reviewController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');

router.post('/', protect, authorize('patient'), c.create);
router.get('/doctor/:doctorId', c.forDoctor);

module.exports = router;
