import { NextRequest, NextResponse } from "next/server";
import { verifyApiRequest, getUserById } from "@/lib/auth";
import { chatWithReasoning, sanitizeInput } from "@/lib/ai";

interface ReasoningMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning_details?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    console.log("[Analyze] Starting conversation...");
    
    const verification = verifyApiRequest(request);
    
    if (!verification.valid || !verification.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { task, conversation = [] } = body as { 
      task: string; 
      conversation?: ReasoningMessage[];
    };

    const user = await getUserById(verification.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task is required" }, { status: 400 });
    }
    
    console.log("[Analyze] Task:", task.substring(0, 50) + "...");
    
    const sanitizedTask = sanitizeInput(task);

    // Calculate conversation turn
    const turnCount = conversation.filter(m => m.role === 'user').length;

    const systemPrompt = `You are a friendly, conversational AI assistant helping users create the perfect prompt. 

IMPORTANT: You are NOT just asking questions - you are having a NATURAL CONVERSATION to understand what the user needs.

Your personality:
- Warm, friendly, and engaging
- Curious and genuinely interested in helping
- Explain WHY you're asking something when relevant
- Feel free to share relevant insights or suggestions
- Make the user feel like they're chatting with a helpful expert

Current task: "${sanitizedTask}"
Conversation turn: ${turnCount + 1}

${conversation.length > 0 ? 'Continue the conversation naturally based on the previous context.' : 'Start by greeting the user and acknowledging their task.'}

Your goal is to understand:
- What exactly they want to achieve
- Who the audience is
- What tone/style they prefer
- Any specific requirements or constraints
- Format and length preferences

GUIDELINES:
1. Be conversational - use natural language, not robotic questions
2. Ask 1-2 questions at a time maximum
3. Explain WHY you're asking when it helps context
4. Share quick tips or suggestions when relevant
5. After 4-6 exchanges, set readyToGenerate to true

**MARKDOWN FORMATTING for your message:**
- Use **bold** for emphasis
- Use ### for small headers
- Use - for bullet lists
- Use > for tips/quotes
- Add emojis where appropriate 🚀 💡 ✨

RESPONSE FORMAT - Return valid JSON:
{
  "message": "Your conversational message with **markdown** formatting",
  "questions": ["question1"],
  "questionReasons": ["why I'm asking this"],
  "readyToGenerate": false
}

IMPORTANT: Set "readyToGenerate" to true after 4-6 conversation turns when you have enough information.`;

    console.log("[Analyze] Calling AI with reasoning...");
    
    const conversationWithContext: ReasoningMessage[] = [
      { role: 'user', content: systemPrompt }
    ];
    
    if (conversation.length > 0) {
      conversationWithContext.push(...conversation);
    } else {
      conversationWithContext.push({ role: 'user', content: `I want to: ${sanitizedTask}` });
    }
    
    const result = await chatWithReasoning(
      conversationWithContext.slice(0, -1),
      conversationWithContext[conversationWithContext.length - 1].content,
      { userId: verification.userId, userPlan: "client" }
    );

    let parsedResult;
    try {
      const jsonMatch = result.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("[Analyze] Failed to parse AI response:", parseError);
      parsedResult = {
        message: result.content,
        questions: [],
        questionReasons: [],
        readyToGenerate: false
      };
    }

    const finalResult = {
      message: parsedResult.message || result.content,
      questions: Array.isArray(parsedResult.questions) ? parsedResult.questions : [],
      questionReasons: Array.isArray(parsedResult.questionReasons) ? parsedResult.questionReasons : [],
      readyToGenerate: Boolean(parsedResult.readyToGenerate),
      reasoning_details: result.reasoning_details,
    };

    console.log("[Analyze] Ready to generate:", finalResult.readyToGenerate);
    return NextResponse.json(finalResult);
    
  } catch (error) { 
    console.error("[Analyze] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze";
    return NextResponse.json({ error: errorMessage }, { status: 500 }); 
  }
}
