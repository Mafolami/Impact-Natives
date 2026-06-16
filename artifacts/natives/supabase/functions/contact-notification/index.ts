import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TO_EMAIL = "contact@impactnatives.com";
const FROM_EMAIL = "noreply@impactnatives.com";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const payload = await req.json();
  const record = payload.record;

  const html = `
    <h2>New Contact Form Submission</h2>
    <table style="border-collapse:collapse;width:100%">
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:600">Name</td><td style="padding:8px;border:1px solid #eee">${record.first_name} ${record.last_name}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:600">Email</td><td style="padding:8px;border:1px solid #eee">${record.email}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:600">Reason</td><td style="padding:8px;border:1px solid #eee">${record.reason}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:600">Message</td><td style="padding:8px;border:1px solid #eee">${record.message}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:600">Submitted</td><td style="padding:8px;border:1px solid #eee">${new Date(record.created_at).toLocaleString()}</td></tr>
    </table>
    <p style="margin-top:24px"><a href="https://app.impactnatives.com/admin" style="background:#2D6A4F;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">View in Admin Panel</a></p>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: TO_EMAIL,
      subject: `New Contact Message — ${record.first_name} ${record.last_name} (${record.reason})`,
      html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});