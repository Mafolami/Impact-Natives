import { Link, useSearch } from "wouter";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ContactForm = {
  first_name: string;
  last_name: string;
  email: string;
  organisation_name: string;
  job_title: string;
  reason: string;
  message: string;
};

export default function ContactPage() {
  const search = useSearch();
  const prefillReason = new URLSearchParams(search).get("reason") ?? "";
  const [form, setForm] = useState<ContactForm>({
    first_name: "",
    last_name: "",
    email: "",
    organisation_name: "",
    job_title: "",
    reason: prefillReason,
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailError, setEmailError] = useState("");

  function update(field: keyof ContactForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function validateEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(form.email)) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    setLoading(true);
    const { error } = await supabase.from("contact_submissions").insert({
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      organisation_name: form.organisation_name,
      job_title: form.job_title,
      reason: form.reason,
      message: form.message,
    });
    setLoading(false);
    if (error) {
      alert(error.message);
    } else {
      setSubmitted(true);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-32 text-center bg-background">
        <style>{`
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(32px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          .fade-up { animation: fadeUp 0.7s cubic-bezier(0.4,0,0.2,1) both; }
  
          .next-card {
            position: relative;
            border: 1px solid hsl(var(--border));
            border-radius: 20px;
            padding: 2.5rem 2rem;
            text-align: left;
            transition: border-color 0.25s, transform 0.25s, background 0.25s;
            overflow: hidden;
            display: block;
            color: inherit;
            text-decoration: none;
          }
          .next-card:hover {
            border-color: hsl(var(--foreground) / 0.35);
            background: hsl(var(--muted) / 0.4);
            transform: translateY(-5px);
          }
          .next-card .card-number {
            font-size: 5rem;
            font-weight: 800;
            line-height: 1;
            color: hsl(var(--foreground) / 0.05);
            position: absolute;
            bottom: 1rem;
            right: 1.5rem;
            font-variant-numeric: tabular-nums;
            pointer-events: none;
          }
          .next-card .card-tag {
            font-size: 0.7rem;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: hsl(var(--muted-foreground));
            margin-bottom: 1rem;
          }
          .next-card .card-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 0.75rem;
            letter-spacing: -0.02em;
            line-height: 1.3;
          }
          .next-card .card-desc {
            font-size: 0.875rem;
            line-height: 1.7;
            color: hsl(var(--muted-foreground));
            max-width: 28ch;
          }
          .next-card .card-arrow {
            margin-top: 2rem;
            font-size: 0.8rem;
            font-weight: 600;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            opacity: 0.35;
            transition: opacity 0.2s, gap 0.2s;
          }
          .next-card:hover .card-arrow {
            opacity: 1;
            gap: 10px;
          }
        `}</style>
  
        {/* Badge */}
        <div
          className="fade-up inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-muted-foreground border border-border rounded-full px-5 py-2 mb-10"
          style={{ animationDelay: "0ms" }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F] inline-block" />
          Message received
        </div>
  
        {/* Heading */}
        <div className="fade-up mb-6" style={{ animationDelay: "80ms" }}>
          <h2 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-5">
            What would you<br />like to do next?
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto">
            We'll be in touch shortly. In the meantime, there's more to explore.
          </p>
        </div>
  
        {/* Divider */}
        <div
          className="fade-up w-16 h-px bg-border mx-auto mb-16"
          style={{ animationDelay: "140ms" }}
        />
  
        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-3xl mb-20">
          {[
              {
                n: "01",
                tag: "Get started",
                title: "Create a profile",
                desc: "Join the network as an NGO, funder, founder, or corporate partner.",
                href: "/signup",
                cta: "Create account →",
                delay: 200,
              },
              {
                n: "02",
                tag: "Collaborate",
                title: "Partner with us",
                desc: "Submit a formal partnership request and get matched across Africa.",
                href: "/partner",
                cta: "Request a partnership →",
                delay: 280,
              },
              {
                n: "03",
                tag: "Discover",
                title: "Explore the platform",
                desc: "See how Impact Natives connects organisations, data, and capital.",
                href: "/platform/impact-marketplace",
                cta: "Browse the marketplace →",
                delay: 360,
              },
              {
                n: "04",
                tag: "Commission",
                title: "Innovation Lab",
                desc: "Sponsor a structured environment to solve systemic challenges in your sector.",
                href: "/labs/commission",
                cta: "Commission a Lab →",
                delay: 440,
              },
              ].map(({ n, tag, title, desc, href, cta, delay }) => (
            <Link
              key={n}
              href={href}
              className="next-card fade-up"
              style={{ animationDelay: `${delay}ms` }}
            >
              <p className="card-tag">{tag}</p>
              <p className="card-title">{title}</p>
              <p className="card-desc">{desc}</p>
              <p className="card-arrow">{cta}</p>
              <span className="card-number">{n}</span>
            </Link>
          ))}
        </div>
  
        {/* Back */}
        <button
          onClick={() => setSubmitted(false)}
          className="fade-up text-sm text-muted-foreground hover:text-foreground transition-colors tracking-wide"
          style={{ animationDelay: "520ms" }}
        >
          ← Send another message
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full max-w-xl mx-auto px-4 py-16 flex flex-col gap-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2">Contact us</h1>
        <p className="text-muted-foreground">
          Have a question or want to work together? Talk to us.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">First name</label>
            <Input
              placeholder="Enter first name"
              value={form.first_name}
              onChange={(e) => update("first_name", e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Last name</label>
            <Input
              placeholder="Enter last name"
              value={form.last_name}
              onChange={(e) => update("last_name", e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Email</label>
          <Input
            type="email"
            placeholder="hello@organisation.org"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            required
          />
          {emailError && <p className="text-red-500 text-xs">{emailError}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Organisation</label>
            <Input
              placeholder="Your organisation name"
              value={form.organisation_name}
              onChange={(e) => update("organisation_name", e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Job title</label>
            <Input
              placeholder="Your job title"
              value={form.job_title}
              onChange={(e) => update("job_title", e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Reason for contacting</label>
          <Select onValueChange={(val) => update("reason", val)} value={form.reason}>
            <SelectTrigger>
              <SelectValue placeholder="Select a reason" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="demo">Product demo</SelectItem>
              <SelectItem value="partnership">Partnership</SelectItem>
              <SelectItem value="inquiry">General inquiry</SelectItem>
              <SelectItem value="press">Press & media</SelectItem>
              <SelectItem value="support">Support</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Your message</label>
          <Textarea
            placeholder="Tell us what's on your mind..."
            className="min-h-[140px]"
            value={form.message}
            onChange={(e) => update("message", e.target.value)}
            required
          />
        </div>

        <Button
          type="submit"
          disabled={
            loading ||
            !form.first_name.trim() ||
            !form.last_name.trim() ||
            !form.email.trim() ||
            !form.reason ||
            !form.message.trim()
          }
        >
          {loading ? "Sending..." : "Send message"}
        </Button>
      </form>
    </div>
  );
}