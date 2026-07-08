import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "noreply@impactnatives.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(JSON.stringify({ error: "Email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: "Welcome to Native Signal from Impact Natives",
        html: `
          <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #ffffff;">
            <h1 style="font-size: 24px; font-weight: 700; color: #0a0a0a; margin: 0 0 12px;">
              You're on the list.
            </h1>
            <p style="font-size: 16px; color: #555; line-height: 1.7; margin: 0 0 24px;">
              // REPLACE
              Welcome to Native Signal, the Impact Natives monthly newsletter covering ecosystem intelligence, partnership signals, and platform updates across Africa's impact economy. No noise, no filler.
            </p>
            <p style="font-size: 16px; color: #555; line-height: 1.7; margin: 0 0 32px;">
              We'll be in touch when something worth reading happens.
            </p>
            <a href="https://app.impactnatives.com" style="display: inline-block; background: #2D6A4F; color: #ffffff; font-size: 14px; font-weight: 600; padding: 12px 28px; border-radius: 9999px; text-decoration: none;">
              Explore the platform →
            </a>
            <div style="margin-top: 48px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
              <p style="font-size: 12px; color: #999; margin: 0;">
                Impact Natives · Lagos, Nigeria
              </p>
            </div>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});