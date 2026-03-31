# Subscription and Feature Gating Specification

## Purpose
Define SaaS monetization and feature control.

---

## Plans

### Free
- limited workshops
- limited participants
- core features only

### Starter
- increased limits
- waitlists
- automation
- leader notifications

### Pro
- advanced automation
- analytics
- API/webhooks

### Enterprise
- SSO
- MFA
- governance

---

## Core Rule

Participants are always free.

Organizations pay.

---

## Feature Gating Enforcement

MUST be enforced in:
- backend logic (primary)
- UI (secondary)

---

## Gateable Features

- workshop limits
- participant limits
- analytics
- automation
- API access

---

## Leader Messaging

- advanced messaging tied to Starter+
- BUT constraints ALWAYS apply

---

## Validation Rules

System must:
- block restricted features at API level
- return clear error messages