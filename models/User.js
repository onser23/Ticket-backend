const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'Ad tələb olunur'],
      minlength: [2, 'Ad minimum 2 simvol olmalıdır'],
      maxlength: [50, 'Ad maksimum 50 simvol ola bilər'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Soyad tələb olunur'],
      minlength: [2, 'Soyad minimum 2 simvol olmalıdır'],
      maxlength: [50, 'Soyad maksimum 50 simvol ola bilər'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'E-poçt tələb olunur'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'E-poçt formatı yanlışdır'],
    },
    password: {
      type: String,
      required: [true, 'Şifrə tələb olunur'],
      minlength: [6, 'Şifrə minimum 6 simvol olmalıdır'],
      select: false,
    },
    companyName: {
      type: String,
      required: [true, 'Şirkət adı tələb olunur'],
      minlength: [2, 'Şirkət adı minimum 2 simvol olmalıdır'],
      maxlength: [100, 'Şirkət adı maksimum 100 simvol ola bilər'],
      trim: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
