// supabase/functions/invite-team-member/index.ts
//
// v7 (14 Oct 2026): legacy JWT keys disabled after a leak. Uses the new
// publishable key (caller-scoped client) and secret key (service client).
// No logic change.
//
// Invites someone onto the caller's org team, whether or not they already
// have an Impact Natives account. If the email matches an existing,
// CONFIRMED profile, use that user_id directly (in-app notification only).
// Otherwise auth.admin.inviteUserByEmail() creates/re-sends.
//
// Note: handle_new_user inserts a profiles row the instant
// inviteUserByEmail() creates the auth.users row, so always check
// email_confirmed_at too.
//
// Only the org Owner can invite (org_members_owner_write RLS is the real
// enforcement). is_mou_signer optional, default false.
//
// Seat cap: SEATS_INCLUDED, uniform across tiers until seat add-on billing
// exists.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function __envKeys(name: string): Record<string, string> {
  try { return JSON.parse(Deno.env.get(name) ?? "{}"); } catch { return {}; }
}
const SECRET_KEY = __envKeys("SUPABASE_SECRET_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_SECRET_KEYS"))[0] ?? "";
const PUBLISHABLE_KEY = __envKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Object.values(__envKeys("SUPABASE_PUBLISHABLE_KEYS"))[0] ?? "";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = PUBLISHABLE_KEY;
const SUPABASE_SERVICE_ROLE_KEY = SECRET_KEY;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Included seats beyond the Owner, uniform across all tiers until a paid
// seat add-on is wired up. Occupied = 'pending' + 'active' org_members rows;
// 'revoked' rows don't count against this.
const SEATS_INCLUDED = 1;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const body = await req.json().catch(() => ({}));
    const rawEmail = typeof body.invited_email === "string" ? body.invited_email : "";
    const email = rawEmail.trim().toLowerCase();
    const seatLabel = (typeof body.seat_label === "string" && body.seat_label.trim()) || "Associate";
    const isMouSigner = body.is_mou_signer === true;

    if (!email || !EMAIL_RE.test(email)) {
      return new Response(JSON.stringify({ error: "A valid email address is required" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: org, error: orgError } = await callerClient
      .from("organizations")
      .select("id, organisation_name")
      .eq("user_id", user.id)
      .maybeSingle();

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: "Only an organisation owner can invite team members" }), {
        status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    if (user.email && user.email.toLowerCase() === email) {
      return new Response(JSON.stringify({ error: "You can't invite yourself" }), {
        status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let isConfirmed = false;
    if (existingProfile) {
      const { data: authUserData } = await serviceClient.auth.admin.getUserById(existingProfile.id);
      isConfirmed = !!authUserData?.user?.email_confirmed_at;
    }

    let targetUserId: string;
    let isNewAccount = false;
    let inviteEmailSent = false;

    if (existingProfile && isConfirmed) {
      targetUserId = existingProfile.id;
    } else {
      const { data: inviteData, error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: { invited_to_org_name: org.organisation_name },
      });
      if (inviteError || !inviteData?.user) {
        return new Response(JSON.stringify({ error: `Could not invite ${email}: ${inviteError?.message ?? "unknown error"}` }), {
          status: 502, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
      targetUserId = inviteData.user.id;
      isNewAccount = !existingProfile;
      inviteEmailSent = true;
    }

    const { data: existingMembership } = await serviceClient
      .from("org_members")
      .select("status")
      .eq("org_id", org.id)
      .eq("user_id", targetUserId)
      .maybeSingle();

    if (existingMembership?.status === "active") {
      return new Response(JSON.stringify({ error: `${email} is already an active team member` }), {
        status: 409, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    const isResendOfPending = existingMembership?.status === "pending";
    if (!isResendOfPending) {
      const { count: occupiedSeats, error: countError } = await serviceClient
        .from("org_members")
        .select("id", { count: "exact", head: true })
        .eq("org_id", org.id)
        .in("status", ["pending", "active"]);

      if (countError) {
        return new Response(JSON.stringify({ error: `Could not verify seat availability: ${countError.message}` }), {
          status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }

      if ((occupiedSeats ?? 0) >= SEATS_INCLUDED) {
        return new Response(JSON.stringify({
          error: `Your team is at its seat limit (${SEATS_INCLUDED} included). Remove an existing member before inviting someone new.`,
          seat_limit_reached: true,
          seats_included: SEATS_INCLUDED,
        }), {
          status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
        });
      }
    }

    const { error: upsertError } = await serviceClient
      .from("org_members")
      .upsert({
        org_id: org.id,
        user_id: targetUserId,
        seat_label: seatLabel,
        invited_by: user.id,
        invited_email: email,
        status: "pending",
        accepted_at: null,
        is_mou_signer: isMouSigner,
      }, { onConflict: "org_id,user_id" });

    if (upsertError) {
      return new Response(JSON.stringify({ error: `Could not create invite: ${upsertError.message}` }), {
        status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
      });
    }

    await serviceClient.from("notifications").insert({
      user_id: targetUserId,
      type: "team_invite",
      title: `You've been invited to join ${org.organisation_name}`,
      body: `${org.organisation_name} invited you to join their team as ${seatLabel}.`,
      link: "/dashboard/settings?tab=team",
      metadata: { org_id: org.id, invited_by: user.id },
    });

    return new Response(JSON.stringify({
      success: true,
      is_new_account: isNewAccount,
      invite_email_sent: inviteEmailSent,
      user_id: targetUserId,
    }), {
      status: 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
  }
});
