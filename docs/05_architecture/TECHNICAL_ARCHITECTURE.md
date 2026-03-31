# Technical Architecture Specification

## Source Authority
Constitutional authority: `MASTER_PROMPT.md`
This file is the architecture source of truth for technology choices and AWS infrastructure.
Content absorbed from: `TECH_STACK_AWS.md` (stub), `aws_foundation_plan.md`

---

## Design Principle

Identity, queues, notifications, and audit logging must be designed from the beginning
so role-based messaging policies can be enforced reliably at the backend layer.
All enforcement decisions require backend implementation — UI controls are supplementary.

---

## Full Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend API | Laravel (latest stable) | REST, service-layer architecture |
| Auth tokens | Laravel Sanctum | See `IDENTITY_AND_AUTH.md` for user_sessions coexistence |
| Database | MySQL (AWS RDS) | Multi-AZ in production |
| Mobile | Expo / React Native | Offline-first design required |
| Web Admin + Public | Next.js | Admin app + public workshop pages |
| Email | AWS SES | Transactional + automation |
| Queues | AWS SQS / Laravel queue workers | All notifications processed asynchronously |
| File storage | AWS S3 | Leader images, workshop attachments |
| CDN | AWS CloudFront | S3 assets and static web delivery |
| Push notifications | Firebase Cloud Messaging / Expo Push | Mobile only |
| Monitoring | AWS CloudWatch + Sentry (optional) | Logs and error tracking |
| CI/CD | GitHub Actions | All environments |
| Secrets | AWS Parameter Store or Secrets Manager | No secrets in version control |

---

## AWS Core Services

| Service | Purpose |
|---|---|
| RDS (MySQL) | Primary database — Multi-AZ in production |
| S3 | File and asset storage |
| SES | Transactional and automation email |
| SQS | Queue backend for Laravel jobs |
| CloudWatch | Logging, monitoring, alerting |
| Parameter Store / Secrets Manager | Environment secrets and config |
| CloudFront | CDN for S3 assets and web delivery |

---

## Compute Strategy

Start minimal, scale only when validated:

1. **Initial deployment**: EC2 (single instance with autoscaling group) or ECS Fargate (minimal task)
2. **Scaling trigger**: Move to more complex compute only when load requires it
3. **Web (Next.js)**: Vercel (fast to start) or AWS Amplify
4. **Mobile (Expo)**: Expo managed workflow; OTA updates via Expo

Do not over-architect compute infrastructure for the solo-builder phase.

---

## Environment Strategy

Three environments:

| Environment | Database | Queue | Email | Storage |
|---|---|---|---|---|
| `local` | Local MySQL | `sync` or `database` driver | Log driver (no real email) | Local filesystem |
| `staging` | RDS (small instance) | SQS | SES (sandbox) | S3 (staging bucket) |
| `production` | RDS (Multi-AZ) | SQS | SES (production) | S3 (production bucket) |

Environment variables managed via `.env` locally, Parameter Store in deployed environments.
Never commit secrets. Never commit `.env` files.

---

## API Design Principles

- RESTful endpoints with versioned prefix: `/api/v1`
- Resource-based routing
- Role-aware response serialization (separate resource classes per audience)
- Tenant scope enforced on every protected route
- Bearer token authentication via Sanctum on all protected routes
- JSON API responses throughout

---

## Queue and Background Job Strategy

All of the following must be processed via queue workers — never synchronously:
- Email delivery (all types)
- Push notification delivery
- In-app notification fan-out
- Leader invitation emails
- Offline sync package generation

Queue driver:
- `database` driver for local development
- `SQS` for staging and production

Jobs must be:
- Idempotent where practical
- Retry-safe with exponential backoff
- Structured with explicit payload contracts

---

## Security Approach

- Authentication: Laravel Sanctum (Bearer tokens)
- Authorization: Policy classes per resource type
- Tenant scoping: Enforced in every DB query scope and policy
- Passwords: bcrypt (Laravel default)
- Invitation/reset tokens: Stored as hashes; raw tokens transmitted only in email
- No secrets in version control
- HTTPS enforced in all deployed environments

---

## Mobile (Expo / React Native)

- Offline-first design: workshop data must be available without connectivity after initial sync
- Local storage: AsyncStorage or SQLite for cached workshop data
- Sync strategy: see `OFFLINE_SYNC_STRATEGY.md`
- Push: Firebase Cloud Messaging via Expo Push Notifications
- Token registration: stored in `push_tokens` table per device per platform
- Deep linking for meeting URLs required (open specification issue — see README.md)

---

## Identity Planning Notes

- Phase 1: Email/password only (active). Social login schema scaffolded but inactive.
- Phase 3: Google/Facebook login activated.
- Phase 3: 2FA activated (TOTP + recovery codes).
- SSO is a Phase 4 enterprise feature.

---

## Monitoring and Observability

- CloudWatch: server logs, queue metrics, error rates, DB performance
- Sentry (optional): application error tracking and alerting
- Health check route: `GET /health` — returns 200 with timestamp (Phase 0 deliverable)
