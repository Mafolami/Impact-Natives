# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What the product is

Impact Natives is a B2B SaaS platform that helps African NGOs and social enterprises find, formalise and track partnerships with each other, with funders and with corporates.

The core loop:

1. **Profile.** An organisation builds its profile, including a due diligence (DD) checklist with uploaded evidence.
2. **Find.** It finds partners in two ways:
   - **Initiatives** (`initiative_requests`): a posted project that others express interest in. Confirmed partners are stored in `initiative_requests.confirmed_partners` (jsonb).
   - **Direct partnerships** (`partnership_listings` and `partnership_connections`): an org publishes a listing, another org expresses interest, and the connection moves through `pending` to accepted to formed.
3. **Match.** AI matching ranks candidates for both (see Matching below).
4. **Formalise.** A partnership is formalised with an MoU (`mou_documents`). Org A is always the initiative creator, or the listing owner on a connection. The database enforces this on insert.
   - Status flow: `draft` -> `sent` -> (`signed_by_org_a` / `signed_by_org_b`) -> `pending_org_a_final_review` -> `fully_executed`.
   - Three source types: `template`, `custom`, `uploaded_pdf`.
   - Org B cannot see a draft at all.
   - At least one agreed outcome indicator (`partnership_indicators`) is required before execution.
   - After execution, org A can "Mark partnership as executed" (`confirm_partnership_status` RPC), which writes back to the initiative or connection.
5. **Track.** Milestones, impact claims and evidence, verified outcomes and an impact score track delivery after signing.

Org types: implementers (NGOs, social enterprises and others), funders (`philanthropic_foundation`, `venture_capital`), corporates (`corporation`, `technology_company`, `public_sector`), and solo consultancies (`consultancy`). Individuals can also have accounts.

Paid tiers are `plus`, `pro` and `compliance`, billed through Paystack. AI matching and MoU drafting need Plus or higher. The database or the edge function enforces this, not only the browser.

## Stack

- **Frontend:** React + TypeScript, Vite, Wouter (routing), shadcn/ui + Tailwind, Framer Motion, TipTap, jsPDF / pdf-lib for MoU PDFs. Deployed on Vercel (`artifacts/natives/vercel.json`). `app.impactnatives.com` serves the app; the marketing host redirects app paths there.
- **Backend:** Supabase. Postgres with RLS, Auth (email + Google), Storage, pg_cron + pg_net, and Deno edge functions. The project ref is `lzpxlnjvegpxjuexyjdj`.
- **Data access:** the browser calls Supabase directly with `@supabase/supabase-js` (`artifacts/natives/src/lib/supabase.ts`, env `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`). There is no app server in between.
- **AI:** Groq, model `openai/gpt-oss-120b`, called from edge functions over the OpenAI-compatible chat completions API (`GROQ_API_KEY`).
- **Other services:** Paystack (billing), ExchangeRate-API (NGN/USD rate), email via the notification functions.
- **Tooling:** pnpm workspaces, Node 24, TypeScript 5.9.

## Folder layout

```
artifacts/natives/              The app. This is where nearly all frontend work happens.
  src/App.tsx                   Routes. /dashboard/* is wrapped in one DashboardLayout.
  src/pages/                    One file per page or large modal (Dashboard*, Mou*, Create*Modal, ...)
  src/components/dashboard/     Dashboard widgets (Sidebar, Topbar, DDEvidenceModal, ...)
  src/components/platform/      Marketplace, matching, initiative UI (DdStatusBadge, FindPartner*, ...)
  src/components/mou/           Indicators, milestones, impact claims inside an MoU
  src/components/ui/            shadcn primitives
  src/context/AuthContext.tsx   Session, profile, org owner resolution
  src/lib/                      Shared helpers: ddItems, matchDd, orgFields, relationshipAccess, indicators, ...
supabase/functions/<name>/      Edge functions (Deno). One folder each, index.ts (+ dd.ts for matchers).
supabase/migrations/            SQL migrations. Incomplete history, see Known issues.
```

Leftovers you can ignore: `lib/*` (Drizzle, Orval, Zod scaffolding), `artifacts/api-server`, `artifacts/mockup-sandbox`, `replit.md`, `INTEGRATION_GUIDE.md`, the `write_implementer_matches_fix*.py` scripts and `*.bak` files. The app does not import any of them. `replit.md` describes an early UI-only build and is out of date.

## Matching

Three matchers, all edge functions using Groq:

- `match-orgs-for-partnership`: listing-to-listing partnership matches.
- `match-initiatives-to-funder`: initiatives for a funder or corporate mandate.
- `match-initiatives-for-implementer`: initiatives for an implementer (peer discovery).

How a match is scored (`match-orgs-for-partnership`; the initiative matchers follow the same idea):

- **The AI rates, the code scores.** The model only rates five criteria (`sector_fit`, `geography_fit`, `need_offer_fit`, `working_style_fit`, `stage_readiness_fit`) as `match` / `partial` / `no_match`. It never outputs a number.
- **Budget fit is computed in code** from the two listings' budget buckets (`under_10k`, `10k_50k`, `50k_200k`, `over_200k`, `open`, `in_kind_only`), with a rescue from a funder's USD grant range.
- **Score** = weighted sum: need_offer 35, budget 15, sector 15, stage 15, geography 10, working style 10. A `no_match` on need_offer, budget or geography caps the score at 44. Bulk results below 45 are dropped.
- **The prompt is size-neutral on purpose.** It tells the model to judge the ask, not the org's size or polish, and not to consider DD. The only evidence signal is a yes/no "documented impact" flag (at least one partner-confirmed impact claim).
- **Excluded candidates:** demo orgs (`is_demo_org`), orgs on a visibility hold (`flagged_visibility_hold`), and the caller's own org. Admins and demo accounts can score a single demo listing through `score-partnership-fit`.

Caching and refresh:

- Results are cached in `partnership_match_cache` and `initiative_match_cache`. Each row stores `criteria_version`.
- Bumping `criteria_versions.version` for a match type marks all cached rows stale.
- Callers: `refresh-partnership-matches` / `refresh-initiative-matches` (Home, session-resolved), `score-partnership-fit` (directory fit box), `FindPartnerModalDashboard` (browser, Plus only).
- Nightly backstop: `sweep-stale-*-matches` (pg_cron, 03:00 UTC) dispatches `refresh-*-matches-for-org` per stale org.
- Partnership cache rows with an `opening_message` are "protected": bulk refreshes never overwrite them.

## Due diligence (proportional DD)

Rules are in `dd.ts` and settings in the `matching_config` table. Since Oct 2026:

- **The DD bar is set by the size of the deal, never the size of the org.**
  - Partnerships: the larger of the two listings' budget buckets. `open` takes the other side's bucket; both open or unknown means `open_bucket`.
  - Initiatives: the initiative's own budget. NGN is converted at the stored rate, using the top of the range.
- **DD never lowers the fit score.** It produces a status used for badges and ranking:
  - `complete` / `exempt` rank first, then `tier_missing`, then `basics_incomplete`.
  - The fit score orders results within each tier.
  - `byTierThenScore` in `dd.ts` and `sortByTierThenScore` in `src/lib/matchDd.ts` must agree.
- **Implementers** have 9 items, stored as `organizations.dd_*` booleans.
  - Mandatory at every size: `legal_registration`, `safeguarding_policy`, `legal_compliance_declaration`.
  - `10k_50k` adds `governance_doc`.
  - `50k_200k` and up need 60% of the 9 items.
  - Items in `doc_required` only count when a file exists in `dd_evidence_documents` under the same key.
- **Funders and corporates** use the 6-item `fdd_*` set: 60% or more is complete, 40% or more is `tier_missing`.
- **Consultancies** are `exempt`.

`matching_config` keys:

- `dd_policy` (jsonb): mandatory items, doc_required, bucket defaults and per-tier rules. Code falls back to `DEFAULT_DD_POLICY` if the read fails.
- `fx_ngn_per_usd`: `{ rate, source, fetched_at, last_error }`. `update-fx-rate` refreshes it daily (pg_cron 02:41 UTC) and refuses implausible moves. A `manual_override` source is never replaced.

Cache rows carry `dd_status`, `dd_missing` and `deal_bucket`. After changing DD rules, bump `criteria_versions` and clear stale rows. See `20261020204000_proportional_dd_cache_reset_fx_cron.sql`.

`dd.ts` is copied into `match-orgs-for-partnership`, `match-initiatives-to-funder`, `refresh-initiative-matches` and `refresh-initiative-matches-for-org`. **Edit all four identically** and redeploy all four. The header mentions `build/shared/dd.ts`, but that file does not exist.

## Data access

Access is controlled in the database. Browser checks are only there to show a friendlier message.

- **RLS on every table.** The common building blocks:
  - Owner check: `organizations.user_id = auth.uid()`. `organizations.user_id` and `initiative_requests.user_id` are always the org OWNER's id.
  - `is_org_member(org_id)`: active row in `org_members`.
  - `can_edit_org_profile(owner_user_id)` / `can_confirm_mou_for_org(org_id)`: the owner, or a member with `is_mou_signer`. This gates signing and finalising MoUs.
  - `is_admin()`: reads `profiles.is_admin`.
  - Public org reads require `status = 'published'`, not a demo org, and no visibility hold.
- **Column privileges on top of RLS.** RLS picks rows; grants pick columns.
  - `profiles`: authenticated users can only UPDATE an allowlist of columns. `is_admin`, verification and subscription fields are locked (`20260826175919_...`).
  - `organizations`: sensitive fields (email, TIN, registration number, SRG1 revenue, subscription ids and status, review flags, DD evidence URLs) are mirrored into `organization_private` by the `sync_org_private` trigger. Owners, members and admins read them there. Several are revoked from `organizations` for `anon` / `authenticated` (`20261014140000_...`).
  - **A select that names a revoked column fails as a whole.** Use explicit column lists on `organizations`, never `select("*")`, and check the grants before adding a column to a select.
- **RPCs** that are `security definer` must check the caller themselves (`auth.uid()`, membership, admin). See `20261014120000_rpc_lockdown_caller_checks.sql` for the pattern. Revoke `execute` from `anon` / `authenticated` on internal-only functions.
- **Edge functions** use the new key system. `SUPABASE_SECRET_KEYS` / `SUPABASE_PUBLISHABLE_KEYS` are JSON maps; legacy JWT keys were disabled after a leak in Oct 2026.
  - A call carrying the secret key is a trusted server call (cron, function-to-function).
  - A browser call must be signed in, and the function must check ownership or membership and the paid tier itself.
  - Cron jobs read the service key from Vault (`private.get_service_role_key()`).
- **Owner vs logged-in user in the frontend.** Use `orgOwnerId` (from AuthContext) for org identity checks, and `myUserId` only for per-person fields such as `created_by` or storage paths. Mixing them up was a recurring team-seat bug.
- **MoU data.** Org A's owner and members see their MoUs. Org B sees them only once `status <> 'draft'`. Data that only org A should see goes in a separate table with its own RLS, not in a `mou_documents` column. Example: `mou_prior_relationship` holds the "Had you worked with this partner before?" answer. Org A writes it through the `set_mou_prior_relationship` RPC while the MoU is a draft. The trigger `enforce_prior_relationship_before_send` makes it required before the MoU leaves draft. Org A and admins can read it. It's reported through the view `partnership_prior_relationship_report`, which only the SQL editor or service role can read. It is never used in matching or shown publicly.

## Conventions

- **Never use em dashes in user-facing copy.** Use a full stop, comma, colon or brackets instead. This covers UI text, emails, notifications, PDFs and AI prompts that produce customer-facing text. Code comments are fine.
- Plain, institutional product language. No emojis in the UI, no lorem ipsum.
- Brand colours: green `#2D6A4F` for primary actions in the app and trust signals, burnt orange `#C45C26` for marketing CTAs.
- **The database is the real guarantee.** When adding a business rule (a gate before send, before execution, etc.), enforce it with a trigger or RLS, and mirror it in the UI only to avoid a raw Postgres error. Existing examples: `enforce_org_a_signed_before_send`, `enforce_agreed_indicator_before_execution`, `protect_mou_signing_fields`.
- Check the result of every Supabase write. Don't update local state as if a write succeeded without checking.
- Comments explain *why*, often with the date and the bug that prompted the change. Edge functions keep a version history at the top of `index.ts` (`// vNN (date): ...`). Add a line when you change one.
- British spelling in copy ("organisation", "formalise"). Database column names mix spellings (`organisation_name` on `organizations`). Match what exists.

## Deploy workflow (how the owner works)

- **Branches:** never work on `main`. Use a new branch. Don't connect GitHub or push from the session; the owner pushes.
- **Frontend changes:** hand over a **Python script**, plus a git commit message to go with it.
  - The script writes the **full contents** of each changed file, not diffs.
  - It finds the files itself under the owner's local repo at `/Users/mac/Downloads/Impact Natives/Natives/`.
  - It runs from `~/Downloads` with no arguments.
  - The owner runs it, builds and pushes.
- **Migrations:** show the SQL first. After the owner approves, apply it through the Supabase MCP tools, then verify with a SELECT. Also save it as a file in `supabase/migrations/` so the repo keeps the history.
- **Edge functions:** ask before deploying any function to the live project.
- **Order:** apply a migration before shipping frontend code that depends on it.

## Commands

- `pnpm install`
- `pnpm --filter @workspace/natives run dev`: local app (needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`)
- `pnpm --filter @workspace/natives run typecheck`
- `pnpm --filter @workspace/natives run build`

## Known issues

These are recorded, not fixed.

- **Org B can update every column of `mou_documents` once it leaves draft.**
  - The UPDATE policy allows org B's owner and members on any non-draft row, and `authenticated` has UPDATE on all columns.
  - `protect_mou_signing_fields` only guards signature, lock and execution fields.
  - So org B can still change `status`, `field_values`, `custom_content`, `edited_sections`, `toggle_selections` and `signed_files`, possibly changing the terms after org A has signed.
  - Security follow-up needed.
- **Most of the schema exists only in the live database.**
  - Repo migrations start in July 2026, and many were applied by hand in the SQL editor.
  - Core tables, RLS policies, RPCs and triggers (`mou_documents`, `organizations`, `initiative_requests`, `finalize_mou_document`, ...) are not in `supabase/migrations`.
  - `production_schema.sql` and `20260820093135_add_mou_stage_timestamps.sql` are empty.
  - Read the live schema before changing it, and don't assume the repo is complete.
- **Repo migrations and live migration history don't match.**
  - `20261023120000_mou_prior_relationship.sql` was applied by hand in the SQL editor on 23 Oct 2026, so it is in the repo but not in the live migration history (`supabase_migrations.schema_migrations`).
  - The reverse also exists: `20261022095623` is in the live history but has no file in the repo.
- **`dd.ts` has four identical copies and no shared source.** See the DD section above.
- **Em dashes in user-facing copy**, against the rule above. 57 `.tsx` files in `artifacts/natives/src` contain one; in about 44 of them it's outside a code comment, so it's likely in copy. Fix them when you touch those files.
