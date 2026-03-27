"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Sparkles, Loader2, MessageSquare, Target, Clock, Lightbulb, Moon, Sun, X, ArrowRight
} from "lucide-react";

export default function LandingPage() {
  const [isDark, setIsDark] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Theme effect
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, [isDark]);

  // Check if already logged in
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          // Store session user in sessionStorage for tab isolation
          sessionStorage.setItem('purompto_session_user', d.user.id);
          sessionStorage.setItem('purompto_session_id', `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
          window.location.href = "/home"; // Hard redirect
        }
      })
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      
      // Store session user in sessionStorage for tab isolation
      if (d.user?.id) {
        sessionStorage.setItem('purompto_session_user', d.user.id);
        sessionStorage.setItem('purompto_session_id', `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
      }
      
      window.location.href = "/home"; // Hard redirect after login
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setWorking(false);
    }
  };

  // Theme classes
  const theme = {
    bg: isDark ? "bg-black" : "bg-gray-100",
    text: isDark ? "text-white" : "text-gray-900",
    textMuted: isDark ? "text-white/60" : "text-gray-500",
    textMuted2: isDark ? "text-white/40" : "text-gray-400",
    border: "border-transparent",
    borderLight: "border-transparent",
    bgCard: isDark ? "bg-white/5" : "bg-white",
    bgCardHover: isDark ? "hover:bg-white/10" : "hover:bg-gray-50",
    bgInput: isDark ? "bg-black/30" : "bg-gray-50",
    bgHeader: isDark ? "bg-black/80" : "bg-white/90",
    modalBg: isDark ? "bg-zinc-900" : "bg-white",
  };

  // Loading state while checking auth
  if (checkingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.bg} ${theme.text}`}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text}`}>
      {/* Header */}
      <header className={`fixed top-0 left-0 right-0 z-40 ${theme.bgHeader} backdrop-blur-sm`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">Purompto</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className={`p-2 rounded-lg ${theme.bgCardHover} ${theme.textMuted} transition-colors`}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <Button size="sm" onClick={() => setShowAuth(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-sm">Login</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4 text-xs">AI-Powered</Badge>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Create perfect prompts with AI
          </h1>
          <p className={`text-lg ${theme.textMuted} mb-6`}>
            AI asks clarifying questions, then crafts prompts that work the first time.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => setShowAuth(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500">
              Login to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-1">Why Purompto?</h2>
            <p className={`${theme.textMuted} text-sm`}>Generate perfect prompts in seconds</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: MessageSquare, title: "Smart Questions", desc: "AI asks clarifying questions" },
              { icon: Target, title: "Precision Prompts", desc: "Works the first time" },
              { icon: Clock, title: "Save Time", desc: "Generate in seconds" }
            ].map((f, i) => (
              <div key={i} className={`p-5 rounded-xl ${theme.bgCard}`}>
                <f.icon className="w-6 h-6 text-emerald-400 mb-2" />
                <h3 className="font-semibold mb-1 text-sm">{f.title}</h3>
                <p className={`text-xs ${theme.textMuted2}`}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-1">How It Works</h2>
            <p className={`${theme.textMuted} text-sm`}>Three simple steps to perfect prompts</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Describe Your Need", desc: "Tell us what you want to achieve with your AI prompt" },
              { step: "2", title: "Answer Questions", desc: "Our AI asks clarifying questions to understand your exact requirements" },
              { step: "3", title: "Get Perfect Prompt", desc: "Receive a professionally crafted prompt that works the first time" }
            ].map((item, i) => (
              <div key={i} className={`p-5 rounded-xl ${theme.bgCard} text-center`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center mx-auto mb-3">
                  <span className="font-bold text-white">{item.step}</span>
                </div>
                <h3 className="font-semibold mb-1">{item.title}</h3>
                <p className={`text-xs ${theme.textMuted2}`}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className={`p-8 rounded-2xl ${theme.bgCard}`}>
            <Lightbulb className="w-10 h-10 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Ready to Get Started?</h2>
            <p className={`${theme.textMuted} text-sm mb-4`}>
              Contact us at <a href="mailto:robin241205@gmail.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">robin241205@gmail.com</a> to get access.
            </p>
            <Button onClick={() => setShowAuth(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500">
              Login Now
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={`py-8 px-4 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
        <div className="max-w-5xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">Purompto</span>
          </div>
          <p className={`text-xs ${theme.textMuted2} mb-2`}>© 2026 Purompto. All rights reserved.</p>
          <p className={`text-xs ${theme.textMuted}`}>
            Contact: <a href="mailto:robin241205@gmail.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">robin241205@gmail.com</a>
          </p>
        </div>
      </footer>

      {/* Login Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-sm ${theme.modalBg} border ${theme.border} rounded-xl p-5`}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Welcome Back</h3>
              <button onClick={() => setShowAuth(false)} className={`p-1 ${theme.bgCardHover} rounded`}><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <Input type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required className={`${theme.bgInput} ${theme.border}`} />
              <Input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} className={`${theme.bgInput} ${theme.border}`} />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <Button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500" disabled={working}>
                {working ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
              </Button>
            </form>
            <p className={`mt-4 text-center text-xs ${theme.textMuted2}`}>
              Don't have an account? Contact <a href="mailto:robin241205@gmail.com" className="text-emerald-400 hover:text-emerald-300 transition-colors">robin241205@gmail.com</a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
