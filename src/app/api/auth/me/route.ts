import { NextResponse } from "next/server";
import { getCurrentUser, getUsageInfo } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null });
    
    const usage = await getUsageInfo(user._id.toString());
    
    return NextResponse.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        totalPromptsGenerated: user.totalPromptsGenerated || 0,
      },
      usage,
    });
  } catch (error) {
    console.error("Auth/me error:", error);
    return NextResponse.json({ user: null });
  }
}
