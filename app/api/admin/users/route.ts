import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/lib/models/User";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin" || session.user?.email !== "admin@qlite.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const users = await User.find({}, {
      name: 1, email: 1, companyName: 1, country: 1, city: 1, role: 1, status: 1, createdAt: 1
    }).sort({ createdAt: -1 });
    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== "admin" || session.user?.email !== "admin@qlite.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, status, role } = await req.json();
    if (!userId || (!status && !role)) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    await dbConnect();
    
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    if (targetUser.email === "admin@qlite.com") {
      return NextResponse.json({ error: "Cannot modify the primary admin account" }, { status: 403 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (role) updateData.role = role;

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
