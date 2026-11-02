const mongoose = require('mongoose');

const receptionistSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    employeeId: { type: String, required: true, unique: true, trim: true },
    assignedDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    joiningDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Receptionist', receptionistSchema);
