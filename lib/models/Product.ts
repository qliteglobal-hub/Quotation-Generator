// lib/models/Product.ts
import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true },
    category: { type: String, required: true },
    categoryFilter: { type: String }, // Main category for filtering

    application: { type: String },

    watt: { type: mongoose.Schema.Types.Mixed },
    lumen: { type: String },
    beamAngle: { type: String },
    dimension: { type: String },
    wattageVariants: {
      type: [{
        watt: { type: mongoose.Schema.Types.Mixed, required: true },
        lumen: { type: String, default: '' },
        dimension: { type: String, default: '' },
      }],
      default: []
    },
    cct: { type: String, default: '' },
    dimming: { type: String, default: '' },
    accessories: { type: String, default: '' },
    finish: { type: String, default: '' },
    reflectorFinish: { type: String, default: '' },
    territory: { 
      type: String, 
      enum: ['India', 'Middle East', 'Both'],
      default: 'Middle East'
    },
    // IP ratings with individual prices (stored in USD): [{ rating: "IP20", price: 59.00 }, { rating: "IP30", price: 120.00 }]
    // Price is optional - can be null/0 if not yet determined
    ipRatings: { 
      type: [{ 
        rating: { type: String, required: true }, 
        price: { type: Number, required: false, default: 0 } 
      }], 
      default: [] 
    },
    // Voltage variants with individual wattage, lumen, and prices (stored in USD)
    // Example: [{ voltage: "12V DC", watt: 5, lumen: "500", price: 45.00 }, { voltage: "24V DC", watt: 5, lumen: "600", price: 48.00 }]

    // Keep legacy fields for backward compatibility during migration
    ipRating: { type: [String], default: [] },
    price: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    // File attachments stored in AWS S3
    datasheets: { type: [String], default: [] }, // URLs to datasheet PDFs
    iesFiles: { type: [String], default: [] }, // URLs to IES files
    certifications: { type: [String], default: [] }, // URLs to certification documents (general)
    bisApproval: { type: [String], default: [] }, // URLs to BIS Approval documents
    isoCertificate: { type: [String], default: [] }, // URLs to ISO Certificate documents
    productImages: { type: [String], default: [] }, // Additional product images (separate from legacy images field)
  },
  { timestamps: true }
);

// Add indexes for faster queries
ProductSchema.index({ category: 1 });
ProductSchema.index({ categoryFilter: 1 });
ProductSchema.index({ sku: 1 });
ProductSchema.index({ application: 1 });

ProductSchema.index({ watt: 1 });
ProductSchema.index({ beamAngle: 1 });
// Compound index for common filter combinations
ProductSchema.index({ category: 1, watt: 1 });
ProductSchema.index({ categoryFilter: 1, application: 1 });

// ✅ No unique constraint at all
delete mongoose.models['Product'];
export default mongoose.model("Product", ProductSchema);
