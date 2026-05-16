// models/Student.js — Extended Schema (Full Upgrade)
const mongoose = require('mongoose');

// ── Sub-schemas ───────────────────────────

const TestSchema = new mongoose.Schema({
  testName:   { type: String, required: true },
  score:      { type: Number, required: true, min: 0 },
  maxScore:   { type: Number, required: true },
  date:       { type: Date, default: Date.now },
}, { _id: false });

const SubjectSchema = new mongoose.Schema({
  subjectName:  { type: String, required: true },
  tests:        [TestSchema],
  assignments:  [{
    title:    { type: String, required: true },
    score:    { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true },
    submittedAt: { type: Date, default: Date.now },
  }],
  marks:        { type: Number, min: 0, max: 100 },   // direct subject mark
  grade:        { type: String },                       // A, B, C, D, F
});

const SemesterSchema = new mongoose.Schema({
  semesterLabel: { type: String, required: true },
  cgpa:          { type: Number, min: 0, max: 10 },
  tgpa:          { type: Number, min: 0, max: 10 },
  subjects:      [SubjectSchema],
  recordedAt:    { type: Date, default: Date.now },
}, { _id: false });

const PredictionSchema = new mongoose.Schema({
  predictedFinalScore: { type: Number },
  passProbability:     { type: Number },
  dropoutRisk:         { type: Number },
  riskLevel:           { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
  trend:               { type: String, enum: ['Improving', 'Declining', 'Stable'], default: 'Stable' },
  consistencyScore:    { type: Number },
  confidence:          { type: Number },
  recommendations: [
    {
      subject:  { type: String },
      tip:      { type: String },
      priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
    },
  ],
  featuresUsed: { type: Object },
  generatedAt:  { type: Date, default: Date.now },
});

// ── Connection Request sub-schema ─────────
const ConnectionSchema = new mongoose.Schema({
  teacherId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  teacherName: { type: String },
  teacherUniqueId: { type: String },
  status:      { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  requestedAt: { type: Date, default: Date.now },
  resolvedAt:  { type: Date },
});

// ── Main Student Schema ───────────────────

const StudentSchema = new mongoose.Schema(
  {
    // Link to User account
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    // Identity
    studentId:  { type: String, required: true, unique: true },
    name:       { type: String, required: true, trim: true },
    email:      { type: String, lowercase: true },

    // Academic level
    level:      { type: String, enum: ['School', 'University', 'Vocational', 'Other'], required: true },
    degreeType: { type: String, enum: ['N/A', 'Graduation', 'Postgraduation', 'PhD', 'Diploma', 'Certificate', 'Other'], default: 'N/A' },
    year:       { type: String, required: true },
    course:     { type: String },
    enrolledAt: { type: Date, default: Date.now },

    // ── Core Academic Metrics ──────────────────────
    attendance:         { type: Number, min: 0, max: 100, default: 0 },
    totalClasses:       { type: Number, default: 0 },
    attendedClasses:    { type: Number, default: 0 },
    missedClasses:      { type: Number, default: 0 },
    lateSubmissions:    { type: Number, default: 0 },
    studyHours:         { type: Number, min: 0, default: 0 },          // daily average
    cgpa:               { type: Number, min: 0, max: 10, default: 0 },
    previousGPA:        { type: Number, min: 0, max: 10, default: 0 },

    // ── Marks per Subject (flat) ───────────────────
    subjectMarks: [{
      subject: { type: String },
      marks:   { type: Number, min: 0, max: 100 },
    }],

    // ── Study Behavior ────────────────────────────
    studyHoursPerSubject: [{
      subject:    { type: String },
      hoursPerWeek: { type: Number },
    }],
    consistencyScore:   { type: Number, min: 0, max: 100, default: 0 }, // variance-based

    // ── Strength Analysis ─────────────────────────
    strongSubjects:   [{ type: String }],
    weakSubjects:     [{ type: String }],
    improvementRate:  { type: Number, default: 0 },  // % change over last 2 semesters

    // ── Lifestyle Factors (new) ───────────────────
    lifestyle: {
      sleepHours:   { type: Number, min: 0, max: 24, default: 7 },   // avg hrs/night
      stressLevel:  { type: Number, min: 1, max: 10, default: 5 },   // 1=low, 10=high
      screenTime:   { type: Number, min: 0, default: 3 },            // hrs/day non-study
    },

    // ── Socio-economic Factors (new) ──────────────
    socioeconomic: {
      resourceAccess:       { type: Number, min: 1, max: 5, default: 3 },  // 1=very poor, 5=excellent
      studyEnvironment:     { type: Number, min: 1, max: 5, default: 3 },  // 1=very poor, 5=excellent
      internetAccess:       { type: Boolean, default: true },
      hasDevices:           { type: Boolean, default: true },
    },

    // ── Detailed academic records per semester ─────
    semesters:   [SemesterSchema],

    // ── Legacy flat assignments ────────────────────
    assignments: [{
      title:       { type: String, required: true },
      subject:     { type: String, required: true },
      score:       { type: Number, required: true, min: 0 },
      maxScore:    { type: Number, required: true },
      submittedAt: { type: Date, default: Date.now },
    }],

    // ── AI Prediction history ──────────────────────
    predictions: [PredictionSchema],

    // ── Student-to-Admin Inquiries (NEW) ─────────
    inquiries: [{
      question: { type: String, required: true },
      answer:   { type: String },
      status:   { type: String, enum: ['pending', 'replied'], default: 'pending' },
      createdAt: { type: Date, default: Date.now },
      repliedAt: { type: Date },
    }],

    // ── Connection system ──────────────────────────
    connections: [ConnectionSchema],

    // Added by
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Virtuals ──────────────────────────────

StudentSchema.virtual('assignmentAvg').get(function () {
  if (!this.assignments || this.assignments.length === 0) return 0;
  const total = this.assignments.reduce(
    (sum, a) => sum + (a.score / a.maxScore) * 100, 0
  );
  return Math.round(total / this.assignments.length);
});

StudentSchema.virtual('latestPrediction').get(function () {
  if (!this.predictions || this.predictions.length === 0) return null;
  return this.predictions[this.predictions.length - 1];
});

// Compute strong / weak subjects from semesters
StudentSchema.virtual('subjectInsights').get(function () {
  const subjectScores = {};
  for (const sem of (this.semesters || [])) {
    for (const subj of (sem.subjects || [])) {
      if (!subjectScores[subj.subjectName]) subjectScores[subj.subjectName] = [];
      const tests = subj.tests || [];
      if (tests.length > 0) {
        const avg = tests.reduce((s, t) => s + (t.score / t.maxScore * 100), 0) / tests.length;
        subjectScores[subj.subjectName].push(avg);
      }
    }
  }
  const results = Object.entries(subjectScores).map(([name, scores]) => ({
    name,
    avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
  }));
  return {
    strong: results.filter(s => s.avg >= 70).sort((a, b) => b.avg - a.avg),
    weak:   results.filter(s => s.avg <  70).sort((a, b) => a.avg - b.avg),
    all:    results.sort((a, b) => b.avg - a.avg),
  };
});

// Approved connections helper
StudentSchema.virtual('approvedTeachers').get(function () {
  return (this.connections || [])
    .filter(c => c.status === 'approved')
    .map(c => c.teacherId);
});

// ── Indexes ───────────────────────────────
StudentSchema.index({ studentId: 1 });
StudentSchema.index({ level: 1 });
StudentSchema.index({ createdBy: 1 });
StudentSchema.index({ userId: 1 });
StudentSchema.index({ 'connections.teacherId': 1 });

module.exports = mongoose.model('Student', StudentSchema);
