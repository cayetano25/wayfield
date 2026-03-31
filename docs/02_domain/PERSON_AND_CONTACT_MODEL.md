# Person and Contact Modeling Specification

## Purpose
Ensure consistent modeling of all real people across the system.

---

## Core Rule

All real-world individuals MUST be modeled with:

- first_name (required)
- last_name (required)

This applies to ALL of the following:

- users
- leaders
- organization contacts
- organization managers
- participants
- invited leaders

---

## Prohibited Patterns

- single "name" field
- reliance on display_name alone
- partial identity records

---

## Optional Fields

Where applicable:

- email
- phone_number
- display_name (derived or optional)
- profile_image

---

## Organization Contact Model

Organizations must include:

- primary_contact_first_name
- primary_contact_last_name
- primary_contact_email
- primary_contact_phone

---

## Organization User Roles

Table: organization_users

Fields:
- id
- organization_id
- user_id
- role (enum: owner, admin, staff, billing_admin)
- created_at

Rules:
- organization must support multiple users
- roles must be explicitly defined

---

## Leader Model

Leaders are global entities.

Fields:
- first_name
- last_name
- email
- phone_number
- bio
- website
- address_line_1 (private)
- address_line_2 (private)
- city
- state_or_region
- postal_code
- country

---

## Privacy Rules

Public exposure:
- name
- bio snippet
- website
- city
- state

Private:
- full address
- phone (except assigned leaders)

---

## Data Integrity Rules

- first_name and last_name cannot be null
- email must be valid format when present
- phone must be validated if stored