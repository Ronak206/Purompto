import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
export async function GET() {
  try { await connectDB(); return NextResponse.json({ status: "ok", timestamp: new Date().toISOString(), database: "connected" }); }
  catch { return NextResponse.json({ status: "error", database: "disconnected" }, { status: 500 }); }
}
