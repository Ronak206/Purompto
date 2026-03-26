import { NextResponse } from "next/server";
import { getCurrentUser, generateApiToken } from "@/lib/auth";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate a short-lived API token for this user
    const apiToken = generateApiToken(user._id.toString());
    
    return NextResponse.json({ 
      token: apiToken,
      userId: user._id.toString(),
      expiresIn: "1h"
    });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}
