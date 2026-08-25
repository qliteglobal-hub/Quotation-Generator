// lib/models/LightingControl.ts
import mongoose from "mongoose";

const LightingControlSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    category: { type: String, required: true },
    // Basic product information
    productImage: { type: String }, // Main product image
    productCode: { type: String }, // Made optional since SKU serves the same purpose
    productName: { type: String, required: true }, // Product name for display
    description: { type: String },
    territory: { 
      type: String, 
      enum: ['India', 'Middle East', 'Both'],
      default: 'Middle East'
    },
    
    // Price variants based on specifications
    priceVariants: [{
      channels: { type: Number }, // Number of channels for this variant
      size: { type: String }, // Size specification for this variant
      price: { type: Number, required: true }, // Price for this variant in USD
    }],
    price: { type: Number, default: 0 }, // Base price in USD (for backward compatibility)
    images: { type: [String], default: [] },
    productImages: { type: [String], default: [] },
    
    // Control-specific fields
    controlType: { type: String }, // e.g., "Dimmer", "Switch", "Controller", "Sensor"
    protocol: { type: String }, // e.g., "DMX512", "DALI", "0-10V", "Zigbee", "WiFi"
    channels: { type: Number }, // Number of channels
    loadCapacity: { type: String }, // e.g., "500W", "1000W"
    inputVoltage: { type: String }, // e.g., "110-240V AC"
    outputVoltage: { type: String }, // e.g., "12V DC", "24V DC"
    dimmingRange: { type: String }, // e.g., "0-100%"
    mounting: { type: String }, // e.g., "Wall Mount", "DIN Rail", "Surface Mount"
    connectivity: { type: String }, // e.g., "Wireless", "Wired", "Bluetooth"
    compatibility: { type: String }, // Compatible with which systems
    ipRating: { type: String }, // e.g., "IP20", "IP44"
    application: { type: String }, // e.g., "Residential", "Commercial", "Industrial"
    
    // File attachments
    datasheets: { type: [String], default: [] },
    certifications: { type: [String], default: [] },
    bisApproval: { type: [String], default: [] },
    isoCertificate: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Delete cached model to ensure schema changes take effect
if (mongoose.models.LightingControl) {
  delete mongoose.models.LightingControl;
}

export default mongoose.model("LightingControl", LightingControlSchema);
