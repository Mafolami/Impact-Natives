import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [, navigate]          = useLocation();
  const [password, setPassword]         = useState("");
  const [confirm, setConfirm]           = useState("");
  const [loading, setLoading]           = useState(false);
  const [done, setDone]                 = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // Supabase fires SIGNED_IN with type PASSWORD_RECOVERY when the reset link is clicked
    useEffect(() => {
    // Session is already established via AuthCallback — mark ready immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
      else navigate("/forgot-password");
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate("/signin"), 3000);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
        <img src="/logo.png" alt="Impact Natives" className="h-8 w-auto mb-4" />
          <h1 className="text-2xl font-semibold text-foreground">Set new password</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Choose a new password for your account.
          </p>
        </div>

        {done ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <div className="flex justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#2D6A4F]" />
            </div>
            <p className="text-sm font-medium text-foreground">Password updated</p>
            <p className="text-sm text-muted-foreground">
              Redirecting you to sign in...
            </p>
          </div>
        ) : !sessionReady ? (
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
            <Loader2 className="w-6 h-6 text-[#2D6A4F] animate-spin mx-auto" />
            <p className="text-sm text-muted-foreground">Verifying reset link...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password" className="text-sm font-medium">New password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 h-11"
                placeholder="At least 8 characters"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm" className="text-sm font-medium">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="mt-1 h-11"
                placeholder="Repeat your new password"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                {error}
              </p>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#2D6A4F] hover:bg-[#245c43] text-white font-medium"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
