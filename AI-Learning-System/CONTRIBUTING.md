# Contributing

1. One folder, one owner.
2. One feature = one branch = one PR.
3. Never push to `main` directly.
4. Never commit `.env`. Secrets stay on the server.
5. Every module exports through its `index.js` only.
6. Migrations are append-only. Never edit a merged migration.
7. Update `shared/api-contracts.md` before changing an endpoint.
8. No new frameworks or shared CSS/JS without discussion.
9. Do not create empty folders "for later."

## Branch names
- `feat/<area>-<short-desc>`   e.g. `feat/auth-signup`
- `fix/<area>-<short-desc>`    e.g. `fix/ai-groq-timeout`

## Before opening a PR
- [ ] No `.env` in the diff
- [ ] No direct cross-module imports (only via `index.js`)
- [ ] If schema changed, added a NEW migration file
- [ ] If an endpoint changed, `shared/api-contracts.md` updated