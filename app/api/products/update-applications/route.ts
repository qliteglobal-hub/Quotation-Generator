import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Product from '@/lib/models/Product';
import { getApplicationFromIpRatings, getApplicationFromIpRating } from '@/lib/ipRatingUtils';

export async function POST(request: Request) {
  try {
    // Check if user is admin
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get all products
    const products = await Product.find({});
    
    let updatedCount = 0;
    let skippedCount = 0;
    const updateResults = [];

    for (const product of products) {
      let newApplication: string;
      
      // Determine application based on available IP rating data
      if (product.ipRatings && product.ipRatings.length > 0) {
        // New structure with individual prices
        newApplication = getApplicationFromIpRatings(product.ipRatings as any);
      } else if (product.ipRating && product.ipRating.length > 0) {
        // Legacy structure
        newApplication = getApplicationFromIpRating(product.ipRating);
      } else {
        // No IP rating data, default to Indoor
        newApplication = 'Indoor';
        skippedCount++;
        updateResults.push({
          sku: product.sku,
          oldApplication: product.application,
          newApplication,
          status: 'defaulted (no IP rating)'
        });
        continue;
      }

      // Update only if application changed
      if (product.application !== newApplication) {
        const oldApplication = product.application;
        product.application = newApplication;
        await product.save();
        
        updatedCount++;
        updateResults.push({
          sku: product.sku,
          oldApplication,
          newApplication,
          status: 'updated'
        });
      } else {
        skippedCount++;
        updateResults.push({
          sku: product.sku,
          application: product.application,
          status: 'unchanged'
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} products, skipped ${skippedCount} products`,
      totalProducts: products.length,
      updatedCount,
      skippedCount,
      results: updateResults
    });

  } catch (error) {
    console.error('Error updating applications:', error);
    return NextResponse.json(
      { error: 'Failed to update applications' },
      { status: 500 }
    );
  }
}
