// routes/admin.js — Admin Panel Routes
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('admin'));

// ── GET /api/admin/users ───────────────────
// List all users with optional filters
router.get('/users', async (req, res) => {
  try {
    const { role, search } = req.query;
    let query = {};
    if (role && role !== 'all') query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { uniqueId: { $regex: search, $options: 'i' } },
      ];
    }
    const users = await User.find(query).sort({ createdAt: -1 }).select('-password');
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/stats ───────────────────
// System-wide statistics
router.get('/stats', async (req, res) => {
  try {
    const [totalStudents, totalTeachers, totalAdmins, studentDocs] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ role: 'teacher' }),
      User.countDocuments({ role: 'admin' }),
      Student.find({}).select('predictions createdAt'),
    ]);

    const predictionCount = studentDocs.reduce((sum, s) => sum + s.predictions.length, 0);
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name role uniqueId createdAt');

    res.json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        totalAdmins,
        totalUsers: totalStudents + totalTeachers + totalAdmins,
        totalStudentDocs: studentDocs.length,
        predictionCount,
        recentUsers,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/admin/users/:id ───────────
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/inquiries ──────────────
router.get('/inquiries', async (req, res) => {
  try {
    const students = await Student.find({ 'inquiries.0': { $exists: true } })
      .select('name studentId inquiries');
    
    const allInquiries = [];
    students.forEach(s => {
      s.inquiries.forEach(i => {
        allInquiries.push({
          ...i.toObject(),
          studentName:  s.name,
          studentId:    s.studentId,
          studentDocId: s._id,
        });
      });
    });

    allInquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, count: allInquiries.length, data: allInquiries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/admin/inquiries/:sid/:iid/reply ──
router.put('/inquiries/:sid/:iid/reply', async (req, res) => {
  try {
    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ success: false, message: 'Answer is required' });

    const student = await Student.findById(req.params.sid);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const inquiry = student.inquiries.id(req.params.iid);
    if (!inquiry) return res.status(404).json({ success: false, message: 'Inquiry not found' });

    inquiry.answer    = answer.trim();
    inquiry.status    = 'replied';
    inquiry.repliedAt = new Date();

    await student.save();
    res.json({ success: true, message: 'Reply sent', data: inquiry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
