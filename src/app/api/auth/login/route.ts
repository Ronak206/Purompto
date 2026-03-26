import { NextRequest, NextResponse } from "next/server";
import { connectDB, UserModel } from "@/lib/mongodb";
import { verifyPassword, generateToken, setAuthCookie, getUsageInfo } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password } = await request.json();
    
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    
    const user = await (UserModel as any).findOne({ email: email.toLowerCase() });
    
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    if (!user.isActive) {
      return NextResponse.json({ error: "Account is disabled. Contact admin." }, { status: 403 });
    }
    
    if (!(await verifyPassword(password, user.password))) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }
    
    await setAuthCookie(generateToken(user._id.toString()));
    const usage = await getUsageInfo(user._id.toString());
    
    return NextResponse.json({
      success: true,
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
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
