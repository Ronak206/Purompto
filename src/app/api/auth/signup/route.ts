import { NextRequest, NextResponse } from "next/server";

// Public signup is DISABLED
// Admin creates users via /api/admin/users or /admin panel
// This endpoint returns an error for public access

export async function POST(request: NextRequest) {
  return NextResponse.json({ 
    error: "Public registration is disabled. Please contact admin for access." 
  }, { status: 403 });
}
