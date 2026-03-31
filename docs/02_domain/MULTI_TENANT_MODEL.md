# Multi-Tenant Architecture Model

## Purpose
Ensure strict isolation between organizations.

---

## Core Rule

All data must be scoped by organization_id.

---

## Tenant Boundaries

- organizations are root tenant entities
- all workshops belong to an organization
- all sessions belong to a workshop
- all participants belong to a workshop

---

## Cross-Tenant Access

Prohibited unless explicitly allowed.

Rules:
- users may belong to multiple organizations
- leaders may belong to multiple organizations
- data must not leak across organizations

---

## Organization Model

Fields:
- id
- name
- primary_contact info
- created_at

---

## Organization Users

Table: organization_users

Rules:
- many-to-many relationship
- role-based access

---

## Data Isolation Enforcement

Must be enforced in:
- database queries
- API layer
- authorization middleware

---

## Example Constraint

A leader assigned to Organization A:
- must NOT access sessions in Organization B

---

## Audit Requirements

Log:
- organization membership changes
- role changes
- cross-organization access attempts