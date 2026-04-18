# Leader Sessions Page Enhancement — Implementation Guide

## Overview
This enhancement upgrades the leader-facing My Sessions view in the web app
to show a richer session card with full details, actionable participant data,
and communication controls. It also requires API changes to support un-check-in
and to ensure all required fields are returned to assigned leaders.

## Scope
- api/ — attendance revert endpoint, serializer field additions
- web/ — session card redesign, participant row enhancements

## Design Principles (Apple HIG applied to web)
- Information hierarchy: most important details immediately visible,
  secondary details revealed on expand
- Tappable/clickable targets minimum 44px tall
- Destructive or reversible actions clearly labeled
- Disabled states must be visually distinct (notification link outside window)
- No truncation of critical identifying information
- Links that invoke native apps (maps, phone) use standard URI schemes

## URI Schemes
- Phone: tel:[phone_number] — strips non-numeric characters
- Maps (cross-platform): https://maps.apple.com/?ll=[lat],[lng]&q=[name]
  This URL opens Apple Maps on iOS/macOS and falls back to Google Maps
  on Android/Windows via browser redirect. Preferred over google.com/maps
  for HIG compliance.

## Leader Messaging Window (from NOTIFICATIONS_AND_MESSAGING_SYSTEM.md)
- Opens: 4 hours before session start_at (in workshop timezone)
- Closes: 2 hours after session end_at (in workshop timezone)
- Enforcement: backend is mandatory; UI shows disabled state outside window

## Attendance Revert Rules (from ATTENDANCE_AND_ROSTER_SYSTEM.md)
- Valid transition: checked_in → not_checked_in (revert)
- Only assigned leader or organizer may revert
- Revert must be logged to audit_logs
- check_in_method and checked_in_at should be cleared on revert
- checked_in_by_user_id should be cleared on revert

## API Changes Required

### 1. Attendance revert endpoint
DELETE or PATCH /api/v1/sessions/{session}/attendance/{user}/leader-check-in
- Reverts status from checked_in back to not_checked_in
- Clears check_in_method, checked_in_at, checked_in_by_user_id
- Requires leader to be assigned to the session
- Writes audit log entry

### 2. Leader session serializer — ensure these fields are returned
Session:
- id, title, description
- start_at, end_at (UTC — client converts using workshop timezone)
- workshop.title (full, never truncated at API level)
- workshop.timezone
- location.name, location.address_line_1, location.city,
  location.state_or_region, location.latitude, location.longitude
- is_published

Roster participant (assigned leader only):
- user.id, user.first_name, user.last_name
- user.phone_number (only for assigned leader — per PERMISSIONS_AND_PRIVACY_MODEL.md)
- attendance.status, attendance.check_in_method, attendance.checked_in_at

### 3. Messaging window availability
The session detail or roster response should include a computed boolean:
- messaging_window_open: true/false
Computed server-side using workshop timezone. UI uses this to enable/disable
the notification link. Backend enforcement remains mandatory regardless.

## Web Card Design

### Collapsed state (always visible)
- Full workshop name (no truncation — use text wrapping)
- Session title
- Date, start time – end time (formatted in workshop timezone)
- Location name + address + map link icon (if lat/lng available)
- Capacity: enrolled count / total (e.g. 1/12)
- Participants expand/collapse toggle
- Send Notification link (disabled + tooltip if outside window)

### Expanded participant rows
- Avatar initials + full name
- Phone number as tel: link (click to call)
- Attendance status badge
- Check In button (if not_checked_in)
- Checked In badge with Revert action (if checked_in) — labeled "Revert"
  styled as a secondary/outline button to distinguish from the primary action
- No Show badge (if no_show)

## Audit Requirements
All attendance reverts must be logged per TESTING_AND_VALIDATION_STRATEGY.md.