import { NextRequest, NextResponse } from "next/server";
import { connectDB, UserModel, ChatModel } from "@/lib/mongodb";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "your-admin-secret-key";

// Get all prompts (admin only) - fetches from chats with results
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get("adminSecret");
    const userId = searchParams.get("userId"); // Optional filter by user
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    await connectDB();
    
    // Fetch chats that have a result (generated prompts)
    const query: any = { result: { $exists: true, $ne: "" } };
    if (userId) query.userId = userId;
    
    const chats = await (ChatModel as any).find(query)
      .populate("userId", "email name")
      .sort({ updatedAt: -1 })
      .limit(100);
    
    return NextResponse.json({
      success: true,
      prompts: chats.map((chat: any) => ({
        id: chat._id,
        chatId: chat.chatId,
        userId: chat.userId?._id,
        userEmail: chat.userId?.email,
        userName: chat.userId?.name,
        title: chat.title,
        task: chat.title, // Use title as task
        result: chat.result,
        summary: chat.summary || "",
        status: chat.status,
        messageCount: chat.messages?.length || 0,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Admin list prompts error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete a prompt (deletes the chat's result)
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");
    const adminSecret = searchParams.get("adminSecret");
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
    }
    
    // Clear the result from the chat
    await (ChatModel as any).findByIdAndUpdate(chatId, { 
      result: "", 
      summary: "",
      status: "active" 
    });
    
    return NextResponse.json({
      success: true,
      message: "Prompt cleared successfully",
    });
  } catch (error) {
    console.error("Admin delete prompt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
