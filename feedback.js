// routes/feedback.js — Teacher-to-Student Feedback (Connection-aware)
const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Helper: teacher has access (created OR connected)
async function teacherCanFeedback(teacherId, student) {
  if (String(student.createdBy) === String(teacherId)) return true;
  const conn = (student.connections || []).find(
    c => String(c.teacherId) === String(teacherId) && c.status === 'approved'
  );
  return !!conn;
}

// ── POST /api/feedback ─────────────────────────────────
// Teacher sends feedback using student's DB _id (from their own list)
router.post('/', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { studentId, message } = req.body;
    if (!studentId || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'studentId and message are required' });
    }

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Only to connected or created students
    const hasAccess = await teacherCanFeedback(req.user._id, student);
    if (!hasAccess && req.user.role === 'teacher') {
      return res.status(403).json({
        success: false,
        message: 'You can only send feedback to students connected to you or added by you',
      });
    }

    // Student must have a real user account (registered student — not mock data)
    // We still allow sending to teacher-created (mock) students for now
    const feedbackEntry = {
      teacherId:   req.user._id,
      teacherName: req.user.name,
      message:     message.trim(),
      isRead:      false,
      sentAt:      new Date(),
    };

    student.feedback = student.feedback || [];
    student.feedback.push(feedbackEntry);
    await student.save();

    res.status(201).json({ success: true, message: 'Feedback sent successfully', data: feedbackEntry });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/feedback/student/:studentId ──────────────
router.get('/student/:studentId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId)
      .select('feedback name studentId createdBy userId connections');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'teacher') {
      const ok = await teacherCanFeedback(req.user._id, student);
      if (!ok) return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const sorted = [...(student.feedback || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    res.json({ success: true, count: sorted.length, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/feedback/my ───────────────────────────────
// Student gets their own feedback
router.get('/my', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id })
      .select('feedback name studentId');
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

    const sorted = [...(student.feedback || [])].sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    res.json({ success: true, count: sorted.length, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/feedback/teacher ──────────────────────────
router.get('/teacher', authorize('teacher', 'admin'), async (req, res) => {
  try {
    // Get all students the teacher has access to
    const connectedIds = await Student.find({
      'connections.teacherId': req.user._id,
      'connections.status': 'approved',
    }).distinct('_id');

    const students = await Student.find({
      $or: [{ createdBy: req.user._id }, { _id: { $in: connectedIds } }],
    }).select('name studentId feedback');

    const allFeedback = [];
    for (const student of students) {
      for (const fb of (student.feedback || [])) {
        if (String(fb.teacherId) === String(req.user._id)) {
          allFeedback.push({
            ...fb.toObject(),
            studentName:  student.name,
            studentId:    student.studentId,
            studentDocId: student._id,
          });
        }
      }
    }

    allFeedback.sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
    res.json({ success: true, count: allFeedback.length, data: allFeedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/feedback/:feedbackId/read ─────────────────
router.put('/:feedbackId/read', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

    const fb = student.feedback?.id(req.params.feedbackId);
    if (!fb) return res.status(404).json({ success: false, message: 'Feedback not found' });

    fb.isRead = true;
    await student.save();
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
