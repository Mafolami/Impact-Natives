// src/lib/partnershipActions.ts
//
// Shared partnership_connections business logic, extracted from
// PartnershipTab.tsx (August 2026). Any caller that needs to accept,
// decline, mark formed, or unlist a partnership MUST go through these
// functions rather than writing a lighter version inline -- several of
// them have real side effects (auto-declining competing requests,
// notifications, conversation creation) that a bare status update would
// silently skip.
//
// NOTE ON SCOPE: this module covers everything PartnershipTab.tsx and
// FindPartnerModalDashboard.tsx's simple actions handle. It deliberately
// does NOT cover the individual "confirm this specific connection as
// formed" step -- that lives in DashboardMessages.tsx and was out of
// scope for this extraction. markPartnershipFormed() below closes the
// whole listing and declines remaining pending requests; it does not
// create the "formed" status on any connection itself.
//
// NOTE ON EDITING A LISTING: editing partnership_sought/needs/offers/etc.
// is not extracted here -- it's a large multi-step wizard tightly coupled
// to FindPartnerModalDashboard.tsx's own form state. The correct way to
// "edit" a listing from anywhere else in the app is to open that modal
// component directly, not to reimplement its form logic.

import { supabase } from "@/lib/supabase";

export interface ConnectionActionDeps {
  userId: string;
  myOrgName: string;
}

/**
 * Accept or decline a single inbound partnership connection.
 *
 * On accept: reuses the connection's conversation if one already exists,
 * otherwise opens a new one; posts the AI match rationale as the first
 * message if present; notifies the sender that their interest was
 * accepted.
 *
 * On decline: notifies the sender that their interest wasn't taken
 * forward. No conversation is touched.
 *
 * Returns the conversation id when one was opened or reused (accept
 * only), so the caller can navigate to it if desired -- this function
 * itself never navigates, keeping it UI-agnostic.
 */
export async function updateConnectionStatus(
  conn: { id: string; conversation_id: string | null; ai_rationale: string | null },
  status: "accepted" | "declined",
  deps: ConnectionActionDeps
): Promise<{ conversationId?: string }> {
  const stageStamp = status === "accepted"
    ? { accepted_at: new Date().toISOString() }
    : { declined_at: new Date().toISOString() };

  await supabase.from("partnership_connections")
    .update({ status, updated_at: new Date().toISOString(), ...stageStamp })
    .eq("id", conn.id);

  if (status === "accepted") {
    let conversationId = conn.conversation_id ?? undefined;

    if (conversationId) {
      await supabase.rpc("accept_partnership_connection", {
        p_connection_id: conn.id,
        p_conversation_id: conversationId,
      });
    } else {
      const { data: conv } = await supabase.from("conversations").insert({
        conversation_type: "partnership",
        status: "open",
        initiative_owner_id: deps.userId,
      }).select("id").single();

      conversationId = conv?.id;

      if (conv?.id) {
        await supabase.rpc("accept_partnership_connection", {
          p_connection_id: conn.id,
          p_conversation_id: conv.id,
        });
        if (conn.ai_rationale) {
          await supabase.from("messages").insert({
            conversation_id: conv.id,
            sender_id: deps.userId,
            body: `Match rationale: ${conn.ai_rationale}`,
          });
        }
      }
    }

    await supabase.rpc("send_partnership_notification", {
      p_connection_id: conn.id,
      p_type: "partnership_accepted",
      p_title: "Partnership interest accepted",
      p_body: `${deps.myOrgName} accepted your partnership interest. A conversation has been opened in Messages.`,
      p_link: "/dashboard/messages",
    });

    return { conversationId };
  } else {
    await supabase.rpc("send_partnership_notification", {
      p_connection_id: conn.id,
      p_type: "partnership_declined",
      p_title: "Partnership interest not taken forward",
      p_body: `${deps.myOrgName} did not take your partnership interest forward at this time.`,
      p_link: "/dashboard/messages",
    });
    return {};
  }
}

/**
 * Accept a connection with an explicit partnership type attached (the
 * "Accept Partnership" modal flow) -- distinct from updateConnectionStatus
 * above, which just opens a conversation with no type yet decided.
 */
export async function acceptPartnershipWithType(
  connectionId: string,
  partnershipType: string,
  myOrgName: string
): Promise<void> {
  await supabase.from("partnership_connections")
    .update({
      status: "accepted",
      partnership_type: partnershipType,
      updated_at: new Date().toISOString(),
      accepted_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  await supabase.rpc("send_partnership_notification", {
    p_connection_id: connectionId,
    p_type: "partnership_confirmed",
    p_title: "Partnership accepted",
    p_body: `${myOrgName} has accepted the partnership as ${partnershipType}.`,
  });
}

/**
 * Marks ONE SPECIFIC LISTING's partnership as formed and closes it. This
 * is NOT a simple status flip -- it sets organizations.partnership_formed
 * (a permanent "has this org ever formed a partnership" historical
 * marker, org-wide by design and unaffected by which listing this call
 * is about), snapshots the listing's title onto any connections already
 * at "formed" status for THIS listing (so the title survives future
 * edits to the listing), auto-declines every other still-pending inbound
 * request FOR THIS SAME LISTING so competing orgs aren't left hanging
 * indefinitely, and notifies each declined party. Any caller closing a
 * listing MUST go through this function -- a lighter reimplementation
 * would silently skip the auto-decline and notification steps.
 *
 * listingId scopes which connections this touches -- confirmed bug fixed
 * here: before this, "mark formed" declined EVERY pending inbound
 * connection across the whole org, regardless of which listing they were
 * about. In a one-listing-per-org world that was correct (there was only
 * ever one listing to be about); now that an org can have several, that
 * would have auto-declined real interest in a completely unrelated
 * listing just because a different one happened to close. Connections
 * with no receiver_listing_id at all (made before that column existed)
 * are treated as belonging to whichever listing is passed in, matching
 * the single-listing assumption they were created under.
 */
export async function markPartnershipFormed(
  myOrgId: string,
  listingId: string,
  inboundConnections: { id: string; status: string; conversation_id?: string | null; receiver_listing_id?: string | null }[],
  myOrgName: string,
  myPartnershipTitle: string | null
): Promise<void> {
  // Was a direct .update() -- organizations' UPDATE RLS is owner-or-signer
  // only, so this silently affected zero rows for a regular team member.
  // mark_org_partnership_formed is a SECURITY DEFINER RPC that checks
  // (owner OR active org member) internally and only ever touches this
  // one column.
  await supabase.rpc("mark_org_partnership_formed", { p_org_id: myOrgId });

  const forThisListing = inboundConnections.filter(
    c => c.receiver_listing_id === listingId || c.receiver_listing_id == null
  );

  const formedIds = forThisListing.filter(c => c.status === "formed").map(c => c.id);
  if (formedIds.length > 0 && myPartnershipTitle) {
    await supabase.from("partnership_connections")
      .update({ partnership_title: myPartnershipTitle })
      .in("id", formedIds);
  }

  const pendingConnections = forThisListing.filter(c => c.status === "pending");
  const pendingIds = pendingConnections.map(c => c.id);
  if (pendingIds.length > 0) {
    const { error: declineError } = await supabase.from("partnership_connections")
      .update({ status: "declined", updated_at: new Date().toISOString(), declined_at: new Date().toISOString() })
      .in("id", pendingIds);

    if (declineError) {
      console.error("markPartnershipFormed: failed to decline pending connections:", declineError.message);
    } else {
      // Keep conversations.status in sync with the connections just
      // declined above -- without this, Messages shows these as still
      // pending forever even though the connection itself is correctly
      // declined (the exact mismatch found and fixed for a real
      // conversation on 2026-08-28).
      const pendingConversationIds = pendingConnections
        .map(c => c.conversation_id)
        .filter((id): id is string => !!id);
      if (pendingConversationIds.length > 0) {
        const { error: convError } = await supabase.from("conversations")
          .update({ status: "rejected" })
          .in("id", pendingConversationIds);
        if (convError) {
          console.error("markPartnershipFormed: failed to sync conversations to rejected:", convError.message);
        }
      }
    }

    await Promise.all(pendingIds.map(id =>
      supabase.rpc("send_partnership_notification", {
        p_connection_id: id,
        p_type: "partnership_closed",
        p_title: "Partnership request closed",
        p_body: `${myOrgName} has formed a partnership and closed this listing.`,
      })
    ));
  }
}

/**
 * Removes the org's partnership listing from discovery. Only touches
 * partnership_listed -- does not clear partnership_formed, title, or
 * sought. (A full reset of those fields is the separate "start fresh"
 * flow in FindPartnerModalDashboard.tsx, used specifically after a
 * partnership has already formed and the org wants to begin a new
 * request; that flow stays in its modal since it also drives that
 * modal's own form-state transitions.)
 */
// Unlists ONE SPECIFIC listing (sets its own row's status to "draft" in
// partnership_listings), not the whole org. Previously this flipped
// organizations.partnership_listed, a single org-wide flag that made
// sense when an org could only ever have one listing -- unlisting it
// meant unlisting everything, because there was only ever one thing to
// unlist. Now that an org can have several, that would have silently
// unlisted every listing at once when the intent was to unlist just one.
// Also refreshes the org-wide legacy flag as a cheap backward-compat
// signal (true if ANY listing remains published) for the handful of
// older surfaces that still read it directly.
export async function unlistPartnership(myOrgId: string, listingId: string): Promise<void> {
  await supabase.from("partnership_listings").update({ status: "draft" }).eq("id", listingId);
  const { data: org } = await supabase.from("organizations").select("user_id").eq("id", myOrgId).maybeSingle();
  if (org?.user_id) {
    const { count } = await supabase.from("partnership_listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", org.user_id).eq("status", "published");
    await supabase.from("organizations").update({ partnership_listed: (count ?? 0) > 0 }).eq("id", myOrgId);
  }
}

/**
 * Re-lists ONE SPECIFIC previously-unlisted listing (sets its own row's
 * status back to "published"). Same scoping fix as unlistPartnership --
 * only touches the one listing, not every listing the org has.
 */
export async function relistPartnership(myOrgId: string, listingId: string): Promise<void> {
  await supabase.from("partnership_listings").update({ status: "published" }).eq("id", listingId);
  await supabase.from("organizations").update({ partnership_listed: true }).eq("id", myOrgId);
}