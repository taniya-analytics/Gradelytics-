// routes/connect.js — Teacher ↔ Student Connection System
const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// ── POST /api/connect/request ──────────────────────────────────────────────
// Student sends a connection request using Teacher's uniqueId
router.post('/request', authorize('student'), async (req, res) => {
  try {
    const { teacherUniqueId } = req.body;
    if (!teacherUniqueId) {
      return res.status(400).json({ success: false, message: 'teacherUniqueId is required' });
    }

    // Find the teacher
    const teacher = await User.findOne({ uniqueId: teacherUniqueId, role: 'teacher' });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found with that ID' });
    }

    // Find student's record
    const student = await Student.findOne({ userId: req.user._id });
    if (!student) {
      return res.status(404).json({ success: false, message: 'You must have a student profile first' });
    }

    // Check for existing connection
    const existing = student.connections.find(
      c => String(c.teacherId) === String(teacher._id)
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Connection already ${existing.status}. Cannot send another request.`,
      });
    }

    // Add connection request
    student.connections.push({
      teacherId:       teacher._id,
      teacherName:     teacher.name,
      teacherUniqueId: teacher.uniqueId,
      status:          'pending',
    });
    await student.save();

    res.status(201).json({
      success: true,
      message: `Connection request sent to ${teacher.name}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/connect/my ─────────────────────────────────────────────────────
// Student sees their own connections
router.get('/my', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).select('connections');
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });
    res.json({ success: true, data: student.connections });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/connect/pending ────────────────────────────────────────────────
// Teacher sees all pending requests from students
router.get('/pending', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await Student.find({
      'connections.teacherId': req.user._id,
      'connections.status': 'pending',
    }).select('name studentId userId connections');

    const pending = [];
    for (const st of students) {
      const conn = st.connections.find(
        c => String(c.teacherId) === String(req.user._id) && c.status === 'pending'
      );
      if (conn) {
        pending.push({
          studentDocId: st._id,
          studentName:  st.name,
          studentId:    st.studentId,
          connectionId: conn._id,
          requestedAt:  conn.requestedAt,
        });
      }
    }

    res.json({ success: true, count: pending.length, data: pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/connect/connected ──────────────────────────────────────────────
// Teacher sees all approved connections
router.get('/connected', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await Student.find({
      'connections.teacherId': req.user._id,
      'connections.status': 'approved',
    }).select('name studentId level year course attendance cgpa predictions');

    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/connect/approve/:studentDocId/:connectionId ───────────────────
// Teacher approves a connection request
router.post('/approve/:studentDocId/:connectionId', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentDocId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const conn = student.connections.id(req.params.connectionId);
    if (!conn) return res.status(404).json({ success: false, message: 'Connection request not found' });
    if (String(conn.teacherId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not your connection request' });
    }
    if (conn.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Already ${conn.status}` });
    }

    conn.status      = 'approved';
    conn.resolvedAt  = new Date();
    await student.save();

    // Mirror on teacher's side
    await User.findByIdAndUpdate(req.user._id, {
      $addToSet: { connectedStudents: student._id },
    });

    res.json({ success: true, message: `Connected with ${student.name}` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/connect/reject/:studentDocId/:connectionId ────────────────────
// Teacher rejects a connection request
router.post('/reject/:studentDocId/:connectionId', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentDocId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const conn = student.connections.id(req.params.connectionId);
    if (!conn || String(conn.teacherId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorised' });
    }

    conn.status     = 'rejected';
    conn.resolvedAt = new Date();
    await student.save();

    res.json({ success: true, message: 'Request rejected' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/connect/:studentDocId ───────────────────────────────────────
// Disconnect — either side can disconnect
router.delete('/:studentDocId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentDocId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    let teacherId;

    if (req.user.role === 'teacher' || req.user.role === 'admin') {
      teacherId = req.user._id;
    } else {
      // Student can only disconnect from their own record
      if (String(student.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Not your record' });
      }
      // Need target teacher from body
      teacherId = req.body.teacherId;
      if (!teacherId) return res.status(400).json({ success: false, message: 'teacherId required in body' });
    }

    student.connections = student.connections.filter(
      c => String(c.teacherId) !== String(teacherId)
    );
    await student.save();

    // Remove from teacher's connectedStudents
    await User.findByIdAndUpdate(teacherId, {
      $pull: { connectedStudents: student._id },
    });

    res.json({ success: true, message: 'Disconnected successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
