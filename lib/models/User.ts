import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Basic identity
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // Professional / audit fields collected at registration
    mobile: { type: String, required: true },
    companyName: { type: String, required: true },
    department: { type: String, required: true },
    role: { type: String, required: true },
    country: { type: String, required: true },
    city: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },

    // Email Verification
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String },
    emailVerificationExpiry: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model("User", userSchema);
