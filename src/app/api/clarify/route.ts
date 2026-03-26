import { NextRequest, NextResponse } from "next/server"
import { generateWithAI, sanitizeInput } from "@/lib/ai"
import { verifyApiRequest, getUserById } from "@/lib/auth"

interface QuestionAnswer {
  id: string
  question: string
  answer: string
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and security headers
    const verification = verifyApiRequest(request)
    
    if (!verification.valid || !verification.userId) {
      return NextResponse.json(
        { error: `Unauthorized - ${verification.error || "Invalid request"}` },
        { status: 401 }
      )
    }

    // Get user for context
    const user = await getUserById(verification.userId)
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { task, questions, currentAnswers } = await request.json()

    if (!task || !questions || !currentAnswers) {
      return NextResponse.json(
        { error: "Task, questions, and answers are required" },
        { status: 400 }
      )
    }

    // Sanitize all inputs for security
    const sanitizedTask = sanitizeInput(task)
    const qaText = (currentAnswers as QuestionAnswer[])
      .map((qa) => `Q: ${sanitizeInput(qa.question)}\nA: ${sanitizeInput(qa.answer)}`)
      .join("\n\n")

    const responseContent = await generateWithAI(
      `You are an expert prompt engineer reviewing a user's answers to clarifying questions about their task.

Based on the user's original task and their answers to clarifying questions, determine if you have enough information to create a comprehensive prompt, or if you need more clarification.

If you need more clarification, generate 1-2 additional specific questions.
If you have enough information, respond with exactly: "READY_TO_GENERATE"

Return your response in this exact JSON format:
{
  "status": "need_clarification" | "ready",
  "questions": [{"id": "q_extra_1", "question": "Additional question?"}] | []
}

Original task: ${sanitizedTask}

Questions and answers:
${qaText}

Do I have enough information to create a comprehensive prompt, or do I need more clarification?

Return ONLY the JSON object, no other text.`,
      {
        userId: verification.userId,
        userPlan: user.subscription.plan,
      }
    )

    // Parse the JSON response
    let result
    try {
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        result = JSON.parse(responseContent)
      }
    } catch {
      console.error("Failed to parse clarify response:", responseContent)
      // Default to ready if we can't parse
      return NextResponse.json({ status: "ready", questions: [] })
    }

    return NextResponse.json({
      status: result.status === "ready" ? "ready" : "need_clarification",
      questions: result.questions || [],
    })
  } catch (error) {
    console.error("Clarify error:", error)
    return NextResponse.json(
      { error: "An error occurred while processing answers" },
      { status: 500 }
    )
  }
}
