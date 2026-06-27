const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'İstifadəçi adı tələb olunur'],
      unique: true,
      trim: true,
      minlength: [3, 'İstifadəçi adı minimum 3 simvol olmalıdır'],
      maxlength: [30, 'İstifadəçi adı maksimum 30 simvol ola bilər'],
    },
    password: {
      type: String,
      required: [true, 'Şifrə tələb olunur'],
      minlength: [6, 'Şifrə minimum 6 simvol olmalıdır'],
      select: false,
    },
    email: {
      type: String,
      default: 'info@zootrend.az',
      lowercase: true,
      trim: true,
      match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'E-poçt formatı yanlışdır'],
    },
    fullName: {
      type: String,
      default: 'Administrator',
      trim: true,
      maxlength: [100, 'Ad maksimum 100 simvol ola bilər'],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
