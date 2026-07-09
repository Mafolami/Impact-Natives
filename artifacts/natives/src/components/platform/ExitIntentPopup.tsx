import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { X } from "lucide-react";

const STORAGE_KEY = "in_newsletter_dismissed";

export function ExitIntentPopup() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Don't show if signed in or already dismissed
    if (user) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    let triggered = false;

    function handleMouseLeave(e: MouseEvent) {
      if (triggered) return;
      if (e.clientY <= 20) {
        triggered = true;
        setTimeout(() => setVisible(true), 200);
      }
    }

    // Also show after 45 seconds if user hasn't left
    const timer = setTimeout(() => {
      if (!triggered && !localStorage.getItem(STORAGE_KEY)) {
        triggered = true;
        setVisible(true);
      }
    }, 45000);

    document.addEventListener("mouseleave", handleMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave);
      clearTimeout(timer);
    };
  }, [user]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("loading");
    setErrorMsg("");

    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase() });

    if (error) {
      if (error.code === "23505") {
        setState("success");
      } else {
        setErrorMsg("Something went wrong. Please try again.");
        setState("error");
      }
    } else {
      setState("success");
      localStorage.setItem(STORAGE_KEY, "1");
    }
  }

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Modal */}
                  <div style={{
        position: "fixed",
        zIndex: 50,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "calc(100% - 2rem)",
        maxWidth: "448px",
        animation: "slideUpFade 0.3s ease forwards",
      }}>
        <style>{`
          @keyframes slideUpFade {
            from { opacity: 0; transform: translate(-50%, calc(-50% + 16px)); }
            to   { opacity: 1; transform: translate(-50%, -50%); }
          }
        `}</style>

        <div className="bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl p-8 relative">
          {/* Close */}
          <button
            type="button"
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>

          {state === "success" ? (
            <div className="text-center py-4">
                            <div className="w-12 h-12 rounded-full bg-[#fdf0ea] flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="#C45C26" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">You're in.</h3>
              <p className="text-sm text-muted-foreground">
                We'll keep you close to what matters in Africa's impact economy.
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-[#C45C26] mb-2">
                  Native Signal
                </p>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  Before you go — stay in the loop.
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Partnership signals, ecosystem updates, and platform news. No noise. Join the builders shaping Africa's impact infrastructure.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="w-full h-11 rounded-full border border-border bg-background px-5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                />
                {state === "error" && (
                  <p className="text-xs text-red-500 px-2">{errorMsg}</p>
                )}
                <button
                  type="submit"
                  disabled={state === "loading"}
                                    className="w-full h-11 rounded-full bg-[#C45C26] hover:bg-[#a84e20] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {state === "loading" ? "Subscribing..." : "Subscribe to Native Signal"}
                </button>
              </form>

              <div className="flex items-center justify-between mt-4">
                <p className="text-xs text-muted-foreground">
                  No spam. Unsubscribe anytime.
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  No thanks
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
