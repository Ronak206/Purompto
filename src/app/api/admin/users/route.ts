import { NextRequest, NextResponse } from "next/server";
import { connectDB, UserModel } from "@/lib/mongodb";
import { hashPassword } from "@/lib/auth";

// Admin secret for creating users (set this in your .env)
const ADMIN_SECRET = process.env.ADMIN_SECRET || "your-admin-secret-key";

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { email, password, name, adminSecret } = await request.json();
    
    // Check admin secret - only admin can create users
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    
    // Check if user already exists
    if (await (UserModel as any).findOne({ email: email.toLowerCase() })) {
      return NextResponse.json({ error: "Email already registered" }, { status: 400 });
    }
    
    // Create user
    const user = await (UserModel as any).create({
      email: email.toLowerCase(),
      password: await hashPassword(password),
      name: name || null,
      isActive: true,
      createdByAdmin: true,
    });
    
    return NextResponse.json({
      success: true,
      message: "User created successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    console.error("Admin create user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// List all users (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const adminSecret = searchParams.get("adminSecret");
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    await connectDB();
    
    const users = await (UserModel as any).find({})
      .select("-password")
      .sort({ createdAt: -1 });
    
    return NextResponse.json({
      success: true,
      users: users.map((u: any) => ({
        id: u._id,
        email: u.email,
        name: u.name,
        isActive: u.isActive,
        notes: u.notes,
        createdByAdmin: u.createdByAdmin,
        totalPromptsGenerated: u.totalPromptsGenerated || 0,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    console.error("Admin list users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Update user (admin only)
export async function PUT(request: NextRequest) {
  try {
    await connectDB();
    const { userId, isActive, notes, password, name, adminSecret } = await request.json();
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    
    const updateData: any = {};
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    if (notes !== undefined) updateData.notes = notes;
    if (name !== undefined) updateData.name = name;
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      updateData.password = await hashPassword(password);
    }
    
    const user = await (UserModel as any).findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    ).select("-password");
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    return NextResponse.json({
      success: true,
      message: "User updated successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        notes: user.notes,
      },
    });
  } catch (error) {
    console.error("Admin update user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Delete user (admin only)
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const adminSecret = searchParams.get("adminSecret");
    
    if (adminSecret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }
    
    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    
    await (UserModel as any).findByIdAndDelete(userId);
    
    return NextResponse.json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete user error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
