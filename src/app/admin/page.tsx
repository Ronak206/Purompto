"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Users, Plus, Trash2, Edit, Eye, EyeOff, Check, X, LogOut, 
  UserCheck, UserX, RefreshCw, Shield, AlertCircle, FileText, 
  Sparkles, Copy, MessageSquare, Clock, CheckCircle, Loader2
} from "lucide-react";

interface UserInfo {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  notes: string | null;
  createdByAdmin: boolean;
  totalPromptsGenerated: number;
  createdAt: string;
}

interface PromptInfo {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  task: string;
  questions: string[];
  answers: Record<string, string>;
  result: string;
  createdAt: string;
}

interface ChatInfo {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  title: string;
  status: string;
  result: string;
  summary: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

type Tab = "users" | "prompts" | "chats";

export default function AdminPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [prompts, setPrompts] = useState<PromptInfo[]>([]);
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  // New user form
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Edit user
  const [editingUser, setEditingUser] = useState<UserInfo | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // View prompt/chat detail
  const [viewingPrompt, setViewingPrompt] = useState<PromptInfo | null>(null);
  const [viewingChat, setViewingChat] = useState<ChatInfo | null>(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // Check if already authenticated from localStorage
  useEffect(() => {
    const savedSecret = localStorage.getItem("adminSecret");
    if (savedSecret) {
      setAdminSecret(savedSecret);
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated && adminSecret) {
      if (activeTab === "users") {
        fetchUsers();
      } else if (activeTab === "chats") {
        fetchChats();
      } else {
        fetchPrompts();
      }
    }
  }, [isAuthenticated, adminSecret, activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?adminSecret=${encodeURIComponent(adminSecret)}`);
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
        setError("");
      } else {
        setError(data.error || "Failed to fetch users");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/prompts?adminSecret=${encodeURIComponent(adminSecret)}`);
      const data = await res.json();
      if (data.success) {
        setPrompts(data.prompts);
        setError("");
      } else {
        setError(data.error || "Failed to fetch prompts");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const fetchChats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/chats?adminSecret=${encodeURIComponent(adminSecret)}`);
      const data = await res.json();
      if (data.success) {
        setChats(data.chats);
        setError("");
      } else {
        setError(data.error || "Failed to fetch chats");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    if (!adminSecret.trim()) {
      setError("Please enter admin secret");
      return;
    }
    localStorage.setItem("adminSecret", adminSecret);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem("adminSecret");
    setAdminSecret("");
    setIsAuthenticated(false);
    setUsers([]);
    setPrompts([]);
    setChats([]);
  };

  const createUser = async () => {
    if (!newEmail.trim() || !newPassword.trim()) {
      setError("Email and password required");
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName || null,
          adminSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`User created: ${newEmail}`);
        setNewEmail("");
        setNewPassword("");
        setNewName("");
        fetchUsers();
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          isActive: !currentStatus,
          adminSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
        fetchUsers();
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async () => {
    if (!editingUser) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName || null,
          password: editPassword || undefined,
          notes: editNotes || null,
          adminSecret,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("User updated");
        setEditingUser(null);
        setEditPassword("");
        fetchUsers();
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?userId=${userId}&adminSecret=${encodeURIComponent(adminSecret)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("User deleted");
        fetchUsers();
      } else {
        setError(data.error || "Failed to delete user");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const deletePrompt = async (promptId: string) => {
    if (!confirm("Are you sure you want to delete this prompt?")) return;
    
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/prompts?promptId=${promptId}&adminSecret=${encodeURIComponent(adminSecret)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccess("Prompt deleted");
        fetchPrompts();
      } else {
        setError(data.error || "Failed to delete prompt");
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const copyPrompt = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 2000);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Clear messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError("");
        setSuccess("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Panel</h1>
              <p className="text-sm text-white/60">Purompto Management</p>
            </div>
          </div>
          
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/60 mb-1 block">Admin Secret</label>
              <Input
                type="password"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Enter admin secret key"
                className="bg-black/30 border-white/10 focus:border-emerald-500/50"
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
            </div>
            <Button 
              onClick={handleLogin}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              Access Admin Panel
            </Button>
          </div>
          
          <p className="mt-4 text-xs text-white/40 text-center">
            Set ADMIN_SECRET in your .env file
          </p>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-black/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-emerald-400" />
            <span className="font-bold">Admin Panel</span>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => activeTab === "users" ? fetchUsers() : activeTab === "chats" ? fetchChats() : fetchPrompts()} variant="ghost" size="sm" className="text-white/60 hover:text-white">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm" className="text-red-400 hover:bg-red-500/10">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button 
            onClick={() => setActiveTab("users")} 
            className={activeTab === "users" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-white/5 text-white/60 hover:bg-white/10"}
          >
            <Users className="w-4 h-4 mr-2" /> Users ({users.length})
          </Button>
          <Button 
            onClick={() => setActiveTab("chats")} 
            className={activeTab === "chats" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-white/5 text-white/60 hover:bg-white/10"}
          >
            <MessageSquare className="w-4 h-4 mr-2" /> Chats ({chats.length})
          </Button>
          <Button 
            onClick={() => setActiveTab("prompts")} 
            className={activeTab === "prompts" ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-white/5 text-white/60 hover:bg-white/10"}
          >
            <FileText className="w-4 h-4 mr-2" /> Prompts ({prompts.length})
          </Button>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
            <Check className="w-4 h-4" />
            {success}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Create User Form */}
            <div className="lg:col-span-1">
              <div className="bg-zinc-900 border border-white/10 rounded-xl p-4">
                <h2 className="font-bold mb-4 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-400" />
                  Create New User
                </h2>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Email *</label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="bg-black/30 border-white/10 focus:border-emerald-500/50 h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Password *</label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="bg-black/30 border-white/10 focus:border-emerald-500/50 h-9 pr-10"
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Name (optional)</label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="User name"
                      className="bg-black/30 border-white/10 focus:border-emerald-500/50 h-9"
                    />
                  </div>
                  <Button
                    onClick={createUser}
                    disabled={loading || !newEmail || !newPassword}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-500"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Create User"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Users List */}
            <div className="lg:col-span-2">
              <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h2 className="font-bold">All Users</h2>
                </div>
                
                {loading && users.length === 0 ? (
                  <div className="p-8 text-center text-white/40">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading users...
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-8 text-center text-white/40">
                    <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No users yet
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {users.map((user) => (
                      <div key={user.id} className="p-4 hover:bg-white/5 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium truncate">{user.email}</span>
                              {user.isActive ? (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Active</span>
                              ) : (
                                <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Disabled</span>
                              )}
                            </div>
                            {user.name && (
                              <p className="text-sm text-white/60 mb-1">{user.name}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-white/40">
                              <span className="flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> {user.totalPromptsGenerated || 0} prompts
                              </span>
                              <span>Created: {formatDate(user.createdAt)}</span>
                            </div>
                            {user.notes && (
                              <p className="text-xs text-white/40 italic mt-1">Note: {user.notes}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-2">
                            <button
                              onClick={() => toggleUserStatus(user.id, user.isActive)}
                              className={`p-2 rounded-lg transition-colors ${
                                user.isActive
                                  ? "text-red-400 hover:bg-red-500/10"
                                  : "text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                              title={user.isActive ? "Disable user" : "Enable user"}
                            >
                              {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => {
                                setEditingUser(user);
                                setEditName(user.name || "");
                                setEditNotes(user.notes || "");
                                setEditPassword("");
                              }}
                              className="p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chats Tab */}
        {activeTab === "chats" && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold">All Chats</h2>
            </div>
            
            {loading && chats.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading chats...
              </div>
            ) : chats.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No chats yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {chats.map((chat) => (
                  <div key={chat.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{chat.title}</span>
                          {/* Status Badge */}
                          {chat.status === "generated" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Generated
                            </span>
                          )}
                          {chat.status === "remaining" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Remaining
                            </span>
                          )}
                          {chat.status === "completed" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Completed
                            </span>
                          )}
                          {chat.status === "active" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400 flex items-center gap-1">
                              <Loader2 className="w-3 h-3" /> Active
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white/60 mb-1">
                          By: {chat.userName || chat.userEmail}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span>{chat.messageCount} messages</span>
                          <span>{formatDate(chat.updatedAt)}</span>
                        </div>
                        {chat.result && (
                          <p className="text-xs text-white/40 line-clamp-2 mt-1">{chat.result.slice(0, 100)}...</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setViewingChat(chat)}
                          className="p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
                          title="View chat"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Prompts Tab */}
        {activeTab === "prompts" && (
          <div className="bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <h2 className="font-bold">All Prompts</h2>
            </div>
            
            {loading && prompts.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                Loading prompts...
              </div>
            ) : prompts.length === 0 ? (
              <div className="p-8 text-center text-white/40">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No prompts yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {prompts.map((prompt) => (
                  <div key={prompt.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">{prompt.task}</span>
                        </div>
                        <p className="text-sm text-white/60 mb-1">
                          By: {prompt.userName || prompt.userEmail}
                        </p>
                        <p className="text-xs text-white/40 line-clamp-2">{prompt.result.slice(0, 150)}...</p>
                        <p className="text-xs text-white/40 mt-1">{formatDate(prompt.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => setViewingPrompt(prompt)}
                          className="p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors"
                          title="View prompt"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deletePrompt(prompt.id)}
                          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete prompt"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="font-bold">Edit User</h3>
                <button onClick={() => setEditingUser(null)} className="text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Email</label>
                  <Input
                    value={editingUser.email}
                    disabled
                    className="bg-black/30 border-white/10 text-white/40"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Name</label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="User name"
                    className="bg-black/30 border-white/10 focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">New Password (leave blank to keep)</label>
                  <Input
                    type="password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="bg-black/30 border-white/10 focus:border-emerald-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/60 mb-1 block">Notes</label>
                  <Input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Admin notes"
                    className="bg-black/30 border-white/10 focus:border-emerald-500/50"
                  />
                </div>
              </div>
              <div className="p-4 border-t border-white/10 flex gap-2">
                <Button onClick={() => setEditingUser(null)} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10">
                  Cancel
                </Button>
                <Button onClick={updateUser} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500">
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Prompt Modal */}
        {viewingPrompt && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-white/10 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <h3 className="font-bold text-lg">Prompt Details</h3>
                <button onClick={() => setViewingPrompt(null)} className="text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">User</h4>
                  <p className="text-sm bg-black/30 p-3 rounded-lg">{viewingPrompt.userName || viewingPrompt.userEmail}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Task</h4>
                  <p className="text-sm bg-black/30 p-3 rounded-lg">{viewingPrompt.task}</p>
                </div>
                {viewingPrompt.questions && viewingPrompt.questions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">Questions & Answers</h4>
                    <div className="space-y-3">
                      {viewingPrompt.questions.map((q, i) => (
                        <div key={i} className="bg-black/30 p-3 rounded-lg">
                          <p className="text-xs text-white/60 mb-1">Q{i + 1}: {q}</p>
                          <p className="text-sm font-medium">A: {viewingPrompt.answers[i] || "No answer"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-emerald-400">Generated Prompt</h4>
                    <Button variant="ghost" size="sm" onClick={() => copyPrompt(viewingPrompt.result)} className="text-emerald-400 hover:bg-emerald-500/20 h-7 text-xs">
                      {promptCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {promptCopied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                  <div className="text-sm bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg max-h-60 overflow-y-auto">
                    {viewingPrompt.result}
                  </div>
                </div>
                <p className="text-xs text-white/40">Created: {formatDate(viewingPrompt.createdAt)}</p>
              </div>
              <div className="p-4 border-t border-white/10 flex gap-3 flex-shrink-0">
                <Button onClick={() => setViewingPrompt(null)} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10">
                  Close
                </Button>
                <Button 
                  onClick={() => {
                    deletePrompt(viewingPrompt.id);
                    setViewingPrompt(null);
                  }} 
                  className="flex-1 bg-red-500 hover:bg-red-600"
                >
                  Delete Prompt
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* View Chat Modal */}
        {viewingChat && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] bg-zinc-900 border border-white/10 rounded-xl overflow-hidden flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">Chat Details</h3>
                  {/* Status Badge */}
                  {viewingChat.status === "generated" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">Generated</span>
                  )}
                  {viewingChat.status === "remaining" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">Remaining</span>
                  )}
                  {viewingChat.status === "completed" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Completed</span>
                  )}
                  {viewingChat.status === "active" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-500/20 text-zinc-400">Active</span>
                  )}
                </div>
                <button onClick={() => setViewingChat(null)} className="text-white/60 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">User</h4>
                  <p className="text-sm bg-black/30 p-3 rounded-lg">{viewingChat.userName || viewingChat.userEmail}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-emerald-400 mb-2">Title</h4>
                  <p className="text-sm bg-black/30 p-3 rounded-lg">{viewingChat.title}</p>
                </div>
                <div className="flex gap-4 text-xs text-white/40">
                  <span>{viewingChat.messageCount} messages</span>
                  <span>Created: {formatDate(viewingChat.createdAt)}</span>
                  <span>Updated: {formatDate(viewingChat.updatedAt)}</span>
                </div>
                {viewingChat.summary && (
                  <div>
                    <h4 className="text-sm font-medium text-emerald-400 mb-2">Summary</h4>
                    <p className="text-sm bg-black/30 p-3 rounded-lg">{viewingChat.summary}</p>
                  </div>
                )}
                {viewingChat.result && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-emerald-400">Generated Prompt</h4>
                      <Button variant="ghost" size="sm" onClick={() => copyPrompt(viewingChat.result)} className="text-emerald-400 hover:bg-emerald-500/20 h-7 text-xs">
                        {promptCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        {promptCopied ? "Copied!" : "Copy"}
                      </Button>
                    </div>
                    <div className="text-sm bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-lg max-h-80 overflow-y-auto whitespace-pre-wrap">
                      {viewingChat.result}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-white/10 flex gap-3 flex-shrink-0">
                <Button onClick={() => setViewingChat(null)} variant="outline" className="flex-1 border-white/10 text-white hover:bg-white/10">
                  Close
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
