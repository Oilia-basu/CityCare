require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { startJobs } = require('./services/jobs');

const required = ['MONGO_URI', 'JWT_SECRET'];
const missing = required.filter((k) => !process.env[k] || process.env[k].startsWith('your_'));
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`);
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`API running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));
    startJobs();
  })
  .catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
