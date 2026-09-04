// app/api/product/route.ts
import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Product from "@/lib/models/Product";
import { requireAdmin, forbiddenResponse, unauthorizedResponse } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return authCheck.status === 401
      ? unauthorizedResponse(authCheck.error)
      : forbiddenResponse(authCheck.error);
  }

  try {
    await dbConnect();
    const data = await req.json();

    const existingProduct = await Product.findOne({ sku: data.sku });
    if (existingProduct) {
      return NextResponse.json(
        { error: `Model Number "${data.sku}" already exists.` },
        { status: 400 }
      );
    }

    // Prices are stored directly in USD (no conversion)
    // Round price to 2 decimal places for consistency
    if (data.price) {
      data.price = Math.round(Number(data.price) * 100) / 100;
    }
    // Round ipRatings prices to 2 decimal places
    if (data.ipRatings && Array.isArray(data.ipRatings)) {
      data.ipRatings = data.ipRatings.map((ip: any) => ({
        rating: ip.rating,
        price: Math.round(Number(ip.price || 0) * 100) / 100
      }));
    }


    const newProduct = new Product({
      ...data,
      images: data.images || [],
    });

    await newProduct.save();
    return NextResponse.json(newProduct, { status: 201 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const data = await req.json();
    
    // Clean up Mongoose fields to prevent update errors
    delete data._id;
    delete data.__v;
    delete data.createdAt;
    delete data.updatedAt;

    // Prices are stored in USD - round to 2 decimal places for consistency
    if (data.price) {
      data.price = Math.round(Number(data.price) * 100) / 100;
    }
    // Round ipRatings prices to 2 decimal places
    if (data.ipRatings && Array.isArray(data.ipRatings)) {
      data.ipRatings = data.ipRatings.map((ip: any) => ({
        rating: ip.rating,
        price: Math.round(Number(ip.price || 0) * 100) / 100
      }));
    }
    
    // Explicitly handle wattageVariants to ensure they save correctly
    if (data.wattageVariants && Array.isArray(data.wattageVariants)) {
      data.wattageVariants = data.wattageVariants.map((v: any) => ({
        ...v,
        watt: Number(v.watt) || 0,
        lumen: v.lumen || '',
        dimension: v.dimension || ''
      }));
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
    if (!updatedProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json(updatedProduct);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return authCheck.status === 401
      ? unauthorizedResponse(authCheck.error)
      : forbiddenResponse(authCheck.error);
  }

  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Product ID required" }, { status: 400 });

    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct) return NextResponse.json({ error: "Product not found" }, { status: 404 });

    return NextResponse.json({ message: "Product deleted successfully", product: deletedProduct });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const query: any = {};

    // Global search across selected fields
    const search = searchParams.get("search");
    if (search) {
      const rx = { $regex: search, $options: "i" };
      query.$or = [
        { sku: rx },
        { category: rx },
        { application: rx },
        { lumen: rx },
        { beamAngle: rx },
        { ipRating: { $elemMatch: { $regex: search, $options: "i" } } }, // Legacy field
        { "ipRatings.rating": { $regex: search, $options: "i" } }, // New field
      ];
    }

    // Field-specific filters (combine with global search if provided)
    const fieldFilters = [
      "sku",
      "application",
      "beamAngle",
    ];
    for (const field of fieldFilters) {
      const val = searchParams.get(field);
      if (val) {
        query[field] = { $regex: val, $options: "i" };
      }
    }
    
    // Special handling for category - search in both category and categoryFilter
    const categoryVal = searchParams.get("category");
    if (categoryVal) {
      query.$or = query.$or || [];
      query.$or.push(
        { category: { $regex: categoryVal, $options: "i" } },
        { categoryFilter: { $regex: categoryVal, $options: "i" } }
      );
    }
    
    // Special handling for ipRating (array field) - support both old and new formats
    const ipRatingFilter = searchParams.get("ipRating");
    if (ipRatingFilter) {
      query.$or = query.$or || [];
      query.$or.push(
        { ipRating: { $elemMatch: { $regex: ipRatingFilter, $options: "i" } } }, // Legacy
        { "ipRatings.rating": { $regex: ipRatingFilter, $options: "i" } } // New
      );
    }

    // Wattage range filter
    const wattMin = searchParams.get("wattMin");
    const wattMax = searchParams.get("wattMax");
    if (wattMin || wattMax) {
      query.watt = {};
      if (wattMin) query.watt.$gte = Number(wattMin);
      // Use $lt (less than) instead of $lte (less than or equal) to avoid duplicates
      if (wattMax && wattMax !== "Infinity") query.watt.$lt = Number(wattMax);
    }

    // Lumen range filter - extract numeric value from string like "1000 Lm"
    const lumenMin = searchParams.get("lumenMin");
    const lumenMax = searchParams.get("lumenMax");
    
    // Determine sort order based on filters applied
    let sortCriteria: any = { sku: 1 }; // Default sort by SKU
    
    // If watt filter is applied, sort by watt in ascending order
    if (wattMin || wattMax) {
      sortCriteria = { watt: 1 };
    }
    // If lumen filter is applied, we'll sort after filtering (since lumen is string)
    
    let products = await Product.find(query).sort(sortCriteria);

    // Client-side lumen filtering since lumen is stored as string
    if (lumenMin || lumenMax) {
      products = products.filter((product: any) => {
        if (!product.lumen) return false;
        
        // Extract numeric value from lumen string (e.g., "1000 Lm" -> 1000)
        const lumenValue = parseFloat(product.lumen.toString().replace(/[^\d.]/g, ''));
        
        if (isNaN(lumenValue)) return false;
        
        if (lumenMin && lumenValue < Number(lumenMin)) return false;
        // Use < (less than) instead of <= (less than or equal) to avoid duplicates
        if (lumenMax && lumenMax !== "Infinity" && lumenValue >= Number(lumenMax)) return false;
        
        return true;
      });
      
      // Sort by lumen value in ascending order after filtering
      products.sort((a: any, b: any) => {
        const lumenA = parseFloat(a.lumen?.toString().replace(/[^\d.]/g, '') || '0');
        const lumenB = parseFloat(b.lumen?.toString().replace(/[^\d.]/g, '') || '0');
        return lumenA - lumenB;
      });
    }

    const response = NextResponse.json(products);
    // Cache for 5 minutes, revalidate in background
    response.headers.set('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return response;
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// Enable edge runtime for faster response times
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Ensure fresh data when filters change