"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, Copy, Check, Send, RefreshCcw, Loader2, CheckCircle, 
  LogOut, ArrowRight, Lightbulb, Moon, Sun, MessageSquare, Trash2
} from "lucide-react";
import { generateSecurityPayload } from "@/lib/client-secure";
import ReactMarkdown from "react-markdown";

interface AuthUser { id: string; email: string; name: string | null; isActive: boolean; totalPromptsGenerated: number; }

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  questions?: string[];
  questionReasons?: string[];
  createdAt?: string;
}

interface ChatItem {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
}

const SUGGESTIONS = [
  "Write a blog post about AI",
  "Create a marketing email",
  "Generate social media content",
  "Write a product description"
];

function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        p: ({ children }) => <p className="mb-2 leading-relaxed text-sm">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-emerald-400">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function HomePage() {
  const [isDark, setIsDark] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Chat state
  const [state, setState] = useState<"idle" | "chatting" | "generating" | "generated">("idle");
  const [task, setTask] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [summary, setSummary] = useState("");
  const [tips, setTips] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  
  const currentChatIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  useEffect(() => { 
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => { 
        if (d.user) setUser(d.user); 
        else window.location.href = "/";
      })
      .finally(() => setLoading(false)); 
  }, []);

  useEffect(() => {
    if (user) {
      fetch("/api/auth/token")
        .then(r => r.json())
        .then(d => setApiToken(d.token))
        .catch(console.error);
    }
  }, [user]);

  useEffect(() => {
    if (apiToken && user) fetchChats();
  }, [apiToken, user]);

  useEffect(() => { 
    scrollRef.current?.scrollIntoView({ behavior: "smooth" }); 
  }, [conversation, streamingText]);

  // Close sidebar on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  const authFetch = async (url: string, options: RequestInit = {}, bodyData?: Record<string, unknown>) => {
    if (!user?.id) return fetch(url, options);
    
    const securityPayload = await generateSecurityPayload(user.id);
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...securityPayload.headers,
      ...options.headers,
    };
    
    if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;
    
    const body = bodyData 
      ? JSON.stringify({ ...bodyData, ...securityPayload.body })
      : options.body;
    
    return fetch(url, { ...options, headers, body });
  };

  const fetchChats = async () => {
    if (!apiToken || !user) return;
    setLoadingChats(true);
    try {
      const securityPayload = await generateSecurityPayload(user.id);
      const res = await fetch("/api/chat", {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          ...securityPayload.headers,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setChats(data.chats || []);
      }
    } catch (e) {
      console.error("Failed to fetch chats:", e);
    } finally {
      setLoadingChats(false);
    }
  };

  const loadChat = async (chatId: string) => {
    if (!apiToken || !user) return;
    
    // Cancel any ongoing requests for the previous chat
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset all states before loading new chat (isolate chats)
    setWorking(false);
    setError(null);
    setStreamingText("");
    setState("idle");
    
    try {
      const securityPayload = await generateSecurityPayload(user.id);
      const res = await fetch(`/api/chat?chatId=${chatId}`, {
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          ...securityPayload.headers,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const chat = data.chat;
        
        // Set the current chat ID
        currentChatIdRef.current = chat.chatId;
        
        // Load this chat's specific data
        setTask(chat.title || "");
        setConversation(chat.messages || []);
        setResult(chat.result || "");
        setSummary(chat.summary || "");
        setTips([]);
        setError(null);
        setStreamingText("");
        setWorking(false);
        setState(chat.result ? "generated" : (chat.messages?.length > 0 ? "chatting" : "idle"));
        setSidebarOpen(false);
      }
    } catch (e) {
      console.error("Failed to load chat:", e);
    }
  };

  const saveToChat = useCallback(async (data: {
    message?: ChatMessage;
    title?: string;
    result?: string;
    summary?: string;
    status?: string;
    createNew?: boolean;
  }): Promise<string | null> => {
    if (!user || !apiToken) return null;
    
    try {
      const securityPayload = await generateSecurityPayload(user.id);
      const body: Record<string, unknown> = {};
      
      if (currentChatIdRef.current && !data.createNew) {
        body.chatId = currentChatIdRef.current;
      }
      
      if (data.message) {
        body.message = {
          role: data.message.role,
          content: data.message.content,
          questions: data.message.questions,
          questionReasons: data.message.questionReasons,
        };
      }
      
      if (data.title) body.title = data.title;
      if (data.result !== undefined) body.result = data.result;
      if (data.summary !== undefined) body.summary = data.summary;
      if (data.status) body.status = data.status;
      
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          ...securityPayload.headers,
        },
        body: JSON.stringify({ ...body, ...securityPayload.body }),
      });

      if (res.ok) {
        const responseData = await res.json();
        if (responseData.chatId) {
          currentChatIdRef.current = responseData.chatId;
        }
        return responseData.chatId;
      }
    } catch (e) {
      console.error("Failed to save chat:", e);
    }
    return null;
  }, [user, apiToken]);

  const deleteChat = async (chatId: string) => {
    if (!user || !apiToken) return;
    
    try {
      const securityPayload = await generateSecurityPayload(user.id);
      await fetch(`/api/chat?chatId=${chatId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          ...securityPayload.headers,
        },
      });
      fetchChats();
      if (currentChatIdRef.current === chatId) reset();
    } catch (e) {
      console.error("Failed to delete chat:", e);
    }
  };

  const logout = async () => { 
    await fetch("/api/auth/logout", { method: "POST" }); 
    window.location.href = "/";
  };
  
  const reset = async () => { 
    // Cancel any ongoing requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // If current chat has a generated result, mark it as completed before starting new
    if (currentChatIdRef.current && state === "generated") {
      await saveToChat({ status: "completed" });
    }
    
    // Reset all states
    setState("idle"); 
    setConversation([]); 
    setResult(""); 
    setTask(""); 
    setInput(""); 
    setError(null);
    setSummary("");
    setTips([]);
    setStreamingText("");
    setWorking(false);
    currentChatIdRef.current = null;
    setSidebarOpen(false);
  };

  const continueChatting = async () => {
    // Mark as "remaining" since user wants to continue refining
    await saveToChat({ status: "remaining" });
    setState("chatting");
    setResult("");
    setTips([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const startConversation = async () => {
    if (!task.trim()) return;
    
    setWorking(true);
    setError(null);
    setState("chatting");
    
    const userMessage: ChatMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: task 
    };
    setConversation([userMessage]);
    
    await saveToChat({ 
      message: userMessage, 
      title: task.slice(0, 50) + (task.length > 50 ? "..." : ""),
      createNew: true 
    });
    
    try {
      const r = await authFetch("/api/analyze", { method: "POST" }, { task, conversation: [] });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      
      const assistantMessage: ChatMessage = { 
        id: Date.now().toString(),
        role: 'assistant', 
        content: d.message,
        questions: d.questions,
        questionReasons: d.questionReasons
      };
      
      setConversation(prev => [...prev, assistantMessage]);
      await saveToChat({ message: assistantMessage });
      fetchChats();
      
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Error"); 
      setState("idle"); 
    } finally { 
      setWorking(false); 
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || working) return;
    
    setWorking(true);
    setError(null);
    
    const userMessage: ChatMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: input 
    };
    setConversation(prev => [...prev, userMessage]);
    setInput("");
    
    await saveToChat({ message: userMessage });
    
    const conversationSoFar = [...conversation, userMessage];
    
    try {
      const r = await authFetch("/api/analyze", { method: "POST" }, { task, conversation: conversationSoFar.map(m => ({ role: m.role, content: m.content })) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      
      const assistantMessage: ChatMessage = { 
        id: Date.now().toString(),
        role: 'assistant', 
        content: d.message,
        questions: d.questions,
        questionReasons: d.questionReasons
      };
      
      setConversation(prev => [...prev, assistantMessage]);
      await saveToChat({ message: assistantMessage });
      
      if (d.readyToGenerate) {
        generatePrompt([...conversationSoFar, assistantMessage]);
      }
      
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Error"); 
    } finally { 
      setWorking(false); 
    }
  };

  const generatePrompt = async (conversationHistory: ChatMessage[]) => {
    setState("generating");
    setStreamingText("");
    
    try {
      const securityPayload = await generateSecurityPayload(user!.id);
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...securityPayload.headers,
      };
      if (apiToken) headers["Authorization"] = `Bearer ${apiToken}`;
      
      const response = await fetch("/api/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({ 
          task, 
          conversation: conversationHistory.map(m => ({ role: m.role, content: m.content })),
          ...securityPayload.body
        }),
      });
      
      if (!response.ok) {
        const d = await response.json();
        throw new Error(d.error);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'text') {
                  fullText += data.content;
                  setStreamingText(fullText);
                } else if (data.type === 'complete') {
                  setResult(data.prompt || fullText);
                  setSummary(data.summary || "");
                  setTips(data.tips || []);
                  setUser(p => p ? { ...p, totalPromptsGenerated: (p.totalPromptsGenerated || 0) + 1 } : p);
                  setState("generated");
                  
                  await saveToChat({ 
                    result: data.prompt || fullText,
                    summary: data.summary || "",
                    status: "generated"
                  });
                  fetchChats();
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }
      
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Error"); 
      setState("chatting"); 
    }
  };

  const copy = async () => { 
    await navigator.clipboard.writeText(result || streamingText); 
    setCopied(true); 
    setTimeout(() => setCopied(false), 2000); 
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDateGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "This Week";
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupedChats = chats.reduce((groups: Record<string, ChatItem[]>, chat) => {
    const group = formatDateGroup(chat.updatedAt);
    if (!groups[group]) groups[group] = [];
    groups[group].push(chat);
    return groups;
  }, {});

  const theme = {
    bg: isDark ? "bg-zinc-950" : "bg-gray-50",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-zinc-400" : "text-gray-500",
    textMuted2: isDark ? "text-zinc-500" : "text-gray-400",
    border: isDark ? "border-zinc-800" : "border-gray-200",
    bgCard: isDark ? "bg-zinc-900" : "bg-white",
    bgInput: isDark ? "bg-zinc-800" : "bg-white",
    sidebarBg: isDark ? "bg-zinc-900" : "bg-white",
    promptBg: isDark ? "bg-emerald-950/50 border-emerald-900" : "bg-emerald-50 border-emerald-200",
    promptText: isDark ? "text-emerald-400" : "text-emerald-600",
    userBubble: isDark ? "bg-emerald-600 text-white" : "bg-emerald-500 text-white",
    aiBubble: isDark ? "bg-zinc-800 text-white" : "bg-gray-100 text-gray-900",
    tipBg: isDark ? "bg-amber-950/30 border-amber-900" : "bg-amber-50 border-amber-200",
    tipText: isDark ? "text-amber-400" : "text-amber-600",
    historyItem: isDark ? "hover:bg-zinc-800" : "hover:bg-gray-100",
    historyItemActive: isDark ? "bg-zinc-800" : "bg-gray-100",
  };

  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <p>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className={`h-screen overflow-hidden flex ${theme.bg} ${theme.text} font-sans`}>
      
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed z-50 h-full ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} w-64 ${theme.sidebarBg} border-r ${theme.border} transition-transform duration-200 flex flex-col`}>
        <div className="p-2 flex-shrink-0 flex gap-1.5">
          <Button 
            onClick={reset} 
            size="sm"
            className="flex-1 justify-start bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white h-8 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> New Chat
          </Button>
          <button 
            onClick={() => setSidebarOpen(false)}
            className={`p-1.5 rounded-lg hover:bg-white/10 ${theme.textMuted} transition-colors flex-shrink-0`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="M14 9h4" />
              <path d="M14 13h4" />
              <path d="M14 17h4" />
            </svg>
          </button>
        </div>

        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-emerald-500" /></div>
          ) : chats.length === 0 ? (
            <div className={`text-center py-8 px-3 ${theme.textMuted2}`}>
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No conversations</p>
            </div>
          ) : (
            <div className="p-1.5">
              {Object.entries(groupedChats).map(([group, items]) => (
                <div key={group} className="mb-2">
                  <div className={`text-[10px] font-medium px-2 py-1 ${theme.textMuted2} uppercase tracking-wider`}>{group}</div>
                  <div className="space-y-0.5">
                    {items.map((chat) => (
                      <button
                        key={chat.id}
                        onClick={() => loadChat(chat.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-md ${currentChatIdRef.current === chat.id ? theme.historyItemActive : theme.historyItem} transition-colors group`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{chat.title}</p>
                            <p className={`text-[10px] ${theme.textMuted2}`}>{formatDate(chat.updatedAt)}</p>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-500/20 rounded transition-opacity"
                          >
                            <Trash2 className="w-3 h-3 text-red-400" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Sidebar Footer - User Profile & Logout */}
        <div className={`p-2 border-t ${theme.border} flex-shrink-0`}>
          <div className={`flex items-center gap-2 px-2 py-2 rounded-lg ${theme.bgCard}`}>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <span className="text-white text-xs font-semibold">{(user.name || user.email)[0].toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name || user.email.split("@")[0]}</p>
              <p className={`text-[10px] ${theme.textMuted2}`}>{user.totalPromptsGenerated || 0} prompts</p>
            </div>
            <button onClick={logout} className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Header */}
        <header className="h-12 flex-shrink-0 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* ChatGPT style sidebar toggle - same button to open/close */}
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className={`p-1.5 rounded-lg hover:bg-white/10 ${theme.textMuted} transition-colors`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="M14 9h4" />
                <path d="M14 13h4" />
                <path d="M14 17h4" />
              </svg>
            </button>
            <div className="flex items-center gap-2 ml-1">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-semibold text-sm">Purompto</span>
            </div>
          </div>
          <button onClick={() => setIsDark(!isDark)} className={`p-1.5 rounded-lg hover:bg-white/10 ${theme.textMuted}`}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto px-4 py-6">
            {conversation.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-lg font-semibold mb-1">How can I help you today?</h1>
                <p className={`${theme.textMuted} text-sm mb-6`}>Tell me what you want to create</p>
                
                {/* Suggestions */}
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setTask(suggestion)}
                      className={`px-3 py-1.5 text-xs rounded-full ${theme.bgCard} border ${theme.border} ${theme.textMuted} hover:${theme.text} transition-colors`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {conversation.map((msg, i) => (
              <div key={msg.id || i} className={`mb-4 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl ${msg.role === "user" ? theme.userBubble : theme.aiBubble}`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none">
                      <MarkdownRenderer content={msg.content} />
                      {msg.questions && msg.questions.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {msg.questions.map((q, qi) => (
                            <div key={qi} className={`p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                              <div className="font-medium text-sm">💡 {q}</div>
                              {msg.questionReasons?.[qi] && (
                                <div className={`text-xs mt-1 ${theme.textMuted} italic`}>{msg.questionReasons[qi]}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                  )}
                </div>
              </div>
            ))}
            
            {state === "generating" && !streamingText && (
              <div className="mb-4">
                <div className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl ${theme.aiBubble}`}>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-sm">Creating your prompt...</span>
                </div>
              </div>
            )}

            {state === "generating" && streamingText && (
              <div className="mb-4">
                <div className={`max-w-[85%] px-3 py-2.5 rounded-2xl ${theme.aiBubble}`}>
                  <div className={`text-xs font-medium ${theme.promptText} mb-2`}>✨ Generating...</div>
                  <div className="whitespace-pre-wrap text-sm">{streamingText}<span className="inline-block w-1 h-4 bg-emerald-400 animate-pulse ml-0.5" /></div>
                </div>
              </div>
            )}
            
            {working && state !== "generating" && (
              <div className="mb-4">
                <div className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-2xl ${theme.aiBubble}`}>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            )}
            
            <div ref={scrollRef} />

            {/* Generated Result */}
            {state === "generated" && result && (
              <div className={`mt-4 p-4 rounded-2xl ${theme.promptBg} border`}>
                <div className="flex justify-between items-center mb-3">
                  <div className={`flex items-center gap-2 ${theme.promptText}`}>
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium text-sm">{summary || "Your Prompt"}</span>
                  </div>
                  <Button variant="ghost" size="xs" onClick={copy} className={`${theme.promptText} hover:bg-emerald-500/20 h-7`}>
                    {copied ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    <span className="text-xs">{copied ? "Copied!" : "Copy"}</span>
                  </Button>
                </div>
                <div className={`text-sm leading-relaxed max-h-52 overflow-y-auto p-3 rounded-xl ${isDark ? 'bg-black/30' : 'bg-white'} whitespace-pre-wrap`}>
                  {result}
                </div>
                {tips && tips.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {tips.map((tip, i) => (
                      <div key={i} className={`text-xs p-2.5 rounded-lg ${theme.tipBg} border ${theme.tipText}`}>
                        💡 {tip}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}
          </div>
        </main>

        {/* Bottom Input - z.ai style */}
        <div className="flex-shrink-0 p-4 pb-6">
          <div className="w-full max-w-2xl mx-auto">
            {state === "idle" && (
              <div className={`relative flex items-end ${theme.bgInput} rounded-2xl`}>
                <Textarea 
                  ref={inputRef}
                  placeholder="Describe what you want to create..." 
                  value={task} 
                  onChange={e => setTask(e.target.value)} 
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); startConversation(); }}}
                  className={`flex-1 min-h-[48px] max-h-[120px] text-sm py-3 px-4 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none`} 
                  rows={1}
                />
                <Button 
                  onClick={startConversation} 
                  disabled={!task.trim() || working} 
                  size="icon"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 w-9 h-9 rounded-xl mr-2 mb-2 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            )}

            {(state === "chatting" || state === "generating") && (
              <div>
                <div className={`relative flex items-end ${theme.bgInput} rounded-2xl`}>
                  <Textarea 
                    ref={inputRef}
                    placeholder="Type your answer..." 
                    value={input} 
                    onChange={e => setInput(e.target.value)} 
                    className={`flex-1 min-h-[48px] max-h-[120px] text-sm py-3 px-4 bg-transparent border-0 focus:ring-0 focus:outline-none resize-none`} 
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}} 
                    disabled={working}
                    rows={1}
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={!input.trim() || working} 
                    size="icon"
                    className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 w-9 h-9 rounded-xl mr-2 mb-2 flex-shrink-0"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className={`mt-2 flex items-center justify-center gap-1.5 text-xs ${theme.textMuted}`}>
                  <Lightbulb className="w-3 h-3 text-emerald-500" />
                  <span>Answer with detail for a better prompt</span>
                </div>
              </div>
            )}

            {state === "generated" && (
              <div className="flex justify-center gap-2">
                <Button 
                  onClick={continueChatting}
                  variant="outline"
                  size="sm"
                  className="h-9 px-4"
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1.5" /> Continue
                </Button>
                <Button 
                  onClick={reset} 
                  size="sm"
                  className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 h-9 px-4"
                >
                  <RefreshCcw className="w-3.5 h-3.5 mr-1.5" /> New Chat
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
