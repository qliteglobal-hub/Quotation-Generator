// lib/models/LedDisplay.ts
import mongoose from "mongoose";

const LedDisplaySchema = new mongoose.Schema(
  {
    // Basic Information
    sku: { type: String, required: true },
    category: { type: String },
    application: { type: String }, // Indoor/Outdoor/Rental
    ipRating: { type: String }, // e.g., "IP65"
    pixelPitch: { type: String }, // e.g., "P2.5", "P3", "P4"
    totalResolution: { type: String }, // e.g., "1920x1080"
    sqft: { type: Number }, // Square feet
    price: { type: Number, default: 0 }, // Base price in USD
    territory: { 
      type: String, 
      enum: ['India', 'Middle East', 'Both'],
      default: 'Middle East'
    },
    
    // Cabinet Material Variants (for displays with same specs but different materials)
    cabinetMaterialVariants: [{
      material: { type: String, required: true }, // Die Cast Aluminium, Aluminium, Mild Steel
      price: { type: Number, required: true }, // Price per sqm for this material variant
      cabinetWeight: { type: Number } // Cabinet weight in kg for this material variant
    }],
    
    // Module Specifications
    moduleSpecs: {
      pixelPitch: { type: String },
      pixelConfiguration: { type: String }, // e.g., "SMD2121"
      moduleResolution: { type: String }, // e.g., "64x64"
      moduleSize: { type: String }, // in mm, e.g., "320x160"
      moduleWeight: { type: Number }, // in kg
    },
    
    // Cabinet Specifications
    cabinetSpecs: {
      cabinetSize: { type: String }, // W*H in mm
      cabinetResolution: { type: String },
      moduleQuantity: { type: Number },
      pixelDensity: { type: String }, // pixels per sqm
      cabinetWeight: { type: Number }, // in kg
      cabinetArea: { type: Number }, // in sqm
      material: { type: String }, // e.g., "Die-cast Aluminum"
      maintenance: { type: String }, // Front/Rear
    },
    
    // Screen Parameters
    screenParams: {
      brightnessControl: { type: String }, // e.g., "Manual/Auto"
      whiteBalanceBrightness: { type: String }, // in nits
      colorTemperature: { type: String }, // in K
      bestViewingDistance: { type: String }, // in meters
      brightnessUniformity: { type: String }, // percentage
      colorUniformity: { type: String }, // percentage
      protectiveGrade: { type: String }, // IP rating
      viewAngle: { type: String }, // H/V degrees
      defectsRate: { type: String }, // percentage
      frameFrequency: { type: String }, // Hz
      refreshRate: { type: String }, // Hz
      inputVoltage: { type: String }, // e.g., "110-240V AC"
      maxPowerConsumption: { type: String }, // W/sqm
      avgPowerConsumption: { type: String }, // W/sqm
      lifeSpan: { type: String }, // hours
      temperatureOperating: { type: String }, // °C range
      humidityOperating: { type: String }, // % range
    },
    
    // Media
    images: { type: [String], default: [] },
    productImages: { type: [String], default: [] },
    
    // File attachments
    datasheets: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    bisApproval: { type: [String], default: [] },
    isoCertificate: { type: [String], default: [] },
  },
  { timestamps: true }
);

export default mongoose.models.LedDisplay || mongoose.model("LedDisplay", LedDisplaySchema);
