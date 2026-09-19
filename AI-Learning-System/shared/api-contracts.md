# API Contracts

Update this file BEFORE changing any endpoint. Frontend and backend
must agree here first.

Base URL (dev): http://localhost:3000

---

## Auth

### POST /api/auth/signup
Body: { name, email, password }
- 201 { ok: true, user: { id, name, email, role, created_at } }
- 400 { error }                          validation failure
- 409 { error, code: "EMAIL_TAKEN" }     email already registered

### POST /api/auth/login
Body: { email, password }
- 200 { ok: true, user: { id, name, email, role } }
- 400 { error }
- 401 { error, code: "BAD_CREDENTIALS" } wrong password
- 404 { error, code: "NO_ACCOUNT" }      email not registered

### POST /api/auth/logout
- 200 { ok: true }

### GET /api/auth/me
- 200 { user: { id, name, email, role } }
- 401 { error: "Unauthorized" }

---

## AI

### POST /api/ai/chat
Body: { messages: [{ role, content }] }
- 200 { reply: string, provider: string }   (provider removed in production)
- 400 { error }                             malformed messages
- 503 { error }                             all providers failed

### GET /api/ai/status       (dev-only)
- 200 { providers: [...], keyHealth: {...} }