import { NextRequest, NextResponse } from "next/server";
import { verifyApiRequest, getUserById, trackUsage } from "@/lib/auth";
import { connectDB, PromptModel } from "@/lib/mongodb";
import { generateWithAI, sanitizeInput } from "@/lib/ai";

export async function POST(request: NextRequest) {
  try {
    const verification = verifyApiRequest(request);

    if (!verification.valid || !verification.userId) {
      return NextResponse.json(
        { error: `Unauthorized - ${verification.error || "Invalid request"}` },
        { status: 401 }
      );
    }

    const user = await getUserById(verification.userId);
    if (!user) {
      return NextResponse.json({ error: "User not found or account disabled" }, { status: 404 });
    }

    const body = await request.json();
    const { task, questions, answers } = body;

    if (!task || !questions || !answers) {
      return NextResponse.json(
        { error: "Task, questions, and answers are required" },
        { status: 400 }
      );
    }

    // Sanitize all inputs for security
    const sanitizedTask = sanitizeInput(task);
    
    // Build context from Q&A with sanitization
    const qaContext = questions.map((q: string, i: number) => ({
      question: sanitizeInput(q),
      answer: sanitizeInput(answers[i] || "Not specified"),
    }));

    // Generate prompt
    const generatedPrompt = await generateWithAI(
      `You are an expert prompt engineer. Create a comprehensive, well-structured prompt based on:

Task: ${sanitizedTask}

Context:
${qaContext.map((qa: { question: string; answer: string }) => `Q: ${qa.question}\nA: ${qa.answer}`).join("\n\n")}

IMPORTANT: Return ONLY plain text. Do NOT use any markdown formatting like **bold**, *italic*, #headers, - lists, or code blocks. Just write normal sentences and paragraphs. Use line breaks for separation.`,
      {
        userId: verification.userId,
        userPlan: "client",
      }
    );

    // Save to MongoDB
    await connectDB();
    const promptDoc = await (PromptModel as any).create({
      userId: user._id,
      task: sanitizedTask,
      questions: JSON.stringify(questions),
      answers: JSON.stringify(answers),
      result: generatedPrompt,
      questionCount: questions.length,
    });

    // Track usage
    await trackUsage(verification.userId);

    return NextResponse.json({
      success: true,
      prompt: generatedPrompt,
      promptId: promptDoc._id,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate prompt. Please try again." },
      { status: 500 }
    );
  }
}
