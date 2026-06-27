const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ticket',
      required: true,
      index: true,
    },
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: 'authorRole',
    },
    authorRole: {
      type: String,
      enum: ['user', 'admin'],
      required: true,
    },
    text: {
      type: String,
      required: [true, 'Şərh mətni tələb olunur'],
      minlength: [1, 'Şərh mətni boş ola bilməz'],
      maxlength: [2000, 'Şərh mətni maksimum 2000 simvol ola bilər'],
      trim: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

commentSchema.index({ ticketId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
