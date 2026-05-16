// routes/students.js — Enhanced Student CRUD (Connection-aware + Edit Restrictions)
const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const User    = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Helper: check if teacher has access to student (created or connected)
async function teacherHasAccess(teacherId, student) {
  if (String(student.createdBy) === String(teacherId)) return { access: true, isCreated: true };
  const conn = (student.connections || []).find(
    c => String(c.teacherId) === String(teacherId) && c.status === 'approved'
  );
  if (conn) return { access: true, isCreated: false };
  return { access: false, isCreated: false };
}

// ── GET /api/students ─────────────────────
router.get('/', async (req, res) => {
  try {
    let query = {};

    if (req.user.role === 'student') {
      query = { userId: req.user._id };
    } else if (req.user.role === 'teacher') {
      // Find all approved connected student IDs for this teacher
      const connectedIds = await Student.find({
        'connections.teacherId': req.user._id,
        'connections.status': 'approved',
      }).distinct('_id');

      query = {
        $or: [
          { createdBy: req.user._id },
          { _id: { $in: connectedIds } },
        ],
      };
    }

    if (req.query.level) query.level = req.query.level;
    if (req.query.year)  query.year  = req.query.year;

    const students = await Student.find(query)
      .select('-predictions -assignments -lifestyle -socioeconomic')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: students.length, data: students });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/students/search ───────────────
router.get('/search', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const { uniqueId, studentId } = req.query;
    if (!uniqueId && !studentId) {
      return res.status(400).json({ success: false, message: 'Provide uniqueId or studentId' });
    }

    let student = null;
    if (uniqueId) {
      const user = await User.findOne({ uniqueId });
      if (user) student = await Student.findOne({ userId: user._id });
      if (!student) student = await Student.findOne({ studentId: uniqueId });
    } else {
      student = await Student.findOne({ studentId });
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found with that ID' });
    }

    // Return only public academic data (not lifestyle/personal)
    const safe = {
      _id: student._id,
      name: student.name,
      studentId: student.studentId,
      level: student.level,
      year: student.year,
      course: student.course,
      attendance: student.attendance,
      cgpa: student.cgpa,
      studyHours: student.studyHours,
      semesters: student.semesters,
      connections: student.connections,
    };

    res.json({ success: true, data: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/students/inquiry ────────────
router.post('/inquiry', authorize('student'), async (req, res) => {
  try {
    const { question } = req.body;
    if (!question?.trim()) return res.status(400).json({ success: false, message: 'Question is required' });

    const student = await Student.findOne({ userId: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });

    student.inquiries.push({ question: question.trim() });
    await student.save();

    res.status(201).json({ success: true, message: 'Question submitted', data: student.inquiries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/students/my-inquiries ────────
router.get('/my-inquiries', authorize('student'), async (req, res) => {
  try {
    const student = await Student.findOne({ userId: req.user._id }).select('inquiries');
    if (!student) return res.status(404).json({ success: false, message: 'Student record not found' });
    res.json({ success: true, data: student.inquiries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/students/:id ─────────────────
router.get('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student') {
      if (String(student.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      return res.json({ success: true, data: student });
    }

    if (req.user.role === 'teacher') {
      const { access, isCreated } = await teacherHasAccess(req.user._id, student);
      if (!access) return res.status(403).json({ success: false, message: 'Access denied' });

      // Teachers only see academic data (not lifestyle/personal) for connected students
      if (!isCreated) {
        const teacherView = student.toObject();
        delete teacherView.lifestyle;
        delete teacherView.socioeconomic;
        teacherView._isConnected = true;
        teacherView._canEdit = false;
        return res.json({ success: true, data: teacherView });
      }
    }

    res.json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/students ────────────────────
router.post('/', async (req, res) => {
  try {
    if (req.user.role === 'student') {
      const existing = await Student.findOne({ userId: req.user._id });
      if (existing) {
        return res.status(400).json({ success: false, message: 'You already have a student record.' });
      }
      const student = await Student.create({
        ...req.body,
        name:      req.user.name,
        email:     req.user.email,
        studentId: req.user.uniqueId,
        userId:    req.user._id,
        createdBy: req.user._id,
      });
      return res.status(201).json({ success: true, data: student });
    }

    const student = await Student.create({ ...req.body, createdBy: req.user._id });
    if (req.user.role === 'teacher') {
      await User.findByIdAndUpdate(req.user._id, { $addToSet: { managedStudents: student._id } });
    }

    res.status(201).json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /api/students/:id ─────────────────
router.put('/:id', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student') {
      if (String(student.userId) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    if (req.user.role === 'teacher') {
      const { access, isCreated } = await teacherHasAccess(req.user._id, student);
      if (!access) return res.status(403).json({ success: false, message: 'Access denied' });
      // Connected (not created) students: teacher CANNOT edit marks
      if (!isCreated) {
        return res.status(403).json({
          success: false,
          message: 'You can only view data for connected students, not edit it.',
        });
      }
    }

    delete req.body.predictions;

    const updated = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /api/students/:id/semesters ──────
router.put('/:id/semesters', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'teacher') {
      const { access, isCreated } = await teacherHasAccess(req.user._id, student);
      if (!access || !isCreated) {
        return res.status(403).json({ success: false, message: 'Cannot edit connected student semesters' });
      }
    }

    student.semesters.push(req.body);

    // Auto-compute consistency score (variance of CGPAs)
    const cgpas = student.semesters.filter(s => s.cgpa).map(s => s.cgpa);
    if (cgpas.length > 1) {
      const mean = cgpas.reduce((a, b) => a + b) / cgpas.length;
      const variance = cgpas.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cgpas.length;
      student.consistencyScore = Math.max(0, Math.round(100 - variance * 10));
    }

    // Auto-compute improvement rate
    if (cgpas.length >= 2) {
      const prev = cgpas[cgpas.length - 2];
      const curr = cgpas[cgpas.length - 1];
      student.improvementRate = +((( curr - prev) / prev) * 100).toFixed(1);
    }

    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /api/students/:id/semesters/:index ──────
router.put('/:id/semesters/:index', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    
    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'teacher') {
      const { access, isCreated } = await teacherHasAccess(req.user._id, student);
      if (!access || !isCreated) {
        return res.status(403).json({ success: false, message: 'Cannot edit connected student semesters' });
      }
    }

    const { index } = req.params;
    if (index < 0 || index >= student.semesters.length) {
      return res.status(400).json({ success: false, message: 'Invalid semester index' });
    }

    // Deep merge or replace
    student.semesters[index] = { ...student.semesters[index].toObject(), ...req.body };

    // Auto-compute consistency score (variance of CGPAs)
    const cgpas = student.semesters.filter(s => s.cgpa).map(s => s.cgpa);
    if (cgpas.length > 1) {
      const mean = cgpas.reduce((a, b) => a + b) / cgpas.length;
      const variance = cgpas.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cgpas.length;
      student.consistencyScore = Math.max(0, Math.round(100 - variance * 10));
    }

    if (cgpas.length >= 2) {
      const prev = cgpas[cgpas.length - 2];
      const curr = cgpas[cgpas.length - 1];
      student.improvementRate = +(((curr - prev) / prev) * 100).toFixed(1);
    }

    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/students/:id/semesters/:index ──────
router.delete('/:id/semesters/:index', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    if (req.user.role === 'teacher') {
      const { access, isCreated } = await teacherHasAccess(req.user._id, student);
      if (!access || !isCreated) {
        return res.status(403).json({ success: false, message: 'Cannot delete connected student semesters' });
      }
    }

    const { index } = req.params;
    if (index < 0 || index >= student.semesters.length) {
      return res.status(400).json({ success: false, message: 'Invalid semester index' });
    }

    student.semesters.splice(index, 1);

    // Auto-compute consistency score (variance of CGPAs)
    const cgpas = student.semesters.filter(s => s.cgpa).map(s => s.cgpa);
    if (cgpas.length > 1) {
      const mean = cgpas.reduce((a, b) => a + b) / cgpas.length;
      const variance = cgpas.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cgpas.length;
      student.consistencyScore = Math.max(0, Math.round(100 - variance * 10));
    } else {
      student.consistencyScore = 70; // Fallback
    }

    if (cgpas.length >= 2) {
      const prev = cgpas[cgpas.length - 2];
      const curr = cgpas[cgpas.length - 1];
      student.improvementRate = +(((curr - prev) / prev) * 100).toFixed(1);
    } else {
      student.improvementRate = 0;
    }

    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /api/students/:id/grades ──────────
router.put('/:id/grades', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    student.grades = student.grades || [];
    student.grades.push(req.body);
    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── PUT /api/students/:id/assignments ─────
router.put('/:id/assignments', async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    student.assignments.push(req.body);
    await student.save();
    res.json({ success: true, data: student });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/students/:id ──────────────
router.delete('/:id', authorize('admin', 'teacher'), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    if (req.user.role === 'teacher') {
      if (String(student.createdBy) !== String(req.user._id)) {
        return res.status(403).json({ success: false, message: 'You can only delete students you created.' });
      }
      // Optional: remove from teacher's managedStudents list
      await User.findByIdAndUpdate(req.user._id, { $pull: { managedStudents: student._id } });
    }

    await Student.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Student removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
