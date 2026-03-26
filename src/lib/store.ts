import { create } from "zustand";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  type?: "question" | "answer" | "info" | "prompt";
};

export type AppState = "idle" | "analyzing" | "clarifying" | "ready" | "generating" | "generated";

export type SubscriptionTier = "free" | "pro" | "enterprise";

export interface User {
  id: string;
  email: string;
  name: string | null;
  plan: SubscriptionTier;
}

export interface PromptHistoryItem {
  id: string;
  task: string;
  prompt: string;
  createdAt: string;
}

interface PromptyStore {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;

  // App State
  appState: AppState;
  messages: Message[];
  questions: string[];
  currentQuestionIndex: number;
  answers: Record<string, string>;
  generatedPrompt: string;
  originalTask: string;
  isLoading: boolean;
  error: string | null;

  // Usage State
  promptsUsedToday: number;
  dailyLimit: number;

  // UI State
  showPricingModal: boolean;
  showAuthModal: boolean;
  authMode: "login" | "signup";

  // Actions
  setUser: (user: User | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setAppState: (state: AppState) => void;
  setOriginalTask: (task: string) => void;
  addMessage: (message: Omit<Message, "id">) => void;
  setQuestions: (questions: string[]) => void;
  nextQuestion: () => void;
  setAnswer: (questionIndex: number, answer: string) => void;
  setGeneratedPrompt: (prompt: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  setUsage: (used: number, limit: number) => void;
  setShowPricingModal: (show: boolean) => void;
  setShowAuthModal: (show: boolean) => void;
  setAuthMode: (mode: "login" | "signup") => void;
  canGeneratePrompt: () => boolean;
}

const initialState = {
  // Auth
  user: null as User | null,
  isAuthenticated: false,
  authLoading: true,

  // App
  appState: "idle" as AppState,
  messages: [] as Message[],
  questions: [] as string[],
  currentQuestionIndex: 0,
  answers: {} as Record<string, string>,
  generatedPrompt: "",
  originalTask: "",
  isLoading: false,
  error: null as string | null,

  // Usage
  promptsUsedToday: 0,
  dailyLimit: 3,

  // UI
  showPricingModal: false,
  showAuthModal: false,
  authMode: "login" as "login" | "signup",
};

export const usePromptyStore = create<PromptyStore>((set, get) => ({
  ...initialState,

  setUser: (user) => set({ user, isAuthenticated: !!user, authLoading: false }),

  setAuthLoading: (loading) => set({ authLoading: loading }),

  setAppState: (state) => set({ appState: state }),

  setOriginalTask: (task) => set({ originalTask: task }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, { ...message, id: crypto.randomUUID() }],
    })),

  setQuestions: (questions) => set({ questions }),

  nextQuestion: () =>
    set((state) => ({
      currentQuestionIndex: state.currentQuestionIndex + 1,
    })),

  setAnswer: (questionIndex, answer) =>
    set((state) => ({
      answers: { ...state.answers, [questionIndex]: answer },
    })),

  setGeneratedPrompt: (prompt) => set({ generatedPrompt: prompt }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error }),

  reset: () =>
    set({
      appState: "idle",
      messages: [],
      questions: [],
      currentQuestionIndex: 0,
      answers: {},
      generatedPrompt: "",
      originalTask: "",
      isLoading: false,
      error: null,
    }),

  setUsage: (used, limit) => set({ promptsUsedToday: used, dailyLimit: limit }),

  setShowPricingModal: (show) => set({ showPricingModal: show }),

  setShowAuthModal: (show) => set({ showAuthModal: show }),

  setAuthMode: (mode) => set({ authMode: mode }),

  canGeneratePrompt: () => {
    const state = get();
    if (state.user?.plan !== "free") return true;
    return state.promptsUsedToday < state.dailyLimit;
  },
}));
