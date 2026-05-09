# Natives — Africa Impact Platform

A multi-page institutional SaaS platform for Africa's social impact ecosystem — digital coordination and partnership infrastructure for NGOs, Corporates, Donors, Governments, and Founders.

## Run & Operate

- `pnpm --filter @workspace/natives run dev` — run the Natives frontend (port assigned by workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Wouter (routing) + shadcn/ui + Tailwind CSS
- Animations: Framer Motion
- API: Express 5 (shared api-server artifact)
- DB: PostgreSQL + Drizzle ORM (not yet used — UI-only build)
- Build: Vite (frontend)

## Where things live

- `artifacts/natives/` — main Natives web app (React + Vite)
- `artifacts/natives/src/pages/` — one file per page group
- `artifacts/natives/src/components/` — shared layout components (Nav, Footer, etc.)
- `artifacts/natives/src/index.css` — theme/color tokens
- `artifacts/api-server/` — shared Express API server (not yet used)
- `lib/api-spec/openapi.yaml` — API contract source of truth (not yet extended)

## Color Palette

- White base: `#FFFFFF`
- Burnt Orange (CTAs, active states): `#C45C26`
- Forest Green (verification, trust): `#2D6A4F`

## Architecture decisions

- Frontend-only first build — no backend or auth logic yet; pure UI scaffolding
- Wouter used for client-side routing (not Next.js, despite the user's original tech stack preference — Next.js is not supported in the Replit pnpm workspace template)
- All placeholder text reflects actual Natives product language, not lorem ipsum
- shadcn/ui components throughout for consistent, accessible UI primitives

## Product

7-page platform covering:
1. Home — hero, ecosystem problem, how Natives works, stakeholder categories, metrics
2. Platform — Partnership OS, Impact Verification, Funding Infrastructure, Trust & Verification, API/Integrations
3. Solutions — for NGOs, Corporates, Donors/Governments, Founders
4. Labs & Network — Active Labs (Agritech, Climate, Health), Marketplace/Directory, Africa Impact Map
5. Insights & Impact — Case Studies, Research, Solution Library, Resource Hub, Impact Dashboard
6. Partner With Us — Commission a Lab, Become a Partner, Book a Demo, Contact
7. About — Mission, Vision, Team, Partners, Principles

Auth stubs: /login and /signup (role-selection step at /signup/role).

## User preferences

- Design reference: Vercel.com and Linear.app — institutional and modern, not playful
- Orange (#C45C26) on all CTAs and active states
- Green (#2D6A4F) on verification indicators and trust signals
- No blue. No stock photography. No NGO-website aesthetics. No lorem ipsum
- Mobile responsive throughout
- No emojis in UI

## Gotchas

- Google Fonts @import must be the VERY FIRST line of index.css (before @import "tailwindcss")
- All CSS custom properties in index.css start as "red" placeholders — must be replaced with real theme values
- No backend or auth logic in this first build — UI scaffolding only
