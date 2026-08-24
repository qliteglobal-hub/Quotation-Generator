import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Quotation from "@/lib/models/Quotation";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authCheck = await requireAdmin(req);
  if ("error" in authCheck) {
    return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
  }
  if (authCheck.session.user.email !== "admin@qlite.com") {
    return NextResponse.json({ error: "Forbidden: Super Admin access required" }, { status: 403 });
  }
  try {
    await dbConnect();
    const { id } = await params;
    const quotation = await Quotation.findById(id).lean();
    if (!quotation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(quotation);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
