# Wayfield Command Center — Next.js Context

This is the platform operations interface for Wayfield.
It is used ONLY by Wayfield platform administrators — not by customers.

Root project memory: ../CLAUDE.md
Constitutional authority: ../MASTER_PROMPT.md
Command Center overview: ../docs/command_center/OVERVIEW.md
Command Center schema: ../docs/command_center/SCHEMA.md
Platform API routes: ../docs/command_center/API.md

## Stack
- Next.js 15 (App Router)
- TypeScript, Tailwind CSS, Tremor (charts and dashboards)
- API calls to Laravel at http://localhost:8000/api/platform/v1
- Bearer tokens from admin_users (NOT tenant users)

## Critical Rules
- This app serves platform_admins ONLY
- Never mix platform admin tokens with tenant tokens
- All mutations must show confirmation dialogs
- Every destructive action is highlighted in Coral Red #E94F37
- Platform admins can view but not impersonate (stubbed)

## Commands
npm run dev   # start on http://localhost:3001
npm run build
npm run lint
