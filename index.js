// ─────────────────────────────────────────
//  Gradelytics — Express Server Entry Point
// ─────────────────────────────────────────
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ────────────────────────────
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// ── Routes ────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/predict', require('./routes/predict'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/connect', require('./routes/connect')); // NEW: Connection system

// ── Health Check ──────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', service: 'Gradelytics API', timestamp: new Date() });
});

// ── Global Error Handler ──────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`\n🚀 Gradelytics API running on port ${PORT} [${process.env.NODE_ENV}]\n`)
);

// ── Admin Routes ──────────────────────────
// (append this to existing route registrations)
