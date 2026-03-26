import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/purompto";

interface MongooseCache { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null; }
declare global { var mongooseCache: MongooseCache | undefined; }
let cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };
if (!global.mongooseCache) global.mongooseCache = cached;

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, { maxPoolSize: 10, serverSelectionTimeoutMS: 30000 })
      .then(m => { console.log("✅ MongoDB connected"); return m; })
      .catch(e => { cached.promise = null; throw e; });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

// ============================================
// USER SCHEMA - Simple client management
// ============================================
const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    name: {
      type: String,
      trim: true,
      default: null,
    },
    // Admin can enable/disable access
    isActive: {
      type: Boolean,
      default: true,
    },
    // Admin notes for this user
    notes: {
      type: String,
      default: null,
    },
    // Whether the user was created by admin
    createdByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "users",
  }
);

// ============================================
// PROMPT SCHEMA - Stores all generated prompts
// ============================================
const PromptSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    task: {
      type: String,
      default: "",
    },
    questions: {
      type: String, // JSON string of questions array
      default: "[]",
    },
    answers: {
      type: String, // JSON string of answers object
      default: "{}",
    },
    result: {
      type: String,
      default: "",
    },
    conversation: {
      type: String, // JSON string of full conversation for draft recovery
      default: "[]",
    },
    status: {
      type: String,
      enum: ["draft", "completed"],
      default: "completed",
      index: true,
    },
    questionCount: {
      type: Number,
      default: 0,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null,
    },
    feedback: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "prompts",
  }
);

// ============================================
// USAGE LOG SCHEMA - Track daily usage
// ============================================
const UsageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    promptsGenerated: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "usage_logs",
  }
);

// ============================================
// CHAT SCHEMA - Real-time chat history
// ============================================
const ChatSchema = new mongoose.Schema(
  {
    chatId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: "New Chat",
    },
    messages: {
      type: [{
        id: { type: String, required: true },
        role: { type: String, enum: ["user", "assistant"], required: true },
        content: { type: String, default: "" },
        questions: { type: [String], default: [] },
        questionReasons: { type: [String], default: [] },
        createdAt: { type: Date, default: Date.now },
      }],
      default: [],
    },
    status: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },
    result: {
      type: String,
      default: "",
    },
    summary: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
    collection: "chats",
  }
);

// Create indexes
UserSchema.index({ email: 1 }, { unique: true });
PromptSchema.index({ userId: 1, createdAt: -1 });
PromptSchema.index({ createdAt: -1 });
UsageLogSchema.index({ userId: 1, date: 1 }, { unique: true });
ChatSchema.index({ userId: 1, updatedAt: -1 });
ChatSchema.index({ chatId: 1 }, { unique: true });

export const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);
export const PromptModel = mongoose.models.Prompt || mongoose.model("Project", PromptSchema);
export const UsageLogModel = mongoose.models.UsageLog || mongoose.model("UsageLog", UsageLogSchema);
export const ChatModel = mongoose.models.Chat || mongoose.model("Chat", ChatSchema);

export default {
  User: UserModel,
  Prompt: PromptModel,
  UsageLog: UsageLogModel,
  Chat: ChatModel,
};
