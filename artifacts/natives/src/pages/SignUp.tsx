import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

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
  const logoRef = useRef<HTMLAnchorElement>(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const passwordStrength = password.length === 0 ? null
    : password.length < 8 ? "weak"
    : password.length < 12 && !/[^a-zA-Z0-9]/.test(password) ? "medium"
    : "strong"
  const strengthColor = { weak: "#ef4444", medium: "#f59e0b", strong: "#2D6A4F" }
  const strengthLabel = { weak: "Too short", medium: "Could be stronger", strong: "Strong" }
  const formValid = emailValid && password.length >= 8 && password === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!emailValid) { setError("Please enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }

    setLoading(true);
    const { error } = await signUp(email, password);
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) sessionStorage.setItem("redirectAfterAuth", redirect);
    await signInWithGoogle();
  }

  if (done) {
    return (
      <div className="light min-h-screen bg-[#F9F7F4] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-12 h-12 text-[#2D6A4F] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Check your email</h2>
          <p className="text-gray-500 text-sm leading-relaxed">
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
          </p>
          <Link href="/signin">
            <Button className="mt-6 bg-[#2D6A4F] hover:bg-[#245c43] text-white">
              Go to sign in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 py-4">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Impact Natives
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8">
          <img src="/logo.png" alt="Impact Natives" className="h-8 w-auto mb-4" />

            <h1 className="text-2xl font-semibold text-foreground">Create an account</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Already have one?{" "}
              <Link href="/signin" className="text-[#2D6A4F] hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full mb-4 h-11"
            onClick={handleGoogle}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs text-muted-foreground">
              <span className="bg-background px-3">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
            <Label htmlFor="email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 h-11"
                placeholder="you@organisation.com"
                required
              />
            </div>

            <div>
            <Label htmlFor="password" className="text-sm font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11"
                placeholder="Min. 8 characters"
                required
              />
              {passwordStrength && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {["weak", "medium", "strong"].map((s, i) => (
                      <div key={s} className="h-1 flex-1 rounded-full transition-colors"
                        style={{ background: ["weak","medium","strong"].indexOf(passwordStrength) >= i ? strengthColor[passwordStrength] : "#e5e7eb" }} />
                    ))}
                  </div>
                  <span className="text-xs" style={{ color: strengthColor[passwordStrength] }}>
                    {strengthLabel[passwordStrength]}
                  </span>
                </div>
              )}
            </div>
            <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 h-11"
                placeholder="Re-enter your password"
                required
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match.</p>
              )}
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          
          <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-0.5 accent-[#2D6A4F]"
              />
              <label htmlFor="terms" className="text-xs text-muted-foreground leading-relaxed">
                I agree to Impact Natives'{" "}
                <a href="/legal/terms" target="_blank" className="text-[#2D6A4F] hover:underline underline-offset-2">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/legal/privacy" target="_blank" className="text-[#2D6A4F] hover:underline underline-offset-2">
                  Privacy Policy
                </a>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !formValid}
              className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create account
            </Button>

            
          </form>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}