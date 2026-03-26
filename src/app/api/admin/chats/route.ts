import { NextRequest, NextResponse } from "next/server";
import { connectDB, UserModel, ChatModel } from "@/lib/mongodb";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "your-admin-secret-key";

// Get all chats (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get("adminSecret");
    const userId = searchParams.get("userId"); // Optional filter by user
    const chatId = searchParams.get("chatId"); // Optional get single chat
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    await connectDB();
    
    // Get single chat by ID
    if (chatId) {
      const chat = await (ChatModel as any).findOne({ chatId })
        .populate("userId", "email name");
      
      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }
      
      return NextResponse.json({
        success: true,
        chat: {
          id: chat.chatId,
          userId: chat.userId?._id,
          userEmail: chat.userId?.email,
          userName: chat.userId?.name,
          title: chat.title || "New Chat",
          status: chat.status,
          result: chat.result || "",
          summary: chat.summary || "",
          messages: chat.messages || [],
          messageCount: chat.messages?.length || 0,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
        },
      });
    }
    
    // Get all chats or filter by user
    const query = userId ? { userId } : {};
    const chats = await (ChatModel as any).find(query)
      .populate("userId", "email name")
      .sort({ updatedAt: -1 })
      .limit(200);
    
    return NextResponse.json({
      success: true,
      chats: chats.map((chat: any) => ({
        id: chat.chatId,
        userId: chat.userId?._id,
        userEmail: chat.userId?.email,
        userName: chat.userId?.name,
        title: chat.title || "New Chat",
        status: chat.status,
        result: chat.result || "",
        summary: chat.summary || "",
        messages: chat.messages || [],
        messageCount: chat.messages?.length || 0,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Admin list chats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
