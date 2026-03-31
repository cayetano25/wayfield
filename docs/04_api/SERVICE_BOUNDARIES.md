# Service Boundaries Specification

## Source Authority
See `MODULE_BOUNDARIES.md` for the Laravel code module structure corresponding to these services.
See `API_ROUTE_SPEC.md` for the HTTP routes each service exposes.


## Purpose
Define separation of concerns in backend system.

---

## Core Services

### Auth Service
- login
- registration
- email verification
- password reset

---

### User Service
- profile management
- preferences

---

### Organization Service
- organization management
- user roles

---

### Workshop Service
- workshop CRUD
- logistics

---

### Session Service
- session CRUD
- capacity enforcement

---

### Leader Service
- invitations
- profile management

---

### Attendance Service
- check-in
- override
- no-show

---

### Notification Service
- send notifications
- enforce messaging rules

---

## API Examples

POST /auth/register  
POST /auth/login  
GET /workshops  
POST /sessions/select  
POST /attendance/check-in  

---

## Authorization Rules

- enforced via middleware
- tenant + role checks required