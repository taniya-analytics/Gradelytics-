// routes/predict.js — AI Prediction Routes (Enhanced with new features)
const express = require('express');
const router  = express.Router();
const axios   = require('axios');
const Student = require('../models/Student');
const { protect } = require('../middleware/auth');

// ── POST /api/predict/anonymous ──────────
// Public route for unregistered users
router.post('/anonymous', async (req, res) => {
  try {
    const {
      attendance = 75,
      assignmentAvg = 60,
      midtermScore = 60,
      studyHours = 4,
      previousGPA = 3.0,
      subjectAvgScore = 60,
      cgpa = 3.0,
      level = 'Undergraduate',
      subjectBreakdown = [],
      sleepHours = 7,
      stressLevel = 5,
      screenTime = 3,
      resourceAccess = 3,
      studyEnvironment = 3
    } = req.body;

    const features = {
      attendance,
      assignmentAvg,
      midtermScore,
      studyHours,
      previousGPA,
      subjectAvgScore,
      cgpa,
      consistencyScore: 70, // Default for anonymous
      level,
      subjectBreakdown,
      sleepHours,
      stressLevel,
      screenTime,
      resourceAccess,
      studyEnvironment,
    };

    // Call Python ML service
    try {
      const response = await axios.post(
        `${process.env.ML_SERVICE_URL}/predict`,
        features,
        { timeout: 10000 }
      );
      
      const mlResult = response.data;
      const score = mlResult.predictedFinalScore;
      const riskLevel = score >= 65 ? 'Low' : score >= 50 ? 'Medium' : 'High';

      res.json({
        success: true,
        data: {
          predictedFinalScore: mlResult.predictedFinalScore,
          passProbability:     mlResult.passProbability,
          dropoutRisk:         mlResult.dropoutRisk,
          confidence:          mlResult.confidence,
          riskLevel,
          recommendations:     mlResult.recommendations,
          featuresUsed:        features,
        },
      });
    } catch (mlErr) {
      console.error('ML service error:', mlErr.message);
      res.status(502).json({
        success: false,
        message: 'ML service unavailable',
        detail: mlErr.message
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.use(protect);

// ── POST /api/predict/:studentId ─────────
router.post('/:studentId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const useLatestOnly = req.body.useLatestOnly === true;
    const lastSem = student.semesters?.length > 0 ? student.semesters[student.semesters.length - 1] : null;
    const allSemesters = student.semesters || [];
    const targetSemesters = useLatestOnly && lastSem ? [lastSem] : allSemesters;

    // ── Compute subjectAvgScore from semester subject marks ──────────────
    let subjectAvgScore = 60; // fallback default
    let subjectBreakdown = [];

    if (targetSemesters.length > 0) {
      const allSubjects = targetSemesters.flatMap(sem => sem.subjects || []);
      
      // Collect subject marks from all relevant semesters
      const subjectMarksData = allSubjects
        .filter(s => s.marks != null && s.marks > 0)
        .map(s => ({ subject: s.subjectName, marks: s.marks }));
      
      // Also compute marks from test scores for subjects without direct marks
      for (const subj of allSubjects) {
        if (subj.marks == null || subj.marks === 0) {
          const tests = subj.tests || [];
          if (tests.length > 0) {
            const testAvg = Math.round(tests.reduce((sum, t) => sum + (t.score / t.maxScore) * 100, 0) / tests.length);
            subjectMarksData.push({ subject: subj.subjectName, marks: testAvg });
          }
        }
      }

      if (subjectMarksData.length > 0) {
        subjectAvgScore = Math.round(subjectMarksData.reduce((sum, s) => sum + s.marks, 0) / subjectMarksData.length);
        subjectBreakdown = subjectMarksData;
      }
    }
    // Also check flat subjectMarks array as fallback
    if (subjectBreakdown.length === 0 && student.subjectMarks?.length > 0) {
      subjectAvgScore = Math.round(student.subjectMarks.reduce((sum, s) => sum + s.marks, 0) / student.subjectMarks.length);
      subjectBreakdown = student.subjectMarks.map(s => ({ subject: s.subject, marks: s.marks }));
    }

    // ── Compute assignmentAvg from semester subject assignments ──────────
    let assignmentAvg = typeof req.body.assignmentAvg !== 'undefined' && req.body.assignmentAvg !== ''
      ? Number(req.body.assignmentAvg) : null;
      
    if (assignmentAvg === null) {
      // Try to get from semester subject assignments first
      const semAssignments = targetSemesters
        .flatMap(sem => (sem.subjects || []).flatMap(s => s.assignments || []));
      
      if (semAssignments.length > 0) {
        assignmentAvg = Math.round(semAssignments.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / semAssignments.length);
      } else if (student.assignments && student.assignments.length > 0) {
        // Fallback to legacy flat assignments
        assignmentAvg = Math.round(student.assignments.reduce((sum, a) => sum + (a.score / a.maxScore) * 100, 0) / student.assignments.length);
      } else {
        assignmentAvg = 60;
      }
    }

    // ── Compute midtermScore from semester subject tests ─────────────────
    let midtermScore = typeof req.body.midtermScore !== 'undefined' && req.body.midtermScore !== ''
      ? Number(req.body.midtermScore) : null;
      
    if (midtermScore === null) {
      // Compute from semester subject test scores
      const semTests = targetSemesters
        .flatMap(sem => (sem.subjects || []).flatMap(s => s.tests || []));
      
      if (semTests.length > 0) {
        midtermScore = Math.round(semTests.reduce((sum, t) => sum + (t.score / t.maxScore) * 100, 0) / semTests.length);
      } else if (targetSemesters.length > 0 && targetSemesters[targetSemesters.length - 1]?.tgpa) {
        midtermScore = targetSemesters[targetSemesters.length - 1].tgpa * 10;
      } else {
        const latestGrade = student.grades && student.grades.length > 0
          ? student.grades[student.grades.length - 1]
          : null;
        midtermScore = (latestGrade?.subjects
            ? Math.round(latestGrade.subjects.reduce((s, sub) => s + sub.score, 0) / latestGrade.subjects.length)
            : 60);
      }
    }

    // Compute consistency score from semesters
    const cgpas = useLatestOnly && lastSem?.cgpa ? [lastSem.cgpa] : (student.semesters || []).filter(s => s.cgpa).map(s => s.cgpa);
    let consistencyScore = student.consistencyScore || 70;
    if (cgpas.length > 1) {
      const mean     = cgpas.reduce((a, b) => a + b) / cgpas.length;
      const variance = cgpas.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / cgpas.length;
      consistencyScore = Math.max(0, Math.round(100 - variance * 10));
    }
    
    // Setup base CGPA
    const cgpaToUse = useLatestOnly && lastSem?.cgpa ? lastSem.cgpa : student.cgpa;

    // Build feature payload
    const features = {
      attendance:       student.attendance,
      assignmentAvg,
      midtermScore,
      studyHours:       student.studyHours,
      previousGPA:      student.previousGPA,
      subjectAvgScore,
      cgpa:             cgpaToUse,
      consistencyScore,
      level:            student.level,
      // Subject breakdown for recommendations
      subjectBreakdown,
      // Lifestyle (optional)
      sleepHours:   student.lifestyle?.sleepHours  || 7,
      stressLevel:  student.lifestyle?.stressLevel || 5,
      screenTime:   student.lifestyle?.screenTime  || 3,
      // Socio-economic (optional)
      resourceAccess:   student.socioeconomic?.resourceAccess    || 3,
      studyEnvironment: student.socioeconomic?.studyEnvironment  || 3,
    };

    // Call Python ML service
    let mlResult;
    try {
      const response = await axios.post(
        `${process.env.ML_SERVICE_URL}/predict`,
        features,
        { timeout: 10000 }
      );
      mlResult = response.data;
    } catch (mlErr) {
      console.error('ML service error:', mlErr.message);
      return res.status(502).json({
        success: false,
        message: 'ML service unavailable. Ensure the Python service is running.',
        detail: mlErr.message,
      });
    }

    // Determine trend from CGPA history
    let trend = 'Stable';
    if (cgpas.length >= 2) {
      const diff = cgpas[cgpas.length - 1] - cgpas[cgpas.length - 2];
      if (diff > 0.2) trend = 'Improving';
      else if (diff < -0.2) trend = 'Declining';
    }

    // Determine risk level
    const score = mlResult.predictedFinalScore;
    const riskLevel = score >= 65 ? 'Low' : score >= 50 ? 'Medium' : 'High';

    // Build prediction record
    const predictionRecord = {
      predictedFinalScore: mlResult.predictedFinalScore,
      passProbability:     mlResult.passProbability,
      dropoutRisk:         mlResult.dropoutRisk,
      confidence:          mlResult.confidence,
      riskLevel,
      trend,
      consistencyScore,
      recommendations:     mlResult.recommendations,
      featuresUsed:        features,
      generatedAt:         new Date(),
    };

    student.predictions.push(predictionRecord);

    // Update strong/weak subjects from semesters
    const insights = student.subjectInsights;
    if (insights) {
      student.strongSubjects = insights.strong.map(s => s.name).slice(0, 5);
      student.weakSubjects   = insights.weak.map(s => s.name).slice(0, 5);
    }

    student.consistencyScore = consistencyScore;
    await student.save();

    res.json({
      success: true,
      data: {
        student:    { id: student._id, name: student.name },
        prediction: predictionRecord,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/predict/:studentId/history ───
router.get('/:studentId/history', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId).select('name studentId predictions');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const sorted = [...student.predictions].sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
    res.json({ success: true, count: sorted.length, data: sorted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/predict/:studentId/history ───
router.delete('/:studentId/history', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    
    // Check permission
    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    student.predictions = [];
    await student.save();
    res.json({ success: true, message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/predict/:studentId/history/:predictionId ───
router.delete('/:studentId/history/:predictionId', async (req, res) => {
  try {
    const student = await Student.findById(req.params.studentId);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Check permission
    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { predictionId } = req.params;
    student.predictions = student.predictions.filter(p => String(p._id) !== String(predictionId));
    await student.save();
    
    res.json({ success: true, message: 'Prediction removed' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
