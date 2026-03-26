import { NextRequest, NextResponse } from "next/server";
import { verifyApiRequest, getUserById } from "@/lib/auth";
import { connectDB, ChatModel } from "@/lib/mongodb";
import { randomUUID } from "crypto";

// GET - Fetch user's chats
export async function GET(request: NextRequest) {
  try {
    const verification = verifyApiRequest(request);

    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ error: "Unauthorized", chats: [] }, { status: 401 });
    }

    const user = await getUserById(verification.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found", chats: [] }, { status: 404 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    // If chatId provided, fetch single chat
    if (chatId) {
      const chat = await (ChatModel as any).findOne({ 
        chatId, 
        userId: user._id 
      }).lean();

      if (!chat) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      return NextResponse.json({ chat });
    }

    // Otherwise fetch all chats (no duplicates - one chat per chatId)
    const chats = await (ChatModel as any)
      .find({ userId: user._id })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const formattedChats = chats.map((chat: any) => ({
      id: chat.chatId,
      title: chat.title || "New Chat",
      status: chat.status,
      result: chat.result || "",
      summary: chat.summary || "",
      messageCount: chat.messages?.length || 0,
      preview: chat.messages?.length > 0 
        ? chat.messages[chat.messages.length - 1].content?.substring(0, 50) + "..."
        : "",
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    }));

    return NextResponse.json({ chats: formattedChats });
  } catch (error) {
    console.error("Chat fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch chats", chats: [] }, { status: 500 });
  }
}

// POST - Create new chat or add message
export async function POST(request: NextRequest) {
  try {
    const verification = verifyApiRequest(request);

    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(verification.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { chatId, message, title, result, summary, status } = body;

    await connectDB();

    // If chatId provided, update EXISTING chat (don't create new one)
    if (chatId) {
      const updateData: Record<string, unknown> = {};

      // Add message if provided
      if (message) {
        updateData.$push = { 
          messages: {
            id: randomUUID(),
            role: message.role,
            content: message.content,
            questions: message.questions || [],
            questionReasons: message.questionReasons || [],
            createdAt: new Date(),
          }
        };
      }

      // Update title if provided
      if (title) {
        updateData.title = title;
      }

      // Update result if provided
      if (result !== undefined) {
        updateData.result = result;
      }

      // Update summary if provided
      if (summary !== undefined) {
        updateData.summary = summary;
      }

      // Update status if provided
      if (status) {
        updateData.status = status;
      }

      updateData.updatedAt = new Date();

      const updated = await (ChatModel as any).findOneAndUpdate(
        { chatId, userId: user._id },
        updateData,
        { new: true }
      );

      if (!updated) {
        return NextResponse.json({ error: "Chat not found" }, { status: 404 });
      }

      return NextResponse.json({ 
        success: true, 
        chatId: updated.chatId,
        isNew: false,
        chat: {
          id: updated.chatId,
          title: updated.title,
          messageCount: updated.messages?.length || 0,
        }
      });
    }

    // Create new chat ONLY if no chatId provided
    const newChatId = randomUUID();
    const newChat = await (ChatModel as any).create({
      chatId: newChatId,
      userId: user._id,
      title: title || "New Chat",
      messages: message ? [{
        id: randomUUID(),
        role: message.role,
        content: message.content,
        questions: message.questions || [],
        questionReasons: message.questionReasons || [],
        createdAt: new Date(),
      }] : [],
      status: "active",
    });

    console.log("[Chat] Created new chat:", newChatId);

    return NextResponse.json({ 
      success: true, 
      chatId: newChatId,
      isNew: true,
      chat: {
        id: newChatId,
        title: newChat.title,
        messageCount: newChat.messages?.length || 0,
      }
    });
  } catch (error) {
    console.error("Chat save error:", error);
    return NextResponse.json({ error: "Failed to save chat" }, { status: 500 });
  }
}

// DELETE - Delete a chat
export async function DELETE(request: NextRequest) {
  try {
    const verification = verifyApiRequest(request);

    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserById(verification.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const chatId = searchParams.get("chatId");

    if (!chatId) {
      return NextResponse.json({ error: "Chat ID required" }, { status: 400 });
    }

    await connectDB();

    await (ChatModel as any).deleteOne({ 
      chatId, 
      userId: user._id 
    });

    return NextResponse.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    console.error("Chat delete error:", error);
    return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
  }
}
