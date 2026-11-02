// Express application: security middleware, routes, error handling.
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { sanitizeInput } = require('./middleware/validationMiddleware');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { webhook } = require('./controllers/paymentController');
const { publicInfo, contact } = require('./controllers/adminController');

const app = express();
app.set('trust proxy', 1); // Render sits behind a proxy

const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim().replace(/\/$/, ''));
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => (!origin || origins.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
  credentials: true,
}));
if (process.env.NODE_ENV !== 'test') app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Razorpay webhook needs the untouched raw body for signature verification -> register BEFORE express.json
app.post('/api/payments/webhook', express.raw({ type: '*/*', limit: '1mb' }), webhook);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(sanitizeInput);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts. Please try again in a few minutes.' } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 400, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Slow down.' } });
app.use('/api', apiLimiter);
app.use(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password'], authLimiter);

app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', time: new Date().toISOString() }));
app.get('/api/public/hospital', publicInfo);
app.post('/api/public/contact', authLimiter, contact);

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/doctors', require('./routes/doctorRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/receptionist', require('./routes/receptionistRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
