# Notifications and Messaging System Specification

## Purpose
Define all system communication, including email, push, and in-app notifications, with strict enforcement of role-based messaging constraints.

---

## Notification Entity

Table: notifications

Fields:
- id
- organization_id (FK)
- workshop_id (FK)
- session_id (nullable FK)
- created_by_user_id (FK)
- title
- message
- notification_type (enum: informational, urgent, reminder)
- sender_scope (enum: organizer, leader)
- delivery_scope (enum: all_participants, leaders, custom, session_participants)
- sent_at (nullable)
- created_at
- updated_at

---

## Notification Types

1. Email
2. Push Notification
3. In-App Notification

---

## Sender Scope Rules

### Organizer
Can:
- send to entire workshop
- send to custom groups
- send to leaders
- send to session participants

### Leader
STRICTLY LIMITED

Must:
- include session_id
- target only assigned session participants

---

## Leader Messaging Constraints (Critical)

Scope:
- ONLY participants in assigned sessions

Time Window:
- 4 hours before session start
- during session runtime
- 2 hours after session end

---

## Enforcement Requirements

### Backend (MANDATORY)
- validate leader assignment
- validate session scope
- validate time window

### UI (SECONDARY)
- hide messaging UI outside allowed window

### Audit Logging (MANDATORY)
- record all leader messages

---

## Delivery Rules

- notifications must be queued
- delivery must support retry
- delivery must support multi-channel:
  - email
  - push
  - in-app

---

## Email System

Must support:
- email verification
- password reset
- leader invitations
- workshop confirmations
- reminders
- critical updates

---

## Push Notifications

- use Firebase or Expo push
- must support:
  - scheduled notifications
  - urgent overrides

---

## Notification Preferences (Future)

Users may define:
- email opt-in/out
- push opt-in/out
- notification categories

---

## Validation Rules

Leader notification is rejected if:
- no session_id
- user not assigned to session
- outside time window
- targeting invalid participants

---

## Audit Requirements

Log:
- notification created
- notification sent
- leader notification (with full context)