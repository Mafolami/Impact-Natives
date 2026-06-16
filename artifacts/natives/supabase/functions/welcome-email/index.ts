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
    ? "Your organisation profile is live on Natives"
    : "Your profile is live on Natives";

  const body = isOrg
    ? `
<p>Hi ${firstName},</p>

<p>Your organisation profile on Natives is live. Here is what you can do next:</p>

<ul>
  <li>Post an initiative on the marketplace and receive expressions of interest from funders and partners</li>
  <li>Browse verified organisations and find the right partners for your work</li>
  <li>Submit a verification request to get your organisation badged as verified</li>
  <li>Use the Get Matched feature and let Natives facilitate a partner introduction on your behalf</li>
</ul>

<p>As one of our founding members, you also qualify for a free Partner Discovery Report. Natives will review your profile and initiative, identify 5 to 10 suitable partners, and send you a curated shortlist with a rationale for each match.</p>

<p>To claim yours, reply to this email with a brief description of what you are working on and who you are looking to partner with.</p>

<p>This offer is available to the first 30 verified organisations on the platform.</p>

<p>Welcome to the ecosystem.</p>

<p>Michael<br/>Impact Natives</p>
    `
    : `
<p>Hi ${firstName},</p>

<p>Your profile on Natives is live. Here is what you can do next:</p>

<ul>
  <li>Complete your profile with your sector focus and areas of expertise so the right organisations can find you</li>
  <li>Browse initiatives on the marketplace and express interest in ones that match your work</li>
  <li>Post your own initiative and connect with organisations and funders looking for what you bring</li>
</ul>

<p>Welcome to the ecosystem.</p>

<p>Michael<br/>Impact Natives</p>
    `;

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Michael at Natives <welcome@impactnatives.com>",
      to: record.email,
      subject,
      html: body,
    }),
  });

  return new Response("ok", { status: 200 });
});