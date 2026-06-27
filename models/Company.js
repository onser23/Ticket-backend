const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: [true, 'Şirkət adı tələb olunur'],
      minlength: [2, 'Şirkət adı minimum 2 simvol olmalıdır'],
      maxlength: [100, 'Şirkət adı maksimum 100 simvol ola bilər'],
      trim: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    ownerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      match: [/^[\w.+-]+@[\w-]+\.[\w.-]+$/, 'E-poçt formatı yanlışdır'],
    },
    contactPhone: {
      type: String,
      default: null,
      trim: true,
      maxlength: [30, 'Telefon maksimum 30 simvol ola bilər'],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

companySchema.index({ ownerUserId: 1 }, { unique: true });
companySchema.index({ displayName: 'text' });

module.exports = mongoose.model('Company', companySchema);
