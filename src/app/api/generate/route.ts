import { NextRequest } from "next/server";
import { verifyApiRequest, getUserById, trackUsage } from "@/lib/auth";
import { connectDB, UserModel } from "@/lib/mongodb";
import { generateWithStreaming, sanitizeInput } from "@/lib/ai";

interface ReasoningMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning_details?: unknown;
}

export async function POST(request: NextRequest) {
  console.log("[Generate] Starting...");
  
  const verification = verifyApiRequest(request);
  
  if (!verification.valid || !verification.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const user = await getUserById(verification.userId);
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
  }

  const body = await request.json();
  const { task, conversation = [] } = body as {
    task: string;
    conversation?: ReasoningMessage[];
  };
  
  if (!task) {
    return new Response(JSON.stringify({ error: "Task is required" }), { status: 400 });
  }

  console.log("[Generate] Task:", task.substring(0, 50) + "...");

  const sanitizedTask = sanitizeInput(task);
  
  const systemPrompt = `You are an expert Prompt Engineer. Create the PERFECT prompt based on the user's request and clarifications.

USER'S REQUEST:
"${sanitizedTask}"

CLARIFICATIONS PROVIDED:
${conversation.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}

Create a comprehensive, ready-to-use prompt that:
1. Clearly states the objective
2. Provides necessary context
3. Specifies requirements and constraints
4. Defines the desired output format
5. Includes relevant style/tone guidance

**CRITICAL FORMATTING RULES:**
- Output PLAIN TEXT only - no markdown formatting
- No **bold**, no *italic*, no # headers
- No \`\`\` code blocks
- Use numbers (1. 2. 3.) for lists
- Use line breaks for sections
- The prompt must be COPY-PASTE READY

OUTPUT FORMAT (JSON):
{
  "prompt": "The complete prompt in plain text",
  "summary": "Brief one-line description",
  "tips": ["Optional usage tip"]
}`;

  const encoder = new TextEncoder();
  let fullContent = "";
  
  try {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const content = await generateWithStreaming(
            systemPrompt,
            (chunk) => {
              fullContent += chunk;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', content: chunk })}\n\n`)
              );
            }
          );
          
          let parsedResult;
          try {
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResult = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error("No JSON found");
            }
          } catch {
            parsedResult = {
              prompt: content,
              summary: "Custom prompt based on your requirements",
              tips: []
            };
          }

          const finalPrompt = parsedResult.prompt || content;
          
          // Clean any remaining markdown
          const cleanPrompt = finalPrompt
            .replace(/\*\*([^*]+)\*\*/g, '$1')
            .replace(/\*([^*]+)\*/g, '$1')
            .replace(/#{1,6}\s*/g, '')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/```[\s\S]*?```/g, '')
            .trim();

          console.log("[Generate] Prompt generated, length:", cleanPrompt.length);
          
          // Track usage
          try {
            await trackUsage(verification.userId);
          } catch (e) {
            console.error("[Generate] Failed to track usage:", e);
          }
          
          // Increment user's prompt count
          try {
            await connectDB();
            await (UserModel as any).findByIdAndUpdate(
              user._id,
              { $inc: { totalPromptsGenerated: 1 } }
            );
          } catch (e) {
            console.error("[Generate] Failed to increment count:", e);
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'complete', 
              prompt: cleanPrompt,
              summary: parsedResult.summary || "",
              tips: parsedResult.tips || []
            })}\n\n`)
          );
          
          controller.close();
        } catch (error) {
          console.error("[Generate] Stream error:", error);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ 
              type: 'error', 
              error: error instanceof Error ? error.message : "Failed to generate prompt"
            })}\n\n`)
          );
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
    
  } catch (error) { 
    console.error("[Generate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to generate prompt";
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 }); 
  }
}
