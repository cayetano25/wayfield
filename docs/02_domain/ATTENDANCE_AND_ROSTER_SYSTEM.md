# Attendance and Roster System Specification

## Purpose
Define attendance tracking, roster visibility, and operational controls.

---

## Attendance Entity

Table: attendance_records

Fields:
- id
- session_id (FK)
- user_id (FK)
- status (enum: not_checked_in, checked_in, no_show)
- check_in_method (enum: self, leader)
- checked_in_at (nullable)
- checked_in_by_user_id (nullable)
- created_at
- updated_at

---

## Core Features

- participant self-check-in
- leader manual check-in
- leader override
- no-show marking

---

## Self Check-In Rules

- participant must:
  - be registered
  - have selected session (if applicable)

- check-in must:
  - record timestamp
  - record method = self

---

## Leader Check-In Rules

- leader must:
  - be assigned to session

- can:
  - mark participant as checked_in
  - mark participant as no_show
  - override existing status

---

## Roster Access

Leader can view:
- participants for assigned session ONLY

Organizer can view:
- all participants

Participant can NOT view:
- roster

---

## Phone Number Visibility

Visible only to:
- assigned leaders
- organizers

Never visible to:
- participants
- unrelated leaders

---

## Data Integrity Rules

- one attendance record per user per session
- status transitions must be valid:
  - not_checked_in → checked_in
  - not_checked_in → no_show

---

## UI Requirements

Leader View:
- participant list
- check-in status
- quick actions:
  - check-in
  - mark no-show

Participant View:
- check-in button
- confirmation state

---

## Audit Requirements

Log:
- self check-in
- leader check-in
- attendance override
- no-show marking