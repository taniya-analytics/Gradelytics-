// models/User.js — User Schema (Auth)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: ['student', 'teacher', 'admin'],
      default: 'student',
    },
    // Unique display ID shown on dashboard (e.g. STU-A1B2C3D4)
    uniqueId: {
      type: String,
      unique: true,
      sparse: true,
    },
    // For teachers: list of student _ids they added manually
    managedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
    // For teachers: list of student _ids who connected via the Connect system
    connectedStudents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  },
  { timestamps: true }
);

// Generate role-prefixed uniqueId before saving new users
UserSchema.pre('save', async function (next) {
  if (this.isNew && !this.uniqueId) {
    const prefix = this.role === 'teacher' ? 'TCH' : this.role === 'admin' ? 'ADM' : 'STU';
    const rand = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.uniqueId = `${prefix}-${rand}`;
  }
  next();
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.matchPassword = async function (entered) {
  return await bcrypt.compare(entered, this.password);
};

UserSchema.methods.getSignedToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

module.exports = mongoose.model('User', UserSchema);
