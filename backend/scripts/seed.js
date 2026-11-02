// Creates the first administrator, default settings and starter departments.
//   npm run seed          -> admin + settings + departments
//   npm run seed:demo     -> also a demo receptionist, two doctors and one patient (for local testing only)
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');
const Doctor = require('../models/Doctor');
const Receptionist = require('../models/Receptionist');
const Patient = require('../models/Patient');
const { getSettings } = require('../services/settingsService');
const availability = require('../services/availabilityService');

const DEPARTMENTS = [
  ['General Medicine', 'Primary care and everyday illnesses.'],
  ['Cardiology', 'Heart and blood-vessel care.'],
  ['Pediatrics', 'Healthcare for infants, children and teenagers.'],
  ['Orthopedics', 'Bones, joints and sports injuries.'],
  ['Dermatology', 'Skin, hair and nail conditions.'],
  ['Gynecology', 'Women’s health and maternity care.'],
  ['Neurology', 'Brain, spine and nervous-system disorders.'],
  ['ENT', 'Ear, nose and throat.'],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await getSettings();

  const email = (process.env.ADMIN_EMAIL || 'admin@hospital.com').toLowerCase();
  if (!(await User.exists({ email }))) {
    await User.create({ name: process.env.ADMIN_NAME || 'Hospital Admin', email, password: process.env.ADMIN_PASSWORD || 'Admin@12345', role: 'admin', isVerified: true, phone: '0000000000' });
    console.log(`Admin created: ${email}`);
  } else console.log('Admin already exists');

  for (const [name, description] of DEPARTMENTS) await Department.updateOne({ name }, { $setOnInsert: { name, description, isActive: true } }, { upsert: true });
  console.log(`Departments ready (${DEPARTMENTS.length})`);

  if (process.argv.includes('--demo')) {
    const mk = async (data) => (await User.findOne({ email: data.email })) || User.create({ ...data, isVerified: true });
    const gm = await Department.findOne({ name: 'General Medicine' });
    const cardio = await Department.findOne({ name: 'Cardiology' });

    const rUser = await mk({ name: 'Riya Reception', email: 'reception@hospital.com', password: 'Demo@12345', phone: '9000000001', role: 'receptionist' });
    await Receptionist.updateOne({ user: rUser._id }, { $setOnInsert: { user: rUser._id, employeeId: 'EMP-001' } }, { upsert: true });

    const docs = [
      { name: 'Dr. Arjun Mehta', email: 'doctor1@hospital.com', dep: gm, specialization: 'General Physician', qualification: 'MBBS, MD', experience: 12, licenseNumber: 'LIC-1001', fee: 500 },
      { name: 'Dr. Sneha Rao', email: 'doctor2@hospital.com', dep: cardio, specialization: 'Cardiologist', qualification: 'MBBS, DM Cardiology', experience: 15, licenseNumber: 'LIC-1002', fee: 900 },
    ];
    for (const d of docs) {
      const u = await mk({ name: d.name, email: d.email, password: 'Demo@12345', phone: '9000000002', role: 'doctor' });
      let doc = await Doctor.findOne({ user: u._id });
      if (!doc) {
        doc = await Doctor.create({ user: u._id, department: d.dep._id, specialization: d.specialization, qualification: d.qualification, experience: d.experience, licenseNumber: d.licenseNumber, consultationFee: d.fee, biography: 'Demo doctor profile created by the seed script.', isVerified: true });
        await availability.saveAvailability(doc, { schedule: [1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({ dayOfWeek, startTime: '10:00', endTime: '14:00', slotDuration: 30, breakStart: '12:00', breakEnd: '12:30' })) });
      }
    }
    const pUser = await mk({ name: 'Demo Patient', email: 'patient@hospital.com', password: 'Demo@12345', phone: '9000000003', role: 'patient' });
    await Patient.updateOne({ user: pUser._id }, { $setOnInsert: { user: pUser._id, patientCode: 'PAT-DEMO1' } }, { upsert: true });
    console.log('Demo users ready (password Demo@12345): reception@hospital.com, doctor1@hospital.com, doctor2@hospital.com, patient@hospital.com');
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
