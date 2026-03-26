import { randomUUID } from "crypto";

// Multiple API keys for fallback - try in this order
const API_KEYS = [
  process.env.OPENROUTER_API_KEY,
  process.env.OPENROUTER_API_KEY_2,
  process.env.OPENROUTER_API_KEY_1,
].filter(Boolean);

// Use StepFun model with reasoning
const MODEL = "stepfun/step-3.5-flash:free";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const SITE_NAME = "Purompto";
const REQUEST_TIMEOUT_MS = 120000; // 2 minutes for reasoning model
const MAX_PROMPT_LENGTH = 10000;

if (API_KEYS.length === 0) {
  console.warn("⚠️ No OPENROUTER_API_KEY found in environment variables");
} else {
  console.log(`✅ Found ${API_KEYS.length} OpenRouter API key(s)`);
}

function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  let sanitized = input
    .replace(/<\s*script\b[^<]*<[^>]*>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .replace(/data:/gi, "")
    .trim();

  if (sanitized.length > MAX_PROMPT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_PROMPT_LENGTH);
  }

  return sanitized;
}

interface AIOptions {
  userId?: string;
  userPlan?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ReasoningMessage {
  role: 'user' | 'assistant';
  content: string;
  reasoning_details?: unknown;
}

async function makeRequest(
  messages: ReasoningMessage[],
  apiKey: string,
  keyIndex: number
): Promise<{ content: string; reasoning_details?: unknown }> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: messages,
    reasoning: { enabled: true },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  console.log(`[AI] Using model: ${MODEL} (Key #${keyIndex + 1})`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  const data = await response.json();

  if (!response.ok) {
    const errorMsg = data.error?.message || data.error?.code || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  const message = data.choices?.[0]?.message;
  const content = message?.content || "";

  if (!content) {
    throw new Error("Empty response");
  }

  console.log(`[AI] ✅ Success with ${MODEL}`);
  
  return {
    content,
    reasoning_details: message.reasoning_details,
  };
}

// Streaming request function
async function makeStreamingRequest(
  messages: ReasoningMessage[],
  apiKey: string,
  keyIndex: number,
  onChunk: (text: string) => void
): Promise<{ content: string }> {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    model: MODEL,
    messages: messages,
    stream: true,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  console.log(`[AI] Streaming with model: ${MODEL} (Key #${keyIndex + 1})`);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const errorMsg = data.error?.message || data.error?.code || `HTTP ${response.status}`;
    throw new Error(errorMsg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let fullContent = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || "";
            if (content) {
              fullContent += content;
              onChunk(content);
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  console.log(`[AI] ✅ Streaming complete with ${MODEL}`);
  return { content: fullContent };
}

// Main generate function - simple single message
export async function generateWithAI(
  prompt: string,
  options: AIOptions = {}
): Promise<string> {
  if (API_KEYS.length === 0) {
    throw new Error("AI service not configured. Set OPENROUTER_API_KEY in environment.");
  }

  const sanitizedPrompt = sanitizeInput(prompt);
  let lastError: Error | null = null;

  for (let keyIdx = 0; keyIdx < API_KEYS.length; keyIdx++) {
    const apiKey = API_KEYS[keyIdx];
    
    if (keyIdx > 0) {
      console.log(`[AI] 🔄 Trying next API key...`);
    }
    
    try {
      const messages: ReasoningMessage[] = [{ role: 'user', content: sanitizedPrompt }];
      const result = await makeRequest(messages, apiKey!, keyIdx);
      return result.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[AI] ℹ️ Key #${keyIdx + 1} unavailable: ${lastError.message}`);
      continue;
    }
  }

  throw new Error("AI service temporarily unavailable. Please try again in a moment.");
}

// Chat with reasoning preservation - for multi-turn conversations
export async function chatWithReasoning(
  conversationHistory: ReasoningMessage[],
  newMessage: string,
  options: AIOptions = {}
): Promise<{ content: string; reasoning_details?: unknown }> {
  if (API_KEYS.length === 0) {
    throw new Error("AI service not configured. Set OPENROUTER_API_KEY in environment.");
  }

  const sanitizedMessage = sanitizeInput(newMessage);
  let lastError: Error | null = null;

  // Build messages array with reasoning_details preserved
  const messages: ReasoningMessage[] = [
    ...conversationHistory.map(msg => ({
      role: msg.role,
      content: msg.content,
      reasoning_details: msg.reasoning_details,
    })),
    { role: 'user' as const, content: sanitizedMessage }
  ];

  for (let keyIdx = 0; keyIdx < API_KEYS.length; keyIdx++) {
    const apiKey = API_KEYS[keyIdx];
    
    if (keyIdx > 0) {
      console.log(`[AI] 🔄 Trying next API key...`);
    }
    
    try {
      const result = await makeRequest(messages, apiKey!, keyIdx);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[AI] ℹ️ Key #${keyIdx + 1} unavailable: ${lastError.message}`);
      continue;
    }
  }

  throw new Error("AI service temporarily unavailable. Please try again in a moment.");
}

// Streaming generate function
export async function generateWithStreaming(
  prompt: string,
  onChunk: (text: string) => void,
  options: AIOptions = {}
): Promise<string> {
  if (API_KEYS.length === 0) {
    throw new Error("AI service not configured. Set OPENROUTER_API_KEY in environment.");
  }

  const sanitizedPrompt = sanitizeInput(prompt);
  let lastError: Error | null = null;

  const messages: ReasoningMessage[] = [{ role: 'user', content: sanitizedPrompt }];

  for (let keyIdx = 0; keyIdx < API_KEYS.length; keyIdx++) {
    const apiKey = API_KEYS[keyIdx];
    
    if (keyIdx > 0) {
      console.log(`[AI] 🔄 Trying next API key...`);
    }
    
    try {
      const result = await makeStreamingRequest(messages, apiKey!, keyIdx, onChunk);
      return result.content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.log(`[AI] ℹ️ Key #${keyIdx + 1} unavailable: ${lastError.message}`);
      continue;
    }
  }

  throw new Error("AI service temporarily unavailable. Please try again in a moment.");
}

export { sanitizeInput };
