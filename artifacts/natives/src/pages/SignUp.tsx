import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function SignUp() {
  const [, navigate] = useLocation();
  const { signUp, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [done, setDone] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordStrength = password.length === 0 ? null
    : password.length < 8 ? "weak"
    : password.length < 12 && !/[^a-zA-Z0-9]/.test(password) ? "medium"
    : "strong";
  const strengthColor = { weak: "#ef4444", medium: "#d97706", strong: "#2D6A4F" };
  const strengthLabel = { weak: "Too short", medium: "Could be stronger", strong: "Strong" };
  const formValid = emailValid && password.length >= 8 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailValid) { setError("Please enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) { setError(error.message); } else { setDone(true); }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) sessionStorage.setItem("redirectAfterAuth", redirect);
    await signInWithGoogle();
  }

  const inputBaseStyle = {
    width: "100%", height: "44px", borderRadius: "10px",
    border: "1.5px solid #e5e7eb", background: "#fafaf9",
    padding: "0 14px", fontSize: "0.9rem", color: "#111827",
    outline: "none", boxSizing: "border-box" as const, transition: "all 0.15s",
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#2D6A4F";
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(45,106,79,0.1)";
    e.currentTarget.style.background = "#ffffff";
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "#e5e7eb";
    e.currentTarget.style.boxShadow = "none";
    e.currentTarget.style.background = "#fafaf9";
  };

  if (done) {
    return (
      <div className="light min-h-screen flex items-center justify-center px-6"
        style={{ background: "#F7F5F2" }}>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{
            width: "60px", height: "60px", borderRadius: "50%",
            background: "#eaf5ee", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
          }}>
            <CheckCircle2 size={28} style={{ color: "#2D6A4F" }} />
          </div>
          <h2 style={{
            fontSize: "1.625rem", fontWeight: 700,
            color: "#0d1f17", letterSpacing: "-0.02em", marginBottom: "12px",
          }}>
            Check your email
          </h2>
          <p style={{ fontSize: "0.9rem", lineHeight: 1.65, color: "#6b7280", marginBottom: "32px" }}>
            We sent a confirmation link to{" "}
            <strong style={{ color: "#111827" }}>{email}</strong>.
            Click it to activate your account, then sign in.
          </p>
          <Link href="/signin">
            <button style={{
              height: "44px", padding: "0 32px", borderRadius: "10px",
              background: "#2D6A4F", color: "white",
              fontSize: "0.9rem", fontWeight: 600, border: "none", cursor: "pointer",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#245c43"}
              onMouseLeave={e => e.currentTarget.style.background = "#2D6A4F"}>
              Go to sign in
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="light min-h-screen flex" style={{ background: "#F7F5F2" }}>

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[520px] shrink-0 flex-col justify-between relative overflow-hidden"
        style={{ background: "#1B3D2B", padding: "56px 52px" }}>

        <div className="absolute top-0 right-0 w-px h-full"
          style={{ background: "rgba(255,255,255,0.06)" }} />

        <a href="https://impactnatives.com" className="block w-fit">
          <img src="/logo.png" alt="Impact Natives"
            className="h-8 w-auto brightness-0 invert" style={{ opacity: 0.9 }} />
        </a>

        <div style={{ marginBottom: "auto", marginTop: "150px" }}>
          <p style={{
            fontSize: "0.75rem", fontWeight: 600,
            textTransform: "uppercase" as const, letterSpacing: "0.16em",
            color: "#C45C26", marginBottom: "20px",
          }}>
            Join Impact Natives
          </p>

          <h2 style={{
            fontSize: "clamp(2rem, 3.2vw, 2.75rem)",
            fontWeight: 700, lineHeight: 1.18,
            color: "#ffffff", marginBottom: "20px",
            letterSpacing: "-0.02em",
          }}>
            The ecosystem is open<br />
          </h2>

          <p style={{
            fontSize: "1.0625rem", lineHeight: 1.7,
            color: "rgba(255,255,255,0.55)",
            maxWidth: "360px", marginBottom: "0",
          }}>
            For organisations working in Africa.<br />
            For the funders and partners who back them.
          </p>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "28px" }}>
          <p style={{
            fontSize: "0.9rem", fontStyle: "italic",
            color: "rgba(255,255,255,0.3)", lineHeight: 1.6,
          }}>
            "Opportunity should not depend on who you know."
          </p>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col justify-center overflow-y-auto"
        style={{ padding: "48px 40px", background: "#F7F5F2" }}>

        <div className="lg:hidden" style={{ marginBottom: "40px" }}>
          <a href="https://impactnatives.com">
            <img src="/logodarks.png" alt="Impact Natives" className="h-8 w-auto" />
          </a>
        </div>

        <div style={{ width: "100%", maxWidth: "400px", margin: "0 auto" }}>

          <div style={{ marginBottom: "32px" }}>
            <h1 style={{
              fontSize: "1.875rem", fontWeight: 700,
              color: "#0d1f17", letterSpacing: "-0.02em", marginBottom: "8px",
            }}>
              Create an account
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
              Already have one?{" "}
              <Link href="/signin"
                style={{ color: "#2D6A4F", fontWeight: 600, textDecoration: "none" }}
                className="hover:underline underline-offset-2">
                Sign in
              </Link>
            </p>
          </div>

          <div style={{
            background: "#ffffff", borderRadius: "16px",
            border: "1px solid #e8e4df", padding: "28px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
          }}>

            {/* Google */}
            <button type="button" onClick={handleGoogle} disabled={googleLoading}
              style={{
                width: "100%", height: "44px", borderRadius: "10px",
                border: "1px solid #e5e7eb", background: "#ffffff",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "10px", fontSize: "0.9rem", fontWeight: 500,
                color: "#374151", cursor: "pointer", marginBottom: "20px",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
              onMouseLeave={e => e.currentTarget.style.background = "#ffffff"}>
              {googleLoading ? <Loader2 size={16} className="animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{ flex: 1, height: "1px", background: "#f0ede8" }} />
              <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>or</span>
              <div style={{ flex: 1, height: "1px", background: "#f0ede8" }} />
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              <div>
                <label htmlFor="email" style={{
                  display: "block", fontSize: "0.8rem", fontWeight: 600,
                  textTransform: "uppercase" as const, letterSpacing: "0.06em",
                  color: "#9ca3af", marginBottom: "6px",
                }}>Email</label>
                <input id="email" type="email" autoComplete="email" required
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@organisation.com"
                  style={inputBaseStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label htmlFor="password" style={{
                  display: "block", fontSize: "0.8rem", fontWeight: 600,
                  textTransform: "uppercase" as const, letterSpacing: "0.06em",
                  color: "#9ca3af", marginBottom: "6px",
                }}>Password</label>
                <input id="password" type="password" autoComplete="new-password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={inputBaseStyle} onFocus={onFocus} onBlur={onBlur} />
                {passwordStrength && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <div style={{ display: "flex", gap: "4px", flex: 1 }}>
                      {["weak", "medium", "strong"].map((s, i) => (
                        <div key={s} style={{
                          height: "3px", flex: 1, borderRadius: "99px",
                          background: ["weak","medium","strong"].indexOf(passwordStrength) >= i
                            ? strengthColor[passwordStrength] : "#e5e7eb",
                          transition: "background 0.2s",
                        }} />
                      ))}
                    </div>
                    <span style={{ fontSize: "0.75rem", color: strengthColor[passwordStrength] }}>
                      {strengthLabel[passwordStrength]}
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" style={{
                  display: "block", fontSize: "0.8rem", fontWeight: 600,
                  textTransform: "uppercase" as const, letterSpacing: "0.06em",
                  color: "#9ca3af", marginBottom: "6px",
                }}>Confirm password</label>
                <input id="confirmPassword" type="password" autoComplete="new-password" required
                  value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  style={inputBaseStyle} onFocus={onFocus} onBlur={onBlur} />
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p style={{ fontSize: "0.8rem", color: "#ef4444", marginTop: "6px" }}>
                    Passwords do not match.
                  </p>
                )}
              </div>

              {error && (
                <div style={{
                  borderRadius: "10px", border: "1px solid #fecaca",
                  background: "#fef2f2", padding: "12px 16px",
                  fontSize: "0.875rem", color: "#b91c1c",
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <input type="checkbox" id="terms" required
                  style={{ marginTop: "2px", accentColor: "#2D6A4F", flexShrink: 0 }} />
                <label htmlFor="terms"
                  style={{ fontSize: "0.8rem", color: "#9ca3af", lineHeight: 1.55, cursor: "pointer" }}>
                  I agree to Impact Natives'{" "}
                  <a href="/legal/terms" target="_blank"
                    style={{ color: "#6b7280", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                    Terms
                  </a>{" "}and{" "}
                  <a href="/legal/privacy" target="_blank"
                    style={{ color: "#6b7280", textDecoration: "underline", textUnderlineOffset: "2px" }}>
                    Privacy Policy
                  </a>
                </label>
              </div>

              <button type="submit" disabled={loading || !formValid}
                style={{
                  width: "100%", height: "44px", borderRadius: "10px",
                  background: "#2D6A4F", color: "white",
                  fontSize: "0.9rem", fontWeight: 600, border: "none",
                  cursor: loading || !formValid ? "not-allowed" : "pointer",
                  opacity: !formValid ? 0.45 : loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  transition: "background 0.15s",
                  marginTop: "4px",
                }}
                onMouseEnter={e => !loading && formValid && (e.currentTarget.style.background = "#245c43")}
                onMouseLeave={e => (e.currentTarget.style.background = "#2D6A4F")}>
                {loading && <Loader2 size={16} className="animate-spin" />}
                Create account
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
