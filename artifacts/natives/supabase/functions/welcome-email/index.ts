import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

serve(async (req) => {
  const payload = await req.json();
  const record = payload.record;
  const old = payload.old_record;

  if (!record?.email || !record?.onboarding_completed || old?.onboarding_completed === true) {
    return new Response("skipped", { status: 200 });
  }

  const isOrg = record.user_type === "organisation";
  const firstName = record.full_name?.split(" ")[0] || "there";

  const subject = isOrg
    ? `${firstName}, your organisation is live on Natives`
    : `${firstName}, your profile is live on Natives`;

  const GREEN = "#2D6A4F";
  const TERRACOTTA = "#C45C26";
  const BG = "#F7F5F2";
  const CARD = "#ffffff";
  const TEXT = "#111827";
  const MUTED = "#6b7280";

  const orgSteps = [
    {
      icon: "📋",
      title: "Post your first initiative",
      body: "Describe what you're working on and what kind of support you need. Funders and partners can find you and express interest directly.",
      cta: "Go to marketplace",
      href: "https://app.impactnatives.com/dashboard/marketplace",
    },
    {
      icon: "🤝",
      title: "Use Get Matched",
      body: "Describe what you're looking for in plain language. AI will identify suitable partners from the directory and surface your listing to potential matches.",
      cta: "Get matched",
      href: "https://app.impactnatives.com/dashboard/partnerships",
    },
    {
      icon: "🔍",
      title: "Browse the marketplace",
      body: "Find initiatives you can fund, partner on, or contribute to. Express interest directly and open a conversation.",
      cta: "Browse initiatives",
      href: "https://app.impactnatives.com/dashboard/marketplace",
    },
    {
      icon: "📊",
      title: "Complete your Impact Profile",
      body: "Add your track record — beneficiaries reached, grants delivered, previous funders. This data feeds directly into deal memos and CSR briefs that funders generate when reviewing your work.",
      cta: "Update profile",
      href: "https://app.impactnatives.com/dashboard/profile",
    },
  ];

  const individualSteps = [
    {
      icon: "✏️",
      title: "Complete your profile",
      body: "Add your sector focus, expertise, and country. The more specific your profile, the easier it is for the right organisations to find you.",
      cta: "Complete profile",
      href: "https://app.impactnatives.com/dashboard/profile",
    },
    {
      icon: "🔍",
      title: "Browse the marketplace",
      body: "Find initiatives that match your skills and interests. Express interest directly and open a conversation with the initiative lead.",
      cta: "Browse initiatives",
      href: "https://app.impactnatives.com/dashboard/marketplace",
    },
    {
      icon: "📋",
      title: "Post your own initiative",
      body: "Have a project or idea? Post it and connect with organisations, funders, and partners looking for what you bring.",
      cta: "Create initiative",
      href: "https://app.impactnatives.com/dashboard/marketplace",
    },
  ];

  const steps = isOrg ? orgSteps : individualSteps;

  const stepCards = steps.map(step => `
    <div style="background:${CARD};border-radius:12px;border:1px solid #e8e4df;padding:24px;margin-bottom:12px;">
      <div style="display:flex;align-items:flex-start;gap:16px;">
        <div style="font-size:24px;line-height:1;flex-shrink:0;margin-top:2px;">${step.icon}</div>
        <div style="flex:1;">
          <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:${TEXT};">${step.title}</p>
          <p style="margin:0 0 14px;font-size:14px;color:${MUTED};line-height:1.6;">${step.body}</p>
          <a href="${step.href}" style="display:inline-block;background:${GREEN};color:#ffffff;font-size:13px;font-weight:600;padding:8px 18px;border-radius:8px;text-decoration:none;">${step.cta} →</a>
        </div>
      </div>
    </div>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">

    <!-- Logo -->
    <div style="text-align:center;margin-bottom:32px;">
      <img src="https://app.impactnatives.com/logodarks.png" alt="Impact Natives" height="28" style="height:28px;width:auto;" />
    </div>

    <!-- Hero card -->
    <div style="background:${GREEN};border-radius:16px;padding:40px 36px;margin-bottom:24px;text-align:center;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.55);">
        Welcome to the ecosystem
      </p>
      <h1 style="margin:0 0 16px;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;letter-spacing:-0.02em;">
        Good to have you,<br/>${firstName}.
      </h1>
      <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.7);line-height:1.6;max-width:400px;margin:0 auto;">
        ${isOrg
          ? "Your organisation profile is live. Here is what to do next to get the most out of Natives."
          : "Your profile is live. Here is what to do next to connect with the right organisations and opportunities."
        }
      </p>
    </div>

    <!-- Steps -->
    <div style="margin-bottom:24px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:${MUTED};">
        Get started
      </p>
      ${stepCards}
    </div>

    <!-- Footer note -->
    <div style="background:${CARD};border-radius:12px;border:1px solid #e8e4df;padding:24px;margin-bottom:32px;">
      <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:${TEXT};">A note from Michael</p>
      <p style="margin:0;font-size:14px;color:${MUTED};line-height:1.65;">
        Natives is early and your feedback matters. If something doesn't work, or if there's a partner you think should be here, reply to this email. I read every message.
      </p>
    </div>

    <!-- Divider -->
    <div style="border-top:1px solid #e8e4df;margin-bottom:24px;"></div>

    <!-- Sign off -->
    <div style="margin-bottom:32px;">
      <p style="margin:0 0 4px;font-size:14px;color:${TEXT};font-weight:600;">Michael</p>
      <p style="margin:0;font-size:13px;color:${MUTED};">Founder, Impact Natives</p>
      <p style="margin:4px 0 0;font-size:13px;color:${MUTED};">
        <a href="https://impactnatives.com" style="color:${GREEN};text-decoration:none;">impactnatives.com</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="margin:0;font-size:12px;color:#c5c0bb;line-height:1.6;">
        You received this because you created an account on Impact Natives.<br/>
        <a href="https://app.impactnatives.com" style="color:#9ca3af;text-decoration:underline;">Visit the platform</a>
      </p>
    </div>

  </div>
</body>
</html>
  `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Michael from Impact Natives <welcome@impactnatives.com>",
      to: record.email,
      subject,
      html,
    }),
  });

  return new Response("ok", { status: 200 });
});