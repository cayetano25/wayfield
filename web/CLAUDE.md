# Wayfield Web — Next.js Context

This is the Next.js web application for Wayfield.
It serves two surfaces:
  1. Web admin app (organizers managing workshops)
  2. Public workshop pages (public-facing)

Root project memory: ../CLAUDE.md
Constitutional authority: ../MASTER_PROMPT.md
Next.js conventions: ./AGENTS.md
Permissions: ../docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
API routes: ../docs/04_api/API_ROUTE_SPEC.md

## Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- Turbopack (dev server)
- API calls to Laravel backend at http://localhost:8000/api/v1

## App Router Structure

- app/(admin)/         — organizer admin screens (authenticated)
- app/(public)/        — public workshop pages (unauthenticated)
- app/api/             — Next.js API routes if needed (thin — backend is Laravel)
- components/          — shared UI components
- lib/                 — API client, auth helpers, utilities

## Brand

Colors:
  Primary Teal:    #0FA3B1
  Burnt Orange:    #E67E22
  Coral Red:       #E94F37
  Muted Sky Blue:  #7EA8BE
  Dark Charcoal:   #2E2E2E
  Light Gray:      #F5F5F5

Fonts:
  Headings: Sora
  Body/UI:  Plus Jakarta Sans
  Accent:   JetBrains Mono

Tailwind config must register these colors and fonts as custom tokens.

## Authentication

- Sanctum Bearer tokens stored in httpOnly cookies or secure localStorage
- Auth state managed server-side where possible using Next.js server components
- Middleware (middleware.ts) protects all /admin routes
- Never trust client-side auth state alone — always verify against API response

## Do Not

- Do not enforce auth or permissions on the frontend only
- Do not use pages/ directory — App Router only
- Do not use getServerSideProps or getStaticProps — these are App Router patterns now
- Do not call the Laravel API directly from client components where a server
  component can do it instead
- Always validate against the API response — backend is the source of truth
- Do not expose API tokens in client-side code
