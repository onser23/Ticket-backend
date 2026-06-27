const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimetype: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
  },
  { _id: false }
);

const ticketSchema = new mongoose.Schema(
  {
    displayId: {
      type: String,
      match: /^TKT-\d{3,}$/,
    },
    title: {
      type: String,
      required: [true, 'Başlıq tələb olunur'],
      minlength: [3, 'Başlıq minimum 3 simvol olmalıdır'],
      maxlength: [150, 'Başlıq maksimum 150 simvol ola bilər'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Açıqlama tələb olunur'],
      minlength: [10, 'Açıqlama minimum 10 simvol olmalıdır'],
      maxlength: [2000, 'Açıqlama maksimum 2000 simvol ola bilər'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'resolved'],
      default: 'pending',
      required: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      required: [true, 'Prioritet tələb olunur'],
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    attachments: [attachmentSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

ticketSchema.index({ displayId: 1 });
ticketSchema.index({ companyId: 1, status: 1 });
ticketSchema.index({ createdBy: 1 });
ticketSchema.index({ status: 1, createdAt: -1 });

ticketSchema.pre('save', async function (next) {
  if (!this.isNew || this.displayId) return next();
  try {
    const count = await mongoose.model('Ticket').countDocuments();
    this.displayId = `TKT-${String(count + 1).padStart(3, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Ticket', ticketSchema);
