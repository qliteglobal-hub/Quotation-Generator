import mongoose from 'mongoose';

const PasswordResetTokenSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
});

export default mongoose.models.PasswordResetToken || 
  mongoose.model('PasswordResetToken', PasswordResetTokenSchema);
