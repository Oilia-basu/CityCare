const router = require('express').Router();
const c = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', c.list);
router.put('/read-all', c.markAllRead);
router.put('/:id/read', c.markRead);
router.delete('/:id', c.remove);

module.exports = router;
