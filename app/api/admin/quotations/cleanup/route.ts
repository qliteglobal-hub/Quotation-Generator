import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/lib/models/Quotation";
import { requireAdmin } from "@/lib/auth-helpers";

export async function DELETE(req: Request) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }
  if (authCheck.session.user.email !== "admin@qlite.com") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }
  try {
    await dbConnect();
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
    
    const result = await Quotation.deleteMany({
      createdAt: { $lt: sixtyDaysAgo }
    });
    
    return NextResponse.json({ 
      success: true,
      deleted: result.deletedCount 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
