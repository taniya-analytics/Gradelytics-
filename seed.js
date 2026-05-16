/**
 * seed.js — Populate MongoDB with sample students
 * Run: node seed.js
 */
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const User     = require('./models/User');
const Student  = require('./models/Student');

dotenv.config();

const users = [
  { name: 'Admin User',    email: 'admin@gradelytics.com',   password: 'admin123',   role: 'admin'   },
  { name: 'Dr. Sarah Osei',email: 'teacher@gradelytics.com', password: 'teacher123', role: 'teacher' },
  { name: 'Amara Osei',    email: 'amara@student.com',      password: 'student123', role: 'student' },
];

const students = [
  {
    studentId:   'STU-2024-001',
    name:        'Amara Osei',
    email:       'amara@student.com',
    level:       'University',
    year:        'Year 3',
    course:      'Computer Science',
    attendance:  87,
    studyHours:  6,
    previousGPA: 3.4,
    assignments: [
      { title: 'Data Structures Task 1', subject: 'ICT',     score: 78,  maxScore: 100 },
      { title: 'Calculus Problem Set',   subject: 'Math',    score: 65,  maxScore: 100 },
      { title: 'Lab Report 1',           subject: 'Science', score: 82,  maxScore: 100 },
    ],
    grades: [
      { semester: '2023-S1', gpa: 3.2, subjects: [
          { subject: 'Math', score: 65 }, { subject: 'Science', score: 80 },
          { subject: 'English', score: 58 }, { subject: 'ICT', score: 88 },
        ]
      },
      { semester: '2023-S2', gpa: 3.4, subjects: [
          { subject: 'Math', score: 70 }, { subject: 'Science', score: 85 },
          { subject: 'English', score: 60 }, { subject: 'ICT', score: 90 },
        ]
      },
    ],
  },
  {
    studentId:   'STU-2024-002',
    name:        'Lian Mei',
    email:       'lian@student.com',
    level:       'High School',
    year:        'Grade 11',
    course:      'Science Stream',
    attendance:  94,
    studyHours:  8,
    previousGPA: 3.8,
    assignments: [
      { title: 'Physics Assignment 1', subject: 'Science', score: 92, maxScore: 100 },
      { title: 'Algebra Test',         subject: 'Math',    score: 95, maxScore: 100 },
    ],
    grades: [
      { semester: '2023-S1', gpa: 3.7, subjects: [
          { subject: 'Math', score: 88 }, { subject: 'Science', score: 91 },
          { subject: 'English', score: 82 }, { subject: 'ICT', score: 93 },
        ]
      },
    ],
  },
  {
    studentId:   'STU-2024-003',
    name:        'Kofi Mensah',
    email:       'kofi@student.com',
    level:       'Primary',
    year:        'Grade 6',
    course:      'General Education',
    attendance:  65,
    studyHours:  3,
    previousGPA: 2.1,
    assignments: [
      { title: 'English Composition', subject: 'English', score: 48, maxScore: 100 },
      { title: 'Number Work',         subject: 'Math',    score: 42, maxScore: 100 },
    ],
    grades: [
      { semester: '2023-S1', gpa: 2.0, subjects: [
          { subject: 'Math', score: 40 }, { subject: 'Science', score: 55 },
          { subject: 'English', score: 50 }, { subject: 'ICT', score: 45 },
        ]
      },
    ],
  },
  {
    studentId:   'STU-2024-004',
    name:        'Priya Nair',
    email:       'priya@student.com',
    level:       'University',
    year:        'Year 2',
    course:      'Business Administration',
    attendance:  79,
    studyHours:  5,
    previousGPA: 2.9,
    assignments: [
      { title: 'Business Case Study', subject: 'History',  score: 70, maxScore: 100 },
      { title: 'Statistics Module 1', subject: 'Math',     score: 64, maxScore: 100 },
    ],
    grades: [
      { semester: '2023-S1', gpa: 2.8, subjects: [
          { subject: 'Math', score: 60 }, { subject: 'Science', score: 68 },
          { subject: 'English', score: 76 }, { subject: 'History', score: 55 },
        ]
      },
    ],
  },
];

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing
    await User.deleteMany({});
    await Student.deleteMany({});
    console.log('🗑️  Cleared existing data');

    // Insert users
    const createdUsers = await User.create(users);
    console.log(`👤 Created ${createdUsers.length} users`);

    // Find teacher to assign as creator
    const teacher = createdUsers.find(u => u.role === 'teacher');

    // Link student user IDs
    for (const s of students) {
      const matchUser = createdUsers.find(u => u.email === s.email);
      if (matchUser) s.userId = matchUser._id;
      s.createdBy = teacher._id;
    }

    const createdStudents = await Student.create(students);
    console.log(`🎓 Created ${createdStudents.length} students`);

    console.log('\n─────────────────────────────────────');
    console.log('✅ Seed complete! Login credentials:');
    console.log('   Admin:   admin@gradelytics.com   / admin123');
    console.log('   Teacher: teacher@gradelytics.com / teacher123');
    console.log('   Student: amara@student.com      / student123');
    console.log('─────────────────────────────────────\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
};

seed();
