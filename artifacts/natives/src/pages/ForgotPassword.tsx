import { useState } from "react";
import { Link } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="px-6 py-4">
        <Link href="/signin" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <img src="/logo.png" alt="Impact Natives" className="h-8 w-auto mb-4" />
            <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Enter your email and we'll send you a reset link.
            </p>
          </div>

          {sent ? (
            <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
              <div className="flex justify-center">
                <CheckCircle2 className="w-10 h-10 text-[#2D6A4F]" />
              </div>
              <p className="text-sm font-medium text-foreground">Check your inbox</p>
              <p className="text-sm text-muted-foreground">
                We sent a reset link to <span className="font-medium text-foreground">{email}</span>. It expires in 1 hour.
              </p>
              <Link href="/signin" className="text-sm text-[#2D6A4F] hover:underline block mt-2">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
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
                Send reset link
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
