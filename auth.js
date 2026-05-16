// routes/auth.js — Authentication Routes
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

// Helper: send token response
const sendToken = (user, statusCode, res) => {
  const token = user.getSignedToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      uniqueId: user.uniqueId,
    },
  });
};

// ── POST /api/auth/register ───────────────
router.post(
  '/register',
  [
    body('name').notEmpty().withMessage('Name is required'),
    body('email').isEmail().withMessage('Valid email required'),
    body('password').isLength({ min: 6 }).withMessage('Password min 6 characters'),
    // FIX: Admin accounts cannot be self-registered via the public API.
    // Only student/teacher roles are allowed through registration.
    body('role').optional().isIn(['student', 'teacher']).withMessage('Admin accounts cannot be self-registered'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { name, email, password, role, academicData } = req.body;

      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already registered' });
      }

      // 🔥 ADD THIS FUNCTION HERE
      const generateId = () => {
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `USER-${Date.now().toString().slice(-4)}-${rand}`;
      };

      // 🔥 REPLACE USER CREATE
      const user = await User.create({
        name,
        email,
        password,
        role: role || 'student',
        uniqueId: generateId()   // ✅ IMPORTANT FIX
      });
      // If a student, and academic data was provided, create their Student record automatically
      if (user.role === 'student' && academicData) {
        try {
          const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
          const studentRecord = await Student.create({
            ...academicData,
            name: user.name,
            email: user.email,
            studentId: user.uniqueId || `STU-${rand}`,
            userId: user._id,
            createdBy: user._id,
          });
          // Store reference
          await User.findByIdAndUpdate(user._id, { $set: { studentDocId: studentRecord._id } });
        } catch (e) {
          // Don't fail registration if student doc creation fails
          console.error('Could not create student record:', e.message);
        }
      }

      sendToken(user, 201, res);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── POST /api/auth/login ──────────────────
router.post(
  '/login',
  [
    body('email').isEmail().withMessage('Valid email required'),
    body('password').notEmpty().withMessage('Password required'),
    body('role').optional().isIn(['student', 'teacher', 'admin']),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
      const { email, password, role } = req.body;

      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.matchPassword(password))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      // Role mismatch check (optional but added as UX safety)
      if (role && user.role !== role) {
        return res.status(401).json({
          success: false,
          message: `This account is registered as '${user.role}', not '${role}'`,
        });
      }

      sendToken(user, 200, res);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── GET /api/auth/me ──────────────────────
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.user._id);
  res.json({ success: true, user });
});

// ── GET /api/auth/my-student-record ───────
// Students: get their own linked Student document
router.get('/my-student-record', protect, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Only students can access this' });
  }
  try {
    const student = await Student.findOne({ userId: req.user._id });
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
