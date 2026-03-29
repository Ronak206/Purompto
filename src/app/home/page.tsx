"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, Copy, Check, Send, RefreshCcw, Loader2, 
  LogOut, Moon, Sun, MessageSquare, Trash2
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
        p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-success">{children}</strong>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
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
  const [resultGeneratedAtLength, setResultGeneratedAtLength] = useState<number | null>(null);
  
  const currentChatIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const generatingChatIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [chatConversations, setChatConversations] = useState<Record<string, ChatMessage[]>>({});
  const [failedGenerations, setFailedGenerations] = useState<Record<string, string>>({});
  const [interruptedGenerations, setInterruptedGenerations] = useState<Record<string, string>>({});
  const [chatPartialText, setChatPartialText] = useState<Record<string, string>>({});

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  
  // Auto-resize textarea
  const adjustTextareaHeight = useCallback((textarea: HTMLTextAreaElement | null) => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = newHeight + 'px';
  }, []);
  
  const handleTaskChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    requestAnimationFrame(() => {
      setTask(value);
      adjustTextareaHeight(e.target);
    });
  }, [adjustTextareaHeight]);
  
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    requestAnimationFrame(() => {
      setInput(value);
      adjustTextareaHeight(e.target);
    });
  }, [adjustTextareaHeight]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
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
    
    if (generatingChatIdRef.current && generatingChatIdRef.current !== chatId) {
      const interruptedChatId = generatingChatIdRef.current;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      if (streamingText) {
        setChatPartialText(prev => ({
          ...prev,
          [interruptedChatId]: streamingText
        }));
        setInterruptedGenerations(prev => ({
          ...prev,
          [interruptedChatId]: streamingText
        }));
      }
      generatingChatIdRef.current = null;
      setState("chatting");
    }
    
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
        
        currentChatIdRef.current = chat.chatId;
        setChatConversations(prev => ({
          ...prev,
          [chat.chatId]: chat.messages || []
        }));
        
        setTask(chat.title || "");
        setConversation(chat.messages || []);
        setResult(chat.result || "");
        setSummary(chat.summary || "");
        setTips([]);
        setStreamingText("");
        
        if (chat.result) {
          setResultGeneratedAtLength(chat.messages?.length || 0);
        } else {
          setResultGeneratedAtLength(null);
        }
        
        const chatFailedError = failedGenerations[chat.chatId];
        const chatInterrupted = interruptedGenerations[chat.chatId];
        const chatPartial = chatPartialText[chat.chatId];
        
        if (chatFailedError && !chat.result) {
          setError(chatFailedError);
          setState("chatting");
        } else if (chatInterrupted && !chat.result) {
          setStreamingText(chatPartial || "");
          setError(null);
          setState("chatting");
        } else {
          setError(null);
          setState(chat.result ? "generated" : (chat.messages?.length > 0 ? "chatting" : "idle"));
        }
        
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
    if (currentChatIdRef.current && state === "generated") {
      await saveToChat({ status: "completed" });
    }
    
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
    setResultGeneratedAtLength(null);
    currentChatIdRef.current = null;
    generatingChatIdRef.current = null;
    setSidebarOpen(false);
  };
  
  const addMessageAfterGeneration = async () => {
    if (!input.trim()) return;
    
    setWorking(true);
    setError(null);
    
    const userMessage: ChatMessage = { 
      id: Date.now().toString(),
      role: 'user', 
      content: input 
    };
    
    const newConversation = [...conversation, userMessage];
    setConversation(newConversation);
    setInput("");
    setState("chatting");
    
    await new Promise(r => requestAnimationFrame(r));
    
    try {
      await saveToChat({ status: "remaining" });
      await saveToChat({ message: userMessage });
      
      const r = await authFetch("/api/analyze", { method: "POST" }, { task, conversation: newConversation.map(m => ({ role: m.role, content: m.content })) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      
      const assistantMessage: ChatMessage = { 
        id: Date.now().toString(),
        role: 'assistant', 
        content: d.message,
        questions: d.questions,
        questionReasons: d.questionReasons
      };
      
      const finalConversation = [...newConversation, assistantMessage];
      setConversation(finalConversation);
      
      if (currentChatIdRef.current) {
        setChatConversations(prev => ({
          ...prev,
          [currentChatIdRef.current!]: finalConversation
        }));
      }
      
      await saveToChat({ message: assistantMessage });
      
      if (d.readyToGenerate) {
        generatePrompt(finalConversation);
      }
      
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Error"); 
    } finally { 
      setWorking(false); 
    }
  };

  const continueChatting = async () => {
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
    
    await new Promise(r => requestAnimationFrame(r));
    
    try {
      await saveToChat({ 
        message: userMessage, 
        title: task.slice(0, 50) + (task.length > 50 ? "..." : ""),
        createNew: true 
      });
      
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
      
      const updatedConversation = [userMessage, assistantMessage];
      setConversation(updatedConversation);
      
      if (currentChatIdRef.current) {
        setChatConversations(prev => ({
          ...prev,
          [currentChatIdRef.current!]: updatedConversation
        }));
      }
      
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
    
    await new Promise(r => requestAnimationFrame(r));
    
    const conversationSoFar = [...conversation, userMessage];
    
    try {
      await saveToChat({ message: userMessage });
      
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
      
      const finalConversation = [...conversationSoFar, assistantMessage];
      setConversation(finalConversation);
      
      if (currentChatIdRef.current) {
        setChatConversations(prev => ({
          ...prev,
          [currentChatIdRef.current!]: finalConversation
        }));
      }
      
      await saveToChat({ message: assistantMessage });
      
      if (d.readyToGenerate) {
        generatePrompt(finalConversation);
      }
      
    } catch (e) { 
      setError(e instanceof Error ? e.message : "Error"); 
    } finally { 
      setWorking(false); 
    }
  };

  const generatePrompt = async (conversationHistory: ChatMessage[], retryCount = 0) => {
    const chatIdForGeneration = currentChatIdRef.current;
    generatingChatIdRef.current = chatIdForGeneration;
    
    abortControllerRef.current = new AbortController();
    
    setState("generating");
    setStreamingText("");
    setError(null);
    
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
        signal: abortControllerRef.current.signal,
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
                  if (generatingChatIdRef.current === chatIdForGeneration) {
                    setStreamingText(fullText);
                  }
                } else if (data.type === 'complete') {
                  setFailedGenerations(prev => {
                    const updated = { ...prev };
                    delete updated[chatIdForGeneration];
                    return updated;
                  });
                  setInterruptedGenerations(prev => {
                    const updated = { ...prev };
                    delete updated[chatIdForGeneration];
                    return updated;
                  });
                  setChatPartialText(prev => {
                    const updated = { ...prev };
                    delete updated[chatIdForGeneration];
                    return updated;
                  });
                  
                  if (generatingChatIdRef.current === chatIdForGeneration) {
                    setResult(data.prompt || fullText);
                    setSummary(data.summary || "");
                    setTips(data.tips || []);
                    setStreamingText("");
                    setResultGeneratedAtLength(conversationHistory.length);
                    setUser(p => p ? { ...p, totalPromptsGenerated: (p.totalPromptsGenerated || 0) + 1 } : p);
                    setState("generated");
                  }
                  
                  await saveToChat({ 
                    result: data.prompt || fullText,
                    summary: data.summary || "",
                    status: "generated"
                  });
                  fetchChats();
                  generatingChatIdRef.current = null;
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
      if (e instanceof Error && e.name === 'AbortError') {
        console.log('Generation aborted');
        return;
      }
      
      const errorMessage = e instanceof Error ? e.message : "Failed to generate prompt";
      
      setFailedGenerations(prev => ({
        ...prev,
        [chatIdForGeneration]: errorMessage
      }));
      
      if (generatingChatIdRef.current === chatIdForGeneration) {
        setError(errorMessage); 
        setState("chatting");
      }
      generatingChatIdRef.current = null;
    }
  };
  
  const retryGeneration = async () => {
    const chatId = currentChatIdRef.current;
    const storedConversation = chatId ? chatConversations[chatId] : null;
    const conversationToUse = storedConversation || conversation;
    
    if (conversationToUse.length > 0) {
      setError(null);
      setStreamingText("");
      if (chatId) {
        setFailedGenerations(prev => {
          const updated = { ...prev };
          delete updated[chatId];
          return updated;
        });
        setInterruptedGenerations(prev => {
          const updated = { ...prev };
          delete updated[chatId];
          return updated;
        });
        setChatPartialText(prev => {
          const updated = { ...prev };
          delete updated[chatId];
          return updated;
        });
      }
      
      setWorking(true);
      try {
        const r = await authFetch("/api/analyze", { method: "POST" }, { 
          task, 
          conversation: conversationToUse.map(m => ({ role: m.role, content: m.content })) 
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        
        if (d.questions && d.questions.length > 0) {
          const assistantMessage: ChatMessage = { 
            id: Date.now().toString(),
            role: 'assistant', 
            content: d.message,
            questions: d.questions,
            questionReasons: d.questionReasons
          };
          setConversation(prev => [...prev, assistantMessage]);
          setState("chatting");
        } else if (d.readyToGenerate) {
          generatePrompt(conversationToUse);
        } else {
          setState("chatting");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to analyze");
        setState("chatting");
      } finally {
        setWorking(false);
      }
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

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center bg-base-100">
        <p className="text-base-content">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-base-100 text-base-content font-sans" data-theme={isDark ? "dark" : "light"}>
      
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - daisyUI drawer style */}
      <aside className={`fixed z-50 h-full ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} w-64 bg-base-200 border-r border-base-300 transition-transform duration-200 flex flex-col`}>
        <div className="p-3 flex-shrink-0">
          <button 
            onClick={reset} 
            className="btn btn-primary btn-sm w-full gap-2"
          >
            <Sparkles className="w-4 h-4" /> New Chat
          </button>
        </div>

        <ScrollArea className="flex-1">
          {loadingChats ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-sm text-primary"></span>
            </div>
          ) : chats.length === 0 ? (
            <div className="text-center py-8 px-3 text-base-content/50">
              <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No conversations</p>
            </div>
          ) : (
            <div className="p-2">
              {Object.entries(groupedChats).map(([group, items]) => (
                <div key={group} className="mb-3">
                  <div className="text-[10px] font-medium px-3 py-1 text-base-content/50 uppercase tracking-wider">{group}</div>
                  <div className="space-y-1">
                    {items.map((chat) => (
                      <div
                        key={chat.id}
                        className={`w-full text-left px-3 py-2 rounded-lg ${currentChatIdRef.current === chat.id ? 'bg-base-300' : 'bg-base-100'} cursor-pointer flex items-center justify-between group`}
                        onClick={() => loadChat(chat.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{chat.title}</p>
                          <p className="text-[10px] text-base-content/50">{formatDate(chat.updatedAt)}</p>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); }}
                          className="btn btn-ghost btn-xs btn-circle text-error opacity-0 group-focus:opacity-100"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-base-300 flex-shrink-0">
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-base-300">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-full w-8">
                <span className="text-xs">{(user.name || user.email)[0].toUpperCase()}</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name || user.email.split("@")[0]}</p>
              <p className="text-[10px] text-base-content/50">{user.totalPromptsGenerated || 0} prompts</p>
            </div>
            <button onClick={logout} className="btn btn-ghost btn-sm btn-circle text-error">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        
        {/* Header - daisyUI navbar style */}
        <header className="h-14 flex-shrink-0 px-4 flex items-center justify-between border-b border-base-300 bg-base-100">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(!sidebarOpen)} 
              className="btn btn-ghost btn-sm btn-square"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
                <path d="M14 9h4" />
                <path d="M14 13h4" />
                <path d="M14 17h4" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="avatar placeholder">
                <div className="bg-primary text-primary-content rounded-lg w-8">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <span className="font-semibold text-sm">Purompto</span>
            </div>
          </div>
          <button onClick={() => setIsDark(!isDark)} className="btn btn-ghost btn-sm btn-circle">
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-2xl mx-auto px-4 py-6">
            {conversation.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="avatar placeholder mb-4">
                  <div className="bg-primary text-primary-content rounded-xl w-14">
                    <Sparkles className="w-7 h-7" />
                  </div>
                </div>
                <h1 className="text-xl font-semibold mb-1">How can I help you today?</h1>
                <p className="text-base-content/60 text-sm mb-6">Tell me what you want to create</p>
                
                {/* Suggestions */}
                <div className="flex flex-wrap gap-2 justify-center max-w-md">
                  {SUGGESTIONS.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setTask(suggestion)}
                      className="badge badge-lg badge-outline cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Messages using daisyUI chat component */}
            {conversation.slice(0, resultGeneratedAtLength || conversation.length).map((msg, i) => (
              <div key={msg.id || i} className={`chat ${msg.role === 'user' ? 'chat-end' : 'chat-start'} mb-4`}>
                <div className="chat-image avatar placeholder">
                  <div className={`w-8 rounded-full ${msg.role === 'user' ? 'bg-primary text-primary-content' : 'bg-neutral text-neutral-content'}`}>
                    {msg.role === 'user' ? (
                      <span className="text-xs">{(user?.name || user?.email || 'U')[0].toUpperCase()}</span>
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>
                </div>
                <div className={`chat-bubble ${msg.role === 'user' ? 'chat-bubble-primary' : 'chat-bubble-neutral'}`}>
                  <div className="prose prose-sm max-w-none">
                    <MarkdownRenderer content={msg.content} />
                    {msg.questions && msg.questions.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.questions.map((q, qi) => (
                          <div key={qi} className="alert alert-soft alert-info text-sm">
                            <div>
                              <div className="font-medium">{q}</div>
                              {msg.questionReasons?.[qi] && (
                                <div className="text-xs opacity-70 mt-1">{msg.questionReasons[qi]}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {msg.role === 'user' && i === (resultGeneratedAtLength || conversation.length) - 1 && !result && state !== "generating" && !working && (
                  <div className="chat-footer">
                    <button
                      onClick={retryGeneration}
                      className="btn btn-ghost btn-xs gap-1 text-base-content/50"
                    >
                      <RefreshCcw className="w-3 h-3" /> Retry
                    </button>
                  </div>
                )}
              </div>
            ))}
            
            {/* Generating state */}
            {state === "generating" && !streamingText && (
              <div className="chat chat-start mb-4">
                <div className="chat-image avatar placeholder">
                  <div className="w-8 rounded-full bg-neutral text-neutral-content">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div className="chat-bubble chat-bubble-neutral">
                  <div className="flex items-center gap-2">
                    <span className="loading loading-spinner loading-sm text-primary"></span>
                    <span>Creating your prompt...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Streaming result */}
            {(state === "generating" && streamingText) && (
              <div className="card card-border border-primary bg-base-200 mb-4">
                <div className="card-body">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-primary">Generated Prompt</span>
                    <span className="loading loading-spinner loading-xs text-primary"></span>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <MarkdownRenderer content={streamingText} />
                  </div>
                </div>
              </div>
            )}
            
            {/* Generated Result */}
            {state === "generated" && result && (
              <div className="card card-border border-success bg-success/10 mb-4">
                <div className="card-body">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-success" />
                      <span className="font-semibold text-success">Your Prompt is Ready!</span>
                    </div>
                    <button 
                      onClick={copy}
                      className="btn btn-success btn-sm gap-2"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <div className="prose prose-sm max-w-none">
                    <MarkdownRenderer content={result} />
                  </div>
                  {summary && (
                    <div className="mt-3 text-sm text-base-content/70">
                      <strong>Summary:</strong> {summary}
                    </div>
                  )}
                  {tips && tips.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium mb-1">Tips:</div>
                      <ul className="text-sm text-base-content/70 list-disc list-inside">
                        {tips.map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Continue chatting section */}
            {state === "generated" && (
              <div className="text-center py-4">
                <p className="text-base-content/60 text-sm mb-3">Want to refine your prompt?</p>
                <button onClick={continueChatting} className="btn btn-outline btn-primary btn-sm gap-2">
                  Continue Chatting <span className="text-lg">→</span>
                </button>
              </div>
            )}
            
            {/* Error */}
            {error && (
              <div className="alert alert-error mb-4">
                <span>{error}</span>
                <button onClick={retryGeneration} className="btn btn-sm btn-ghost">
                  <RefreshCcw className="w-4 h-4 mr-1" /> Retry
                </button>
              </div>
            )}
            
            <div ref={scrollRef} />
          </div>
        </main>

        {/* Input Area */}
        <footer className="flex-shrink-0 p-4 border-t border-base-300 bg-base-100">
          <div className="w-full max-w-2xl mx-auto">
            {state === "idle" ? (
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={task}
                  onChange={handleTaskChange}
                  placeholder="What do you want to create?"
                  className="textarea textarea-bordered flex-1 min-h-[52px] max-h-[200px] resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      startConversation();
                    }
                  }}
                />
                <button 
                  onClick={startConversation}
                  disabled={working || !task.trim()}
                  className="btn btn-primary btn-circle"
                >
                  {working ? <span className="loading loading-spinner loading-sm"></span> : <Send className="w-5 h-5" />}
                </button>
              </div>
            ) : state !== "generated" ? (
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Type your response..."
                  className="textarea textarea-bordered flex-1 min-h-[52px] max-h-[200px] resize-none"
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                />
                <button 
                  onClick={sendMessage}
                  disabled={working || !input.trim()}
                  className="btn btn-primary btn-circle"
                >
                  {working ? <span className="loading loading-spinner loading-sm"></span> : <Send className="w-5 h-5" />}
                </button>
              </div>
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
