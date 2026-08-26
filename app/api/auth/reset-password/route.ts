import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { token, password } = await req.json();
    
    const resetToken = await PasswordResetToken.findOne({ 
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });
    
    if (!resetToken) {
      return NextResponse.json({ 
        error: 'Invalid or expired reset link.' 
      }, { status: 400 });
    }
    
    const hashedPassword = await bcrypt.hash(password, 12);
    
    await User.findByIdAndUpdate(resetToken.userId, { 
      password: hashedPassword 
    });
    
    await PasswordResetToken.findByIdAndUpdate(resetToken._id, { 
      used: true 
    });
    
    return NextResponse.json({ 
      message: 'Password reset successfully!' 
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
