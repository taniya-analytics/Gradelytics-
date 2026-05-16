// routes/analytics.js — Enhanced Cohort Analytics Routes
const express = require('express');
const router  = express.Router();
const Student = require('../models/Student');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);

// Helper: get students based on role
async function getStudentsForUser(user) {
  if (user.role === 'admin') return Student.find({});
  if (user.role === 'teacher') {
    // Students created by teacher + approved connected students
    const approvedIds = await Student.find({
      'connections.teacherId': user._id,
      'connections.status': 'approved',
    }).distinct('_id');
    return Student.find({
      $or: [
        { createdBy: user._id },
        { _id: { $in: approvedIds } },
      ],
    });
  }
  return [];
}

// ── GET /api/analytics/overview ──────────
router.get('/overview', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const total         = students.length;
    if (total === 0) return res.json({ success: true, data: { total: 0 } });

    const avgAttendance = Math.round(students.reduce((s, st) => s + (st.attendance || 0), 0) / total);
    const avgStudyHours = +(students.reduce((s, st) => s + (st.studyHours || 0), 0) / total).toFixed(1);
    const avgCgpa       = +(students.reduce((s, st) => s + (st.cgpa || 0), 0) / total).toFixed(2);

    const withPrediction = students.filter(s => s.predictions.length > 0);
    const atRisk = withPrediction.filter(s => {
      const last = s.predictions[s.predictions.length - 1];
      return last.predictedFinalScore < 50 || last.riskLevel === 'High';
    }).length;
    const needsAttention = withPrediction.filter(s => {
      const last = s.predictions[s.predictions.length - 1];
      const score = last.predictedFinalScore;
      return score >= 50 && score < 65;
    }).length;
    const onTrack = withPrediction.filter(s => {
      const last = s.predictions[s.predictions.length - 1];
      return last.predictedFinalScore >= 65;
    }).length;

    res.json({
      success: true,
      data: {
        total, avgAttendance, avgStudyHours, avgCgpa,
        atRisk, needsAttention, onTrack,
        predictionsGenerated: withPrediction.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/at-risk ────────────
router.get('/at-risk', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const atRisk = students
      .filter(s => {
        if (!s.predictions.length) return false;
        const last = s.predictions[s.predictions.length - 1];
        return last.predictedFinalScore < 55 || last.dropoutRisk > 50 || last.riskLevel === 'High';
      })
      .map(s => {
        const last = s.predictions[s.predictions.length - 1];
        return {
          id: s._id, name: s.name, studentId: s.studentId, level: s.level, year: s.year,
          attendance: s.attendance, cgpa: s.cgpa,
          predictedScore: last.predictedFinalScore,
          dropoutRisk: last.dropoutRisk,
          riskLevel: last.riskLevel || 'High',
          trend: last.trend || 'Stable',
          recommendations: last.recommendations,
        };
      })
      .sort((a, b) => a.predictedScore - b.predictedScore);

    res.json({ success: true, count: atRisk.length, data: atRisk });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/attendance ─────────
router.get('/attendance', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const buckets = { '90-100': 0, '75-89': 0, '60-74': 0, 'Below 60': 0 };
    students.forEach(s => {
      if      (s.attendance >= 90) buckets['90-100']++;
      else if (s.attendance >= 75) buckets['75-89']++;
      else if (s.attendance >= 60) buckets['60-74']++;
      else                          buckets['Below 60']++;
    });
    res.json({
      success: true,
      data: Object.entries(buckets).map(([range, count]) => ({ range, count })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/subjects ───────────
// Average score per subject across cohort
router.get('/subjects', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const subjectMap = {};

    for (const st of students) {
      for (const sem of (st.semesters || [])) {
        for (const subj of (sem.subjects || [])) {
          if (!subj.subjectName) continue;
          if (!subjectMap[subj.subjectName]) subjectMap[subj.subjectName] = [];
          const tests = subj.tests || [];
          if (tests.length > 0) {
            const avg = tests.reduce((s, t) => s + (t.score / t.maxScore * 100), 0) / tests.length;
            subjectMap[subj.subjectName].push(avg);
          } else if (subj.marks != null) {
            subjectMap[subj.subjectName].push(subj.marks);
          }
        }
      }
      // Also from subjectMarks flat array
      for (const sm of (st.subjectMarks || [])) {
        if (!sm.subject) continue;
        if (!subjectMap[sm.subject]) subjectMap[sm.subject] = [];
        subjectMap[sm.subject].push(sm.marks);
      }
    }

    const data = Object.entries(subjectMap).map(([subject, scores]) => ({
      subject,
      avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      studentCount: scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/trends ─────────────
// CGPA trend over semesters (class-wide average per semester position)
router.get('/trends', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const semesterMap = {};  // label → [cgpa values]

    for (const st of students) {
      for (const sem of (st.semesters || [])) {
        if (!sem.semesterLabel || !sem.cgpa) continue;
        if (!semesterMap[sem.semesterLabel]) semesterMap[sem.semesterLabel] = [];
        semesterMap[sem.semesterLabel].push(sem.cgpa);
      }
    }

    const data = Object.entries(semesterMap).map(([label, cgpas]) => ({
      semester: label,
      avgCgpa: +(cgpas.reduce((a, b) => a + b, 0) / cgpas.length).toFixed(2),
      count: cgpas.length,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/predictions/summary ─
router.get('/predictions/summary', authorize('teacher', 'admin'), async (req, res) => {
  try {
    const students = await getStudentsForUser(req.user);
    const withPred = students.filter(s => s.predictions.length > 0);
    const scores = withPred.map(s => s.predictions[s.predictions.length - 1].predictedFinalScore);
    if (scores.length === 0) return res.json({ success: true, data: { count: 0 } });

    const avg = +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
    const min = Math.min(...scores);
    const max = Math.max(...scores);

    res.json({ success: true, data: { avg, min, max, count: scores.length, scores } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/analytics/student/:id ────────
// Per-student analytics — for student's own analytics page
router.get('/student/:id', async (req, res) => {
  try {
    let student;
    
    if (req.params.id === 'me' && req.user.role === 'student') {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }

    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Auth guard
    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // CGPA trend per semester
    const cgpaTrend = (student.semesters || [])
      .filter(s => s.cgpa)
      .map(s => ({ semester: s.semesterLabel, cgpa: s.cgpa }));

    // Subject performance
    const subjectPerformance = [];
    for (const sem of (student.semesters || [])) {
      for (const subj of (sem.subjects || [])) {
        const tests = subj.tests || [];
        if (tests.length === 0) continue;
        const avg = Math.round(tests.reduce((s, t) => s + (t.score / t.maxScore * 100), 0) / tests.length);
        subjectPerformance.push({ subject: subj.subjectName, avg, semester: sem.semesterLabel });
      }
    }

    // Prediction history
    const predHistory = (student.predictions || [])
      .sort((a, b) => new Date(a.generatedAt) - new Date(b.generatedAt))
      .map((p, i) => ({
        run: `Run ${i + 1}`,
        score: p.predictedFinalScore,
        pass: p.passProbability,
        risk: p.dropoutRisk,
        riskLevel: p.riskLevel,
        trend: p.trend,
      }));

    // Subject insights virtual
    const insights = student.subjectInsights;

    res.json({
      success: true,
      data: {
        cgpaTrend,
        subjectPerformance,
        predHistory,
        insights,
        attendance: student.attendance,
        studyHours: student.studyHours,
        cgpa: student.cgpa,
        consistencyScore: student.consistencyScore,
        lifestyle: student.lifestyle,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
