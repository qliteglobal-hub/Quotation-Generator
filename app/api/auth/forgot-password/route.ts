import { NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '@/lib/mongodb';
import User from '@/lib/models/User';
import PasswordResetToken from '@/lib/models/PasswordResetToken';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email } = await req.json();
    
    const user = await User.findOne({ email });
    
    // Always return success (security - don't reveal if email exists)
    if (!user) {
      return NextResponse.json({ 
        message: 'If this email exists, a reset link has been sent.' 
      });
    }
    
    // Delete old tokens
    await PasswordResetToken.deleteMany({ userId: user._id });
    
    // Create new token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await PasswordResetToken.create({
      userId: user._id,
      token,
      expiresAt,
      used: false
    });
    
    const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
    
    await resend.emails.send({
      from: 'Qlite <support@quotation.qrpixeldesign.com>',
      to: email,
      subject: 'Reset Your Password — Qlite',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p>You requested a password reset for your Qlite account.</p>
          <p>Click the button below to reset your password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" 
             style="display: inline-block; background: #2563eb; color: white; 
                    padding: 12px 24px; border-radius: 8px; text-decoration: none;
                    font-weight: bold; margin: 16px 0;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 12px;">
            If you didn't request this, ignore this email.
          </p>
        </div>
      `
    });
    
    return NextResponse.json({ 
      message: 'If this email exists, a reset link has been sent.' 
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
