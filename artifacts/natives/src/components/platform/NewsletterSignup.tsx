import { useState } from "react";
import React from "react";
import { supabase } from "@/lib/supabase";

export function NewsletterSignup({ variant = "section" }: { variant?: "section" | "footer" }): React.ReactElement {
  const [email, setEmail] = useState("");
  const [name, setName]   = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrorMsg("");

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase(), name: name.trim() || null });

      if (error) {
        console.error("Newsletter insert error:", error);
        if (error.code === "23505") {
          setState("success");
        } else {
          setErrorMsg(error.message);
          setState("error");
        }
      } else {
      try {
        await supabase.functions.invoke("newsletter-confirmation", {
          body: { email: email.trim().toLowerCase() },
        });
      } catch (e) {
        console.error("Confirmation email failed:", e);
      }
      setState("success");
    }
  }

  if (variant === "footer") {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-white">Subscribe to our newsletter</p>
        {state === "success" ? (
          <p className="text-sm text-[#6fcf97]">You're subscribed. Welcome.</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className={`w-full h-9 rounded-lg bg-white/10 border border-white/20 px-3 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors ${name ? 'text-white' : 'text-white/40'}`}
            />
            <div className="flex flex-row gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className={`flex-1 h-9 rounded-lg bg-white/10 border border-white/20 px-3 text-sm placeholder:text-white/40 focus:outline-none focus:border-white/40 transition-colors ${email ? 'text-white' : 'text-white/40'}`}
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="h-9 px-4 rounded-lg bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-medium transition-colors disabled:opacity-50 shrink-0"
            >
              {state === "loading" ? "..." : "Subscribe"}
            </button>
            </div>
          </form>
        )}
        {state === "error" && (
          <p className="text-xs text-red-400">{errorMsg}</p>
        )}
      </div>
    );
  }

  return (
    <section className="py-20 border-t border-border">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Native Signal
        </p>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-3">
          Native Signal: Stay close to what's moving in Africa's impact economy.
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Partnership signals, ecosystem updates, and platform news delivered straight to your inbox.
        </p>
        {state === "success" ? (
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[rgba(45,106,79,0.12)] text-[#2D6A4F] text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            You're on the list.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md mx-auto">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First name"
              className="w-full h-12 rounded-full border border-border px-5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground"
            />
            <div className="flex flex-row gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="flex-1 h-12 rounded-full border border-border px-5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground bg-background text-foreground"
            />
            <button
              type="submit"
              disabled={state === "loading"}
              className="h-12 px-7 rounded-full bg-[#2D6A4F] hover:bg-[#245c43] text-white text-sm font-semibold transition-colors disabled:opacity-50 shrink-0"
            >
              {state === "loading" ? "Subscribing..." : "Subscribe"}
            </button>
            </div>
          </form>
        )}
        {state === "error" && (
          <p className="text-sm text-red-500 mt-3">{errorMsg}</p>
        )}
        <p className="text-xs text-muted-foreground mt-4">
          No spam. Unsubscribe anytime.{" "}
          <a href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">
            Privacy Policy
          </a>
        </p>
      </div>
    </section>
  );
}