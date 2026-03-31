# Wayfield Mobile — Expo Context

This is the Expo React Native mobile app for Wayfield.
Serves participants and leaders in the field.

Root project memory: ../CLAUDE.md
Constitutional authority: ../MASTER_PROMPT.md
Offline sync: ../docs/02_domain/OFFLINE_SYNC_STRATEGY.md
Permissions: ../docs/02_domain/PERMISSIONS_AND_PRIVACY_MODEL.md
API routes: ../docs/04_api/API_ROUTE_SPEC.md

## Stack

- Expo 53 (managed workflow)
- React Native (New Architecture enabled by default)
- TypeScript
- Expo Router v4 (file-based routing)
- expo-sqlite for offline structured data storage
- expo-secure-store for auth token storage
- Expo Push Notifications (FCM backend)
- API calls to Laravel backend at http://localhost:8000/api/v1 (dev)

## App Structure (Expo Router)

- app/(auth)/          — login, register, verify email screens
- app/(participant)/   — participant screens (workshops, schedule, check-in)
- app/(leader)/        — leader screens (roster, attendance, session view)
- app/_layout.tsx      — root layout, auth gate
- components/          — shared UI components
- lib/api/             — API client and request helpers
- lib/sync/            — offline sync logic, action queue
- lib/db/              — SQLite schema and query helpers

## Authentication

- Sanctum Bearer tokens stored in expo-secure-store (never AsyncStorage for tokens)
- Token loaded at app start, refreshed as needed
- Unauthenticated users redirected to (auth) screens via root layout

## Offline Storage Rules

Use expo-sqlite for:
- Workshop overview, sessions, tracks, logistics
- Leader assignments and safe leader profile fields
- Participant's own session selections and schedule
- Pending offline action queue (check-ins, attendance)

Use expo-secure-store for:
- Auth token only

Never store in any local cache:
- meeting_url, meeting_id, meeting_passcode
- Participant phone numbers (participant-facing cache)
- Full roster data (participant-facing cache)
- Leader phone numbers or address fields beyond city/state

Leader-facing cache may include phone numbers
for their assigned session participants only.

## Critical Requirements

- OFFLINE FIRST: workshop data must work without connectivity after initial sync
- Download full sync package on workshop join and on each foreground resume
- Queue attendance actions locally when offline using the action queue table
- Replay queued actions on reconnect — idempotent via client_action_uuid
- Detect stale sync package via version hash before each session
- Notify user if sync fails or data is stale

## New Architecture Notes

- New Architecture is on by default in Expo 53 — do not disable it
- Use native modules that support New Architecture (Fabric + TurboModules)
- Avoid legacy bridge-only libraries — check compatibility before adding packages

## Brand

Colors:
  Primary Teal:    #0FA3B1
  Burnt Orange:    #E67E22
  Coral Red:       #E94F37
  Muted Sky Blue:  #7EA8BE
  Dark Charcoal:   #2E2E2E
  Light Gray:      #F5F5F5

Fonts:
  Headings: Sora (via expo-font or @expo-google-fonts/sora)
  Body/UI:  Plus Jakarta Sans (via @expo-google-fonts/plus-jakarta-sans)

## Do Not

- Do not make the app online-only
- Do not use AsyncStorage for structured workshop data — use expo-sqlite
- Do not use AsyncStorage for auth tokens — use expo-secure-store
- Do not cache meeting URLs, meeting passcodes, or meeting IDs offline
- Do not cache full roster data in participant-facing offline storage
- Do not use the legacy Expo Router (pages-style) — file-based app/ directory only
- Do not use libraries that require native rebuilds in managed workflow
- Do not store private participant data beyond what the role is permitted to see
