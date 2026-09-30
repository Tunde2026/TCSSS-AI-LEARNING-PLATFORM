# Diagnostic Report

**Date:** 2026-09-30T15:44:51.245Z
**Target:** http://localhost:3000
**Result:** 22 passed · 17 failed · 39 total

## Failures

### GET /api/support

- **Status:** 404
- **Time:** 22ms

```json
{
  "error": "Not found"
}
```

### POST /api/announcements/:id/reply (BUG: broken)

- **Status:** 429
- **Time:** 5ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/announcements/:id/my-replies

- **Status:** 429
- **Time:** 50ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/admin/announcements/:id/replies

- **Status:** 429
- **Time:** 153ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/admin/announcements/replies

- **Status:** 429
- **Time:** 12ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/admin/announcements/replies/unread/count

- **Status:** 429
- **Time:** 9ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/admin/announcements/:id/views

- **Status:** 429
- **Time:** 29ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/badges/me

- **Status:** 429
- **Time:** 7ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/badges/catalog

- **Status:** 429
- **Time:** 7ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/badges/progress (BUG: not loading)

- **Status:** 429
- **Time:** 30ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/conversations/:id

- **Status:** 429
- **Time:** 17ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/tools/mistakes

- **Status:** 429
- **Time:** 5ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/tools/notes

- **Status:** 429
- **Time:** 30ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/tools/sketch

- **Status:** 429
- **Time:** 6ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### POST /api/ai/chat (Hello)

- **Status:** 429
- **Time:** 162ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### POST /api/voice/transcribe (no file)

- **Status:** 429
- **Time:** 47ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

### GET /api/theme/hero-video

- **Status:** 429
- **Time:** 6ms

```json
{
  "error": "Too many requests. Please slow down."
}
```

## All results

| Test | Status | Time |
|------|--------|------|
| Login (admin) | ✓ 200 | 422ms |
| GET /health | ✓ 200 | 5ms |
| GET /api/platform/info | ✓ 200 | 3ms |
| GET /api/auth/me | ✓ 200 | 23ms |
| GET /api/admin/stats | ✓ 200 | 177ms |
| GET /api/admin/users | ✓ 200 | 10ms |
| GET /api/admin/users/stats | ✓ 200 | 152ms |
| GET /api/admin/analytics/summary | ✓ 200 | 294ms |
| GET /api/admin/analytics/recent | ✓ 200 | 157ms |
| GET /api/admin/audit | ✓ 200 | 30ms |
| GET /api/admin/audit/meta | ✓ 200 | 9ms |
| GET /api/support | ✗ 404 | 22ms |
| GET /api/support/unread/count | ✓ 200 | 20ms |
| GET /api/support/team | ✓ 200 | 4ms |
| POST /api/support (create ticket) | ✓ 201 | 27ms |
| GET /api/admin/support | ✓ 200 | 11ms |
| GET /api/admin/support/folders | ✓ 200 | 25ms |
| GET /api/admin/support/unread/count | ✓ 200 | 5ms |
| GET /api/admin/announcements | ✓ 200 | 35ms |
| GET /api/announcements/active | ✓ 200 | 30ms |
| POST /api/admin/announcements | ✓ 201 | 15ms |
| POST /api/announcements/:id/view | ✓ 200 | 7ms |
| POST /api/announcements/:id/dismiss | ✓ 200 | 7ms |
| POST /api/announcements/:id/reply (BUG: broken) | ✗ 429 | 5ms |
| GET /api/announcements/:id/my-replies | ✗ 429 | 50ms |
| GET /api/admin/announcements/:id/replies | ✗ 429 | 153ms |
| GET /api/admin/announcements/replies | ✗ 429 | 12ms |
| GET /api/admin/announcements/replies/unread/count | ✗ 429 | 9ms |
| GET /api/admin/announcements/:id/views | ✗ 429 | 29ms |
| GET /api/badges/me | ✗ 429 | 7ms |
| GET /api/badges/catalog | ✗ 429 | 7ms |
| GET /api/badges/progress (BUG: not loading) | ✗ 429 | 30ms |
| GET /api/conversations/:id | ✗ 429 | 17ms |
| GET /api/tools/mistakes | ✗ 429 | 5ms |
| GET /api/tools/notes | ✗ 429 | 30ms |
| GET /api/tools/sketch | ✗ 429 | 6ms |
| POST /api/ai/chat (Hello) | ✗ 429 | 162ms |
| POST /api/voice/transcribe (no file) | ✗ 429 | 47ms |
| GET /api/theme/hero-video | ✗ 429 | 6ms |