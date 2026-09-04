import mongoose from "mongoose";

const quotationSchema = new mongoose.Schema({
  // Client / quotation data
  clientName: { type: String, required: true },
  clientEmail: String,
  products: [
    {
      productId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Product",
        required: false 
      },
      sku: { type: String, default: '' },
      category: { type: String, default: '' },
      quantity: { type: Number, default: 1 },
      unitPrice: { type: Number, default: 0 },
      totalPrice: { type: Number, default: 0 },
      watt: { type: mongoose.Schema.Types.Mixed },
      lumen: { type: String },
      beamAngle: { type: String },
      ipRating: { type: String },
      cct: { type: String },
      dimming: { type: String },
      accessories: { type: String },
      finish: { type: String },
      reflectorFinish: { type: String },
      dimension: { type: String },
      isDriver: { type: Boolean, default: false },
      driverName: { type: String },
      driverWattage: { type: String },
      itemCode: { type: String },
    },
  ],
  totalPrice: Number,
  pdfUrl: String,

  // Quotation identifier generated during creation (e.g. QL/PLD/BH/251223/025)
  quotationNumber: { type: String, required: true },

  // Snapshot of user registration info at time of quotation creation
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userName: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  userRole: { type: String, default: '' },
  userDepartment: { type: String, default: '' },
  userCountry: { type: String, default: '' },
  userMobile: { type: String, default: '' },
  userCompanyName: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },

});

delete mongoose.models['Quotation'];
export default mongoose.model("Quotation", quotationSchema);
