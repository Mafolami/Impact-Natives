import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// ─── admin-review-notification ────────────────────────────────────────────
// Single shared function behind three Postgres webhook triggers, one per
// thing that becomes "pending admin review":
//   1. initiative_requests  INSERT  (status = 'pending')
//   2. organizations        INSERT  (status = 'pending')              -- new signup
//   3. organizations        UPDATE  (verification_status -> 'pending') -- verification request
// Each trigger passes Supabase's standard webhook payload
// { type, table, record, old_record, schema }, so this function branches on
// payload.table / payload.type to build the right email, same Resend call
// as contact-notification and partner-request-notification.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const TO_EMAILS = ["michafolami@gmail.com", "admin@impactnatives.com"];
const FROM_EMAIL = "noreply@impactnatives.com";
const ADMIN_URL = "https://app.impactnatives.com/admin";

function row(label: string, value: unknown) {
  const v = value === null || value === undefined || value === "" ? "—" : String(value);
  return `<tr><td style="padding:8px;border:1px solid #eee;font-weight:600">${label}</td><td style="padding:8px;border:1px solid #eee">${v}</td></tr>`;
}

function wrap(heading: string, rows: string) {
  return `
    <h2>${heading}</h2>
    <table style="border-collapse:collapse;width:100%">${rows}</table>
    <p style="margin-top:24px"><a href="${ADMIN_URL}" style="background:#2D6A4F;color:white;padding:10px 20px;border-radius:6px;text-decoration:none">Review in Admin Panel</a></p>
  `;
}

function buildEmail(payload: { table: string; type: string; record: Record<string, any> }) {
  const { table, type, record } = payload;

  if (table === "initiative_requests") {
    const html = wrap(
      "New Initiative Submitted for Review",
      row("Title", record.title) +
        row("Submitted by", record.submitter_name) +
        row("Submitter org", record.submitter_org) +
        row("Submitter email", record.submitter_email) +
        row("Sectors", Array.isArray(record.sectors) ? record.sectors.join(", ") : record.sectors) +
        row("Locations", Array.isArray(record.locations) ? record.locations.join(", ") : record.locations) +
        row("Budget", record.budget) +
        row("Submitted", record.created_at ? new Date(record.created_at).toLocaleString() : null)
    );
    return { subject: `New Initiative Pending Review — ${record.title ?? "Untitled"}`, html };
  }

  if (table === "organizations" && type === "INSERT") {
    const orgName = record.organisation_name || record.name;
    const html = wrap(
      "New Organization Signup Pending Review",
      row("Organization", orgName) +
        row("Type", record.organisation_type) +
        row("Country", record.country) +
        row("Website", record.website) +
        row("Email", record.email) +
        row("Submitted", record.created_at ? new Date(record.created_at).toLocaleString() : null)
    );
    return { subject: `New Organization Pending Review — ${orgName ?? "Unnamed"}`, html };
  }

  if (table === "organizations" && type === "UPDATE") {
    const orgName = record.organisation_name || record.name;
    const html = wrap(
      "Organization Requesting Verification",
      row("Organization", orgName) +
        row("Type", record.organisation_type) +
        row("Country", record.country) +
        row("Website", record.website) +
        row("Email", record.email)
    );
    return { subject: `Verification Requested — ${orgName ?? "Unnamed"}`, html };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const payload = await req.json();
  const email = buildEmail(payload);
  if (!email) {
    // Unknown table/type combination -- don't fail the trigger, just no-op.
    return new Response(JSON.stringify({ skipped: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: TO_EMAILS,
      subject: email.subject,
      html: email.html,
    }),
  });

  const data = await res.json();
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
