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
- You MUST ask clarifying questions FIRST before ever generating
- NEVER set readyToGenerate: true on turn 1 - always ask questions first
- Ask 2-4 targeted questions to understand their specific needs
- Only set readyToGenerate: true when you have COMPLETE information

STRICT INFORMATION GATHERING RULES:
You MUST collect ALL of the following before setting readyToGenerate: true:
1. PURPOSE: What is the specific goal/objective?
2. AUDIENCE: Who will read/use the output?
3. TONE: What voice/style? (formal, casual, professional, friendly, etc.)
4. FORMAT: What format? (email, blog post, social media, code, document, etc.)
5. LENGTH: How long? (word count, paragraphs, bullet points, etc.)
6. CONTEXT: Any specific background info, constraints, or requirements?

YOU MUST HEAR ANSWERS TO ALL KEY QUESTIONS BEFORE GENERATING.
- Turn 1: Ask initial clarifying questions → readyToGenerate: false
- Turn 2+: If STILL missing ANY required info → ask more questions → readyToGenerate: false
- Turn 2+: Only set readyToGenerate: true when ALL essential details are provided

DO NOT RUSH. It's better to ask one more question than generate an incomplete prompt.

QUESTION RULES FOR VALID PROMPT REQUESTS:
- Ask 2-4 questions per turn based on what's still unclear
- Questions MUST be relevant to the specific task
- Focus on: purpose, audience, tone, format, length, style, specific requirements
- Each question should have a clear reason why you need that info

RESPONSE FORMAT (JSON only):
{
  "message": "Your response acknowledging their answers and either asking more questions OR confirming you're ready",
  "questions": ["Question 1?", "Question 2?"],
  "questionReasons": ["Why this matters for the prompt"],
  "readyToGenerate": false
}

CRITICAL: Only set readyToGenerate: true when you have COMPLETE information. When in doubt, ask another question instead of generating.`;

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
