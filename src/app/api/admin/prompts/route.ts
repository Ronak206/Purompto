import { NextRequest, NextResponse } from "next/server";
import { connectDB, UserModel, PromptModel } from "@/lib/mongodb";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "your-admin-secret-key";

// Get all prompts (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get("adminSecret");
    const userId = searchParams.get("userId"); // Optional filter by user
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    await connectDB();
    
    const query = userId ? { userId } : {};
    const prompts = await (PromptModel as any).find(query)
      .populate("userId", "email name")
      .sort({ createdAt: -1 })
      .limit(100);
    
    return NextResponse.json({
      success: true,
      prompts: prompts.map((p: any) => ({
        id: p._id,
        userId: p.userId?._id,
        userEmail: p.userId?.email,
        userName: p.userId?.name,
        task: p.task,
        questions: p.questions ? JSON.parse(p.questions) : [],
        answers: p.answers ? JSON.parse(p.answers) : {},
        result: p.result,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin list prompts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a prompt (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const promptId = searchParams.get("promptId");
    const adminSecret = searchParams.get("adminSecret");
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    if (!promptId) {
      return NextResponse.json({ error: "Prompt ID required" }, { status: 400 });
    }
    
    await (PromptModel as any).findByIdAndDelete(promptId);
    
    return NextResponse.json({
      success: true,
      message: "Prompt deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete prompt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
