import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/lib/models/Quotation";
import { requireAdmin } from "@/lib/auth-helpers";

// GET /api/admin/quotations
// Returns a minimal list of quotations for the admin panel:
// quotationNumber, userName, userRole, createdAt
export async function GET(req: Request) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }
  if (authCheck.session.user.email !== "admin@qlite.com") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }

  try {
    await dbConnect();

    const quotations = await Quotation.find({}, {
      quotationNumber: 1,
      userName: 1,
      userRole: 1,
      createdAt: 1,
      status: 1,
    })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(quotations, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching admin quotations:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch quotations" },
      { status: 500 }
    );
  }
}

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
    const { id } = await req.json();
    await Quotation.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
