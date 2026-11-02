// Shared helpers for creating accounts and resolving role profiles.
const crypto = require('crypto');
const User = require('../models/User');
const Patient = require('../models/Patient');
const Doctor = require('../models/Doctor');
const Receptionist = require('../models/Receptionist');
const { AppError } = require('../utils/apiResponse');
const { uploadBuffer, isConfigured, cloudinary } = require('../config/cloudinary');

const getProfile = async (user) => {
  if (user.role === 'patient') return Patient.findOne({ user: user._id });
  if (user.role === 'doctor') return Doctor.findOne({ user: user._id }).populate('department', 'name');
  if (user.role === 'receptionist') return Receptionist.findOne({ user: user._id }).populate('assignedDepartment', 'name');
  return null;
};

const tempPassword = () => crypto.randomBytes(6).toString('base64url') + 'a1';

const assertEmailFree = async (email) => {
  if (await User.exists({ email: String(email).toLowerCase() })) throw new AppError('An account with this email already exists', 409);
};

const createPatientAccount = async ({ name, email, phone, password, isVerified = true, ...profile }) => {
  await assertEmailFree(email);
  const user = await User.create({ name, email, phone, password, role: 'patient', isVerified });
  try {
    const patient = await Patient.create({ user: user._id, ...pickPatientFields(profile) });
    return { user, patient };
  } catch (e) {
    await User.deleteOne({ _id: user._id });
    throw e;
  }
};

const pickPatientFields = (b = {}) => {
  const out = {};
  ['dateOfBirth', 'gender', 'bloodGroup', 'address', 'medicalHistory'].forEach((k) => { if (b[k] !== undefined) out[k] = b[k] === '' ? undefined : b[k]; });
  if (b.gender === '') out.gender = '';
  if (b.bloodGroup === '') out.bloodGroup = '';
  if (b.emergencyContact && typeof b.emergencyContact === 'object') {
    out.emergencyContact = { name: b.emergencyContact.name, phone: b.emergencyContact.phone, relation: b.emergencyContact.relation };
  }
  if (b.allergies !== undefined) out.allergies = Array.isArray(b.allergies) ? b.allergies : String(b.allergies).split(',').map((s) => s.trim()).filter(Boolean);
  return out;
};

// Uploads req.file (if any) to Cloudinary and replaces the user's image.
const applyProfileImage = async (user, file) => {
  if (!file) return;
  if (!isConfigured()) throw new AppError('Image uploads are not configured on the server (Cloudinary credentials missing).', 503);
  const withId = await User.findById(user._id).select('+profileImageId');
  const result = await uploadBuffer(file.buffer, 'hospital/profiles');
  if (withId.profileImageId) cloudinary.uploader.destroy(withId.profileImageId).catch(() => {});
  user.profileImage = result.secure_url;
  user.profileImageId = result.public_id;
};

module.exports = { getProfile, tempPassword, assertEmailFree, createPatientAccount, pickPatientFields, applyProfileImage };
