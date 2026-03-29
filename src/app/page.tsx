"use client";
import { useState, useEffect } from "react";
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
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  // Check if already logged in
  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d.user) {
          sessionStorage.setItem('purompto_session_user', d.user.id);
          sessionStorage.setItem('purompto_session_id', `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
          window.location.href = "/home";
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
      
      if (d.user?.id) {
        sessionStorage.setItem('purompto_session_user', d.user.id);
        sessionStorage.setItem('purompto_session_id', `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`);
      }
      
      window.location.href = "/home";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setWorking(false);
    }
  };

  // Loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-100" data-theme={isDark ? "dark" : "light"}>
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content" data-theme={isDark ? "dark" : "light"}>
      {/* Header - daisyUI navbar */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-base-100/80 backdrop-blur-sm border-b border-base-300">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-lg w-8">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <span className="font-bold text-lg">Purompto</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDark(!isDark)}
              className="btn btn-ghost btn-sm btn-circle"
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={() => setShowAuth(true)} className="btn btn-primary btn-sm">
              Login
            </button>
          </div>
        </div>
      </header>

      {/* Hero - daisyUI hero component */}
      <section className="pt-28 pb-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div className="badge badge-primary badge-outline badge-lg mb-4">AI-Powered</div>
          <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">
            Create perfect prompts with AI
          </h1>
          <p className="text-lg text-base-content/60 mb-6">
            AI asks clarifying questions, then crafts prompts that work the first time.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowAuth(true)} className="btn btn-primary btn-lg gap-2">
              Login to Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold mb-1">Why Purompto?</h2>
            <p className="text-base-content/60 text-sm">Generate perfect prompts in seconds</p>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: MessageSquare, title: "Smart Questions", desc: "AI asks clarifying questions" },
              { icon: Target, title: "Precision Prompts", desc: "Works the first time" },
              { icon: Clock, title: "Save Time", desc: "Generate in seconds" }
            ].map((f, i) => (
              <div key={i} className="card card-border border-base-300 bg-base-200">
                <div className="card-body">
                  <f.icon className="w-8 h-8 text-primary mb-2" />
                  <h3 className="card-title text-sm">{f.title}</h3>
                  <p className="text-xs text-base-content/60">{f.desc}</p>
                </div>
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
            <p className="text-base-content/60 text-sm">Three simple steps to perfect prompts</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: "1", title: "Describe Your Need", desc: "Tell us what you want to achieve with your AI prompt" },
              { step: "2", title: "Answer Questions", desc: "Our AI asks clarifying questions to understand your exact requirements" },
              { step: "3", title: "Get Perfect Prompt", desc: "Receive a professionally crafted prompt that works the first time" }
            ].map((item, i) => (
              <div key={i} className="card card-border border-base-300 bg-base-200">
                <div className="card-body items-center text-center">
                  <div className="avatar placeholder">
                    <div className="bg-primary text-primary-content rounded-full w-12">
                      <span className="text-xl font-bold">{item.step}</span>
                    </div>
                  </div>
                  <h3 className="card-title">{item.title}</h3>
                  <p className="text-xs text-base-content/60">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4">
        <div className="max-w-xl mx-auto text-center">
          <div className="card card-border border-primary bg-primary/10">
            <div className="card-body">
              <Lightbulb className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="card-title justify-center text-xl">Ready to Get Started?</h2>
              <p className="text-base-content/60 text-sm mb-4">
                Contact us at <a href="mailto:robin241205@gmail.com" className="link link-primary">robin241205@gmail.com</a> to get access.
              </p>
              <div className="card-actions justify-center">
                <button onClick={() => setShowAuth(true)} className="btn btn-primary">
                  Login Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer footer-center py-8 px-4 border-t border-base-300">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-lg w-6">
                <Sparkles className="w-3 h-3" />
              </div>
            </div>
            <span className="font-semibold text-sm">Purompto</span>
          </div>
          <p className="text-xs text-base-content/50 mb-2">© 2026 Purompto. All rights reserved.</p>
          <p className="text-xs text-base-content/60">
            Contact: <a href="mailto:robin241205@gmail.com" className="link link-primary">robin241205@gmail.com</a>
          </p>
        </div>
      </footer>

      {/* Login Modal - daisyUI modal */}
      {showAuth && (
        <div className="modal modal-open">
          <div className="modal-box">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Welcome Back</h3>
              <button onClick={() => setShowAuth(false)} className="btn btn-sm btn-circle btn-ghost">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleLogin} className="space-y-3">
              <input 
                type="email" 
                placeholder="Email" 
                className="input input-bordered w-full" 
                value={form.email} 
                onChange={e => setForm({ ...form, email: e.target.value })} 
                required 
              />
              <input 
                type="password" 
                placeholder="Password" 
                className="input input-bordered w-full" 
                value={form.password} 
                onChange={e => setForm({ ...form, password: e.target.value })} 
                required 
                minLength={6} 
              />
              {error && <div className="alert alert-error text-xs">{error}</div>}
              <button type="submit" className="btn btn-primary w-full" disabled={working}>
                {working ? <span className="loading loading-spinner loading-sm"></span> : "Sign In"}
              </button>
            </form>
            <p className="mt-4 text-center text-xs text-base-content/60">
              Don't have an account? Contact <a href="mailto:robin241205@gmail.com" className="link link-primary">robin241205@gmail.com</a>
            </p>
          </div>
          <div className="modal-backdrop bg-black/50" onClick={() => setShowAuth(false)}></div>
        </div>
      )}
    </div>
  );
}
