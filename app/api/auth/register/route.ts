// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { Resend } from 'resend';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    await dbConnect();

    const {
      name,
      email,
      password,
      mobile,
      companyName,
      department,
      role,
      country,
      city,
    } = await req.json();

    // Validate input
    if (!name || !email || !password || !mobile || !companyName || !department || !role || !country || !city) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user (default role is "user" unless specified)
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      mobile,
      companyName,
      department,
      role: role || "user",
      country,
      city,
    });

    await newUser.save();

    const resend = new Resend(process.env.RESEND_API_KEY);
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await User.findByIdAndUpdate(newUser._id, {
      emailVerificationToken: token,
      emailVerificationExpiry: expiry,
    });
    
    const verifyUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
    
    const { data, error } = await resend.emails.send({
      from: 'Qlite <support@quotation.qrpixeldesign.com>',
      to: email,
      subject: 'Verify your email — Qlite',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
          <h2 style="color: #333;">Verify Your Email</h2>
          <p>Thank you for registering with Qlite!</p>
          <p>Click the button below to verify your email. Link expires in 24 hours.</p>
          <a href="${verifyUrl}" 
             style="display: inline-block; background: #2563eb; color: white; 
                    padding: 12px 24px; border-radius: 8px; text-decoration: none;
                    font-weight: bold; margin: 16px 0;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 12px;">
            If you didn't register, ignore this email.
          </p>
        </div>
      `
    });

    if (error) {
      console.error("Resend API Error:", error);
    } else {
      console.log("Resend API Success:", data);
    }

    return NextResponse.json(
      {
        message: "Registration successful. Please check your email to verify your account first.",
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
        },
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Registration error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
