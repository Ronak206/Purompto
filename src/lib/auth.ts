import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { connectDB, UserModel, UsageLogModel } from "./mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "purompto-secret-key-2026";

export async function hashPassword(password: string) { return bcrypt.hash(password, 12); }
export async function verifyPassword(password: string, hash: string) { return bcrypt.compare(password, hash); }
export function generateToken(userId: string) { return jwt.sign({ userId, type: "session" }, JWT_SECRET, { expiresIn: "7d" }); }
export function verifyToken(token: string) { try { return jwt.verify(token, JWT_SECRET) as { userId: string; type?: string }; } catch { return null; } }

// Get current logged-in user from session cookie
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.userId) return null;
  await connectDB();
  
  const user = await (UserModel as any).findById(decoded.userId).select("-password");
  if (!user) return null;
  
  // Check if user is active
  if (!user.isActive) {
    return null; // User account is disabled
  }
  
  // Return user data
  return {
    ...user.toObject(),
    _id: user._id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    totalPromptsGenerated: user.totalPromptsGenerated || 0,
  };
}

// Generate API token for authenticated requests (short-lived)
export function generateApiToken(userId: string): string {
  const timestamp = Date.now();
  const randomNonce = Math.random().toString(36).substring(2, 15);
  const payload = { 
    userId, 
    timestamp, 
    nonce: randomNonce,
    type: "api" 
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

// Verify API token from Authorization header
export function verifyApiToken(authHeader: string | null): { userId: string; valid: boolean } {
  if (!authHeader) {
    return { userId: "", valid: false };
  }
  
  // Extract Bearer token
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return { userId: "", valid: false };
  }
  
  const token = parts[1];
  const decoded = verifyToken(token);
  
  if (!decoded || !decoded.userId) {
    return { userId: "", valid: false };
  }
  
  return { userId: decoded.userId, valid: true };
}

// Get user by ID for API validation
export async function getUserById(userId: string) {
  await connectDB();
  
  const user = await (UserModel as any).findById(userId).select("-password");
  if (!user) return null;
  
  // Check if user is active
  if (!user.isActive) {
    return null;
  }
  
  return {
    ...user.toObject(),
    _id: user._id,
    email: user.email,
    name: user.name,
    isActive: user.isActive,
    totalPromptsGenerated: user.totalPromptsGenerated || 0,
  };
}

// Get usage info for user (just for tracking, no limits)
export async function getUsageInfo(userId: string) {
  await connectDB();
  
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  let log = await (UsageLogModel as any).findOne({ userId, date: today });
  if (!log) {
    log = await (UsageLogModel as any).create({ userId, date: today, promptsGenerated: 0 });
  }
  
  return { 
    used: log.promptsGenerated, 
    today: log.promptsGenerated,
  };
}

// Track usage (no limits, just tracking)
export async function trackUsage(userId: string): Promise<void> {
  await connectDB();
  
  const today = new Date(); 
  today.setHours(0, 0, 0, 0);
  
  await (UsageLogModel as any).findOneAndUpdate(
    { userId, date: today }, 
    { $inc: { promptsGenerated: 1 } }, 
    { upsert: true }
  );
}

// Set auth cookie (session cookie - expires when browser closes)
export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("token", token, { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax", 
    path: "/" 
  });
}

// Clear auth cookie
export async function clearAuthCookie() { 
  const cookieStore = await cookies();
  cookieStore.set("token", "", { 
    httpOnly: true, 
    secure: process.env.NODE_ENV === "production", 
    sameSite: "lax", 
    path: "/",
    maxAge: 0 
  });
}

// Simple API verification for serverless (no in-memory stores)
export interface VerifyResult {
  valid: boolean;
  userId: string;
  error?: string;
}

// Verify API request - simplified for serverless/Vercel
export function verifyApiRequest(request: NextRequest): VerifyResult {
  // 1. Verify Authorization header
  const authHeader = request.headers.get("Authorization");
  const tokenResult = verifyApiToken(authHeader);

  if (!tokenResult.valid || !tokenResult.userId) {
    return { valid: false, userId: "", error: "Invalid or missing auth token" };
  }

  // 2. Verify X-User-Id header matches token
  const headerUserId = request.headers.get("X-User-Id");
  if (headerUserId && headerUserId !== tokenResult.userId) {
    return { valid: false, userId: "", error: "User ID mismatch" };
  }

  // 3. Basic timestamp check (prevent very old requests)
  const timestamp = request.headers.get("X-Timestamp");
  if (timestamp) {
    const timestampNum = parseInt(timestamp, 10);
    const now = Date.now();
    // Allow 5 minutes window
    if (isNaN(timestampNum) || Math.abs(now - timestampNum) > 300000) {
      return { valid: false, userId: "", error: "Request expired" };
    }
  }

  return { valid: true, userId: tokenResult.userId };
}
