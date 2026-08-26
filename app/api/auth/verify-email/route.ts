import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';

export async function GET(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    
    if (!token) {
      return NextResponse.redirect(
        new URL('/login?error=invalid-token', req.url)
      );
    }
    
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: new Date() }
    });
    
    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=expired-token', req.url)
      );
    }
    
    await User.findByIdAndUpdate(user._id, {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    });
    
    return NextResponse.redirect(
      new URL('/login?verified=true', req.url)
    );
  } catch (error) {
    return NextResponse.redirect(
      new URL('/login?error=server-error', req.url)
    );
  }
}
