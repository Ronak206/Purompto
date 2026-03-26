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

    const systemPrompt = `You are a Prompt Engineer. Your ONLY job is to gather information to create the perfect prompt.

TASK: "${sanitizedTask}"
Turn: ${turnCount + 1}

YOUR ROLE:
- Analyze what the user wants to create
- Ask targeted clarifying questions based on THEIR specific request
- If anything is unclear or ambiguous, ask for clarification
- After 2-3 rounds of clear answers, set readyToGenerate: true

QUESTION RULES:
- Ask 1-3 questions per turn based on what's still unclear
- Questions MUST be relevant to the specific task
- If user's input is vague, ask them to clarify what exactly they need
- Focus on: purpose, audience, tone, format, length, style, key points to include

EXAMPLES OF GOOD CLARIFYING QUESTIONS:
For "write a blog post":
- "What's the main topic or message of this blog post?"
- "Who is your target audience?"
- "What tone should it have - informative, casual, professional?"

For "create an email":
- "What's the purpose - sales, notification, follow-up?"
- "Who will receive this email?"
- "Any specific call-to-action you want to include?"

For vague requests like "help me with content":
- "Could you clarify what type of content you need - blog, social media, email, or something else?"
- "What's the goal you're trying to achieve?"

RESPONSE FORMAT (JSON only):
{
  "message": "Brief acknowledgment of their input",
  "questions": ["Question 1?", "Question 2?"],
  "questionReasons": ["Why this matters for the prompt"],
  "readyToGenerate": false
}

IMPORTANT:
- Do NOT have casual conversation
- Do NOT greet or say things like "I'd be happy to help"
- Just acknowledge and ask relevant questions
- Set readyToGenerate: true when you have enough clear information`;

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
