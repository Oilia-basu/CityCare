const router = require('express').Router();
const c = require('../controllers/adminController');
const dep = require('../controllers/departmentController');
const { protect } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { uploadImage } = require('../middleware/uploadMiddleware');

router.use(protect, authorize('admin'));
router.get('/dashboard', c.dashboard);
router.get('/analytics', c.analytics);

router.get('/users', c.users);
router.put('/users/:id/status', c.setUserStatus);

router.get('/doctors', c.listDoctors);
router.post('/doctors', uploadImage, c.createDoctor);
router.put('/doctors/:id', uploadImage, c.updateDoctor);
router.delete('/doctors/:id', c.deleteDoctor);
router.get('/doctors/:id/schedule', c.getDoctorSchedule);
router.put('/doctors/:id/schedule', c.updateDoctorSchedule);

router.get('/patients', c.listPatients);
router.get('/patients/:id', c.getPatient);
router.put('/patients/:id', c.updatePatient);

router.get('/receptionists', c.listReceptionists);
router.post('/receptionists', c.createReceptionist);
router.put('/receptionists/:id', c.updateReceptionist);

router.get('/departments', dep.list);
router.post('/departments', uploadImage, dep.create);
router.put('/departments/:id', uploadImage, dep.update);
router.delete('/departments/:id', dep.remove);

router.get('/appointments', c.appointments);
router.get('/payments', c.payments);
router.get('/reports/appointments', c.exportAppointmentsCsv);

router.get('/settings', c.getSettings);
router.put('/settings', c.updateSettings);
router.get('/logs', c.logs);
router.post('/notifications/broadcast', c.broadcast);

module.exports = router;
