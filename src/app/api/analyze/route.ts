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
    console.log("[Analyze] Starting...");
    
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

    const systemPrompt = `You are a Prompt Generator. Your ONLY purpose is to create prompts for users.

TASK: "${sanitizedTask}"
Turn: ${turnCount + 1}

CRITICAL RULE - HANDLE GREETINGS/CHAT ATTEMPTS:
If the user is greeting you, trying to chat, or not asking for a prompt, respond with:
"I'm a prompt generation tool, not a chat assistant. I can help you create prompts for:
- Blog posts, articles, emails
- Marketing copy, social media content
- Code, technical documentation
- Business documents, reports
- Creative writing, stories
- And much more!

What type of prompt do you need?"

Then set readyToGenerate: false and questions: [].

GREETINGS/CHAT EXAMPLES TO REJECT:
- "Hi", "Hello", "Hey"
- "How are you?", "What's up?"
- "Can we talk?", "Let's chat"
- "Help me with something" (without specifying what)
- Any general conversation attempt

IF USER WANTS A PROMPT:
- Ask targeted clarifying questions based on THEIR specific request
- If anything is unclear, ask for clarification
- After 2-3 rounds of clear answers, set readyToGenerate: true

QUESTION RULES FOR VALID PROMPT REQUESTS:
- Ask 1-3 questions per turn based on what's still unclear
- Questions MUST be relevant to the specific task
- Focus on: purpose, audience, tone, format, length, style

RESPONSE FORMAT (JSON only):
{
  "message": "Your response - either rejection message for chat OR acknowledgment + questions for prompt requests",
  "questions": ["Question 1?", "Question 2?"],
  "questionReasons": ["Why this matters"],
  "readyToGenerate": false
}

Remember: You ONLY generate prompts. Redirect any chat attempts to ask for a prompt.`;

    console.log("[Analyze] Calling AI...");
    
    const conversationWithContext: ReasoningMessage[] = [
      { role: 'user', content: systemPrompt }
    ];
    
    if (conversation.length > 0) {
      conversationWithContext.push(...conversation);
    } else {
      conversationWithContext.push({ role: 'user', content: `I need a prompt for: ${sanitizedTask}` });
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
      message: parsedResult.message || "Got it.",
      questions: Array.isArray(parsedResult.questions) ? parsedResult.questions : [],
      questionReasons: Array.isArray(parsedResult.questionReasons) ? parsedResult.questionReasons : [],
      readyToGenerate: Boolean(parsedResult.readyToGenerate),
    };

    console.log("[Analyze] Ready to generate:", finalResult.readyToGenerate);
    return NextResponse.json(finalResult);
    
  } catch (error) { 
    console.error("[Analyze] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to analyze";
    return NextResponse.json({ error: errorMessage }, { status: 500 }); 
  }
}
