const router = require('express').Router();
const c = require('../controllers/departmentController');
router.get('/', c.list);
module.exports = router;
