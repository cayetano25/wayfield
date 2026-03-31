# Build Sequence Checklist

## Purpose
Provide a tactical implementation checklist to keep the build grounded and sequential.

---

## Phase 0
- [ ] create Laravel backend
- [ ] configure MySQL connection
- [ ] configure queue
- [ ] configure mail
- [ ] configure storage
- [ ] configure test suite
- [ ] define module folders
- [ ] add health route

## Phase 1
- [ ] users migration
- [ ] auth_methods migration
- [ ] user_2fa_methods migration
- [ ] user_2fa_recovery_codes migration
- [ ] password reset flow
- [ ] register endpoint
- [ ] login endpoint
- [ ] verify email endpoint
- [ ] me endpoint
- [ ] organizations migration
- [ ] organization_users migration
- [ ] subscriptions migration

## Phase 2
- [ ] locations migration
- [ ] workshops migration
- [ ] workshop_logistics migration
- [ ] create workshop endpoint
- [ ] update workshop endpoint
- [ ] publish workshop endpoint
- [ ] public workshop endpoint

## Phase 3
- [ ] tracks migration
- [ ] sessions migration
- [ ] create session endpoint
- [ ] publish session endpoint
- [ ] capacity enforcement service
- [ ] overlap detection service
- [ ] session selection endpoints
- [ ] my schedule endpoint

## Phase 4
- [ ] leaders migration
- [ ] organization_leaders migration
- [ ] leader_invitations migration
- [ ] workshop_leaders migration
- [ ] session_leaders migration
- [ ] invite leader endpoint
- [ ] accept invitation endpoint
- [ ] decline invitation endpoint
- [ ] leader profile endpoint

## Phase 5
- [ ] registrations migration
- [ ] session_selections migration
- [ ] attendance_records migration
- [ ] join workshop by code endpoint
- [ ] self check-in endpoint
- [ ] leader check-in endpoint
- [ ] no-show endpoint
- [ ] roster endpoint
- [ ] leader messaging enforcement service
- [ ] audit logging for attendance/messaging

## Phase 6
- [ ] notifications migration
- [ ] notification_recipients migration
- [ ] push_tokens migration
- [ ] notification_preferences migration
- [ ] create notification endpoint
- [ ] queue notification jobs
- [ ] me notifications endpoint
- [ ] preferences endpoint

## Phase 7
- [ ] offline_sync_snapshots migration
- [ ] offline_action_queue migration
- [ ] sync version endpoint
- [ ] sync package endpoint
- [ ] offline replay endpoint

## Phase 8
- [ ] feature_flags migration
- [ ] entitlements endpoint
- [ ] feature gate service
- [ ] reporting endpoints

## Global
- [ ] policies added for each protected resource
- [ ] audit logging service wired
- [ ] public/private resources separated
- [ ] integration tests added
- [ ] time-window tests added
- [ ] tenant-boundary tests added