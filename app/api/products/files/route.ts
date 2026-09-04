// app/api/products/files/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import { requireAdmin, unauthorizedResponse, forbiddenResponse } from "@/lib/auth-helpers";
import { deleteFileFromS3 } from "@/lib/s3";

/**
 * Update product files (add or remove file URLs)
 */
export async function PUT(req: Request) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return authCheck.status === 401
      ? unauthorizedResponse(authCheck.error)
      : forbiddenResponse(authCheck.error);
  }

  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get("sku");
    const productId = searchParams.get("id");

    if (!sku && !productId) {
      return NextResponse.json(
        { error: "Product SKU or ID required" },
        { status: 400 }
      );
    }

    const data = await req.json();
    const { fileType, fileUrl, action } = data; // action: 'add' or 'remove'

    if (!fileType || !fileUrl || !action) {
      return NextResponse.json(
        { error: "fileType, fileUrl, and action are required" },
        { status: 400 }
      );
    }

    // Find product by SKU or ID
    const query = productId ? { _id: productId } : { sku };
    const product = await Product.findOne(query);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Determine which field to update
    let fieldName: string;
    switch (fileType) {
      case "image":
        fieldName = "productImages";
        break;
      case "datasheet":
        fieldName = "datasheets";
        break;
      case "ies":
        fieldName = "iesFiles";
        break;
      case "certification":
        fieldName = "certifications";
        break;
      case "bisApproval":
        fieldName = "bisApproval";
        break;
      case "isoCertificate":
        fieldName = "isoCertificate";
        break;
      default:
        return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const prod = product as any;
    // Initialize array if it doesn't exist
    if (!prod[fieldName]) {
      prod[fieldName] = [];
    }

    // Add or remove file URL
    if (action === "add") {
      if (!prod[fieldName].includes(fileUrl)) {
        prod[fieldName].push(fileUrl);
      }
    } else if (action === "remove") {
      prod[fieldName] = prod[fieldName].filter((url: string) => url !== fileUrl);
      
      // Optionally delete from S3 (commented out for safety - you may want to keep files)
      // try {
      //   await deleteFileFromS3(fileUrl);
      // } catch (err) {
      //   console.error("Error deleting file from S3:", err);
      // }
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'add' or 'remove'" },
        { status: 400 }
      );
    }
    await product.save();

    return NextResponse.json({
      success: true,
      product,
      message: `File ${action === "add" ? "added" : "removed"} successfully`,
    });
  } catch (err: any) {
    console.error("Error updating product files:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Get all files for a product
 */
export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const sku = searchParams.get("sku");
    const productId = searchParams.get("id");

    if (!sku && !productId) {
      return NextResponse.json(
        { error: "Product SKU or ID required" },
        { status: 400 }
      );
    }

    const query = productId ? { _id: productId } : { sku };
    const product = await Product.findOne(query);

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({
      sku: product.sku,
      files: {
        images: product.productImages || [],
        datasheets: product.datasheets || [],
        iesFiles: product.iesFiles || [],
        certifications: product.certifications || [],
        bisApproval: product.bisApproval || [],
        isoCertificate: product.isoCertificate || [],
        legacyImages: product.images || [], // Include legacy images for backward compatibility
      },
    });
  } catch (err: any) {
    console.error("Error fetching product files:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
