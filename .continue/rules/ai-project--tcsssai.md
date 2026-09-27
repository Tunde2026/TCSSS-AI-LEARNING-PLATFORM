---
description: A description of your rule
---

Your rule content
# TCSSS AI Learning Platform — Workspace Rules

You are working inside the AI Learning Platform for TCSSS
(Tomia Community Senior Secondary School). This is a plain
HTML/CSS/JS project. NO frameworks. NO build step.

═══════════════════════════════════════════════════════════════
TECH STACK — NON-NEGOTIABLE
═══════════════════════════════════════════════════════════════

Frontend:  HTML5, CSS3, vanilla JavaScript only.
           NO React, Vue, Angular, jQuery, Svelte.
           NO build step, NO bundler, NO TypeScript.
           CDN libraries only: Font Awesome, Mermaid, KaTeX,
           Marked, DOMPurify, JSZip, Epub.js.

Backend:   Node.js + Express. CommonJS ONLY.
           Use require() and module.exports.
           NEVER use import/export. NEVER ESM.

Database:  PostgreSQL with pgvector.

═══════════════════════════════════════════════════════════════
PROJECT STRUCTURE
═══════════════════════════════════════════════════════════════

backend/server.js                    Main entry
backend/src/core/                    config, logger, audit, middleware
backend/src/auth/                    login, signup, sessions
backend/src/db/
  pool.js                            shared pg Pool
  index.js                           exports all queries
  migrations/                        SQL files, APPEND-ONLY
  queries/                           one file per table/domain
backend/src/ai/                      gateway, router, prompts, providers
backend/src/conversations/
backend/src/chat/                    attachments
backend/src/agents/                  Custom @AI
backend/src/library/                 books, RAG, storage, fetcher
backend/src/voice/                   transcription
backend/src/admin/                   admin routes + service
backend/src/support/                 support tickets
backend/src/tools/                   modular learning tools
  registry.js, routes.js
  quiz/, flashcards/, theory/, sketch/, practice/,
  visualization/, studyplans/, spark/, notes/,
  mistakes/, exam/, imagegen/, imagesearch/, websearch/

frontend/index.html                  login / signup
frontend/chat.html                   main chat UI
frontend/lab.html                    studying lab dashboard
frontend/library.html
frontend/settings.html
frontend/support.html
frontend/spark.html
frontend/assets/
  shell.css                          shared design system
  shell.js                           sidebar, markdown, floating Ask AI
frontend/lab/                        quiz, flashcards, theory, sketch,
                                     practice, study-plans, visualization,
                                     exam, quiz-history, mistakes, notes
frontend/admin/                      dashboard, users, library, knowledge,
                                     models, analytics, audit, backup,
                                     settings, support, user-activity

═══════════════════════════════════════════════════════════════
ARCHITECTURE RULES — DO NOT BREAK
═══════════════════════════════════════════════════════════════

1. Migrations are APPEND-ONLY.
   Never edit a merged migration. Always create the next
   numbered file: 029_*.sql, 030_*.sql.

2. Every module exposes only through its index.js.
   Other files never import internal files of a module.

3. routes.js files export the Express router DIRECTLY:
      module.exports = router;
   Other files export objects or named functions:
      module.exports = { chat, _debugState };
   Do NOT mix these up. This caused a critical bug before:
   - ai/router.js exports { route }
   - ai/routes.js exports the Express router

4. All AI provider calls go through the AI Gateway
   (backend/src/ai/gateway.js). Never call providers
   directly from a route handler.

5. Route ordering rule in Express routers:
   Static-string paths (/folders, /unread) MUST come
   BEFORE parameterized paths (/:id). Otherwise Express
   treats "folders" as an :id and returns 404.

6. Never trust the browser for:
   - user role
   - quiz scores
   - exam results
   - permissions
   The backend is authoritative.

7. Never expose secrets (keys, passwords, session secrets)
   in frontend code, HTML, logs, or prompts.

8. When adding a new tool (in backend/src/tools/):
   - Create the folder: tools/<name>/
   - Create: index.js, service.js, routes.js
   - Register with tools/registry.js
   - Mount in tools/routes.js:
       router.use('/<name>', require('./<name>').router);

9. When adding a new database table:
   - Create a NEW migration file (never edit old ones)
   - Add a queries/<name>.js file
   - Export it from db/index.js
   - Never query the DB directly from routes — always go
     through a query module

═══════════════════════════════════════════════════════════════
DESIGN SYSTEM — TCSSS
═══════════════════════════════════════════════════════════════

Always use CSS variables. Never hard-code colors.

Colors (already in shell.css):
  --navy         #11104A  (structure, sidebar)
  --soft-navy    #201F6B
  --red          #E6111E  (primary actions)
  --deep-red     #B80F1A
  --gold         #C9952E  (secondary accent)
  --blush        #FBEFEF  (page background)
  --blush-deep   #F6E0E0
  --white        #FFFFFF
  --ink          #1E1D3D  (main text)
  --slate        #5B5A6B  (secondary text)

Fonts:
  --font-head    Lora (headings)
  --font-body    Work Sans (body)
  --font-ui      JetBrains Mono (UI labels)

═══════════════════════════════════════════════════════════════
CRITICAL GOTCHAS
═══════════════════════════════════════════════════════════════

- var(--green) and var(--green-bg) DO NOT EXIST in shell.css.
  Use #2F8F4A and #EAF7EE directly.

- fa-sparkles is Font Awesome PRO — it will render blank.
  Use fa-wand-magic-sparkles instead.

- The /uploads folder is served at the URL /uploads.
  So uploads/branding/logo.png on disk → /uploads/branding/logo.png
  in the browser. Never use a Windows path like C:\Users\...

- Render has an ephemeral filesystem. Files in /uploads
  vanish on redeploy. Only the DB persists.

- Ollama and local Whisper only work on the developer's laptop.
  They are unreachable from Render.

═══════════════════════════════════════════════════════════════
STYLE FOR HOW YOU RESPOND
═══════════════════════════════════════════════════════════════

1. When asked to change a file, output the COMPLETE file content
   — not a partial diff. Partial diffs break my workflow.

2. When unsure, ask before writing code. Do not guess at:
   - file paths
   - API endpoints
   - function signatures
   - database schemas

3. Do NOT add unrelated improvements. Only do what was asked.

4. Do NOT rewrite whole files if only one function changed.

5. Do NOT invent new file names. Use the structure above.

6. When writing SQL migrations:
   - Use CREATE TABLE IF NOT EXISTS
   - Use ALTER TABLE ... ADD COLUMN IF NOT EXISTS
   - Never DROP or DELETE without explicit instruction

7. When writing JavaScript:
   - Use 'use strict' at the top of IIFEs
   - Use const/let, not var (except where matching
     existing code that uses var)
   - Escape user text before inserting into innerHTML

8. When writing CSS:
   - Use existing CSS variables
   - Mobile-first: default styles are mobile, media queries
     handle desktop
   - Prefer flexbox and grid over floats

═══════════════════════════════════════════════════════════════
WHEN TO STOP AND ASK
═══════════════════════════════════════════════════════════════

Stop and ask the user before:
- Deleting any file
- Modifying any migration in backend/src/db/migrations/
- Changing authentication or authorization logic
- Changing the database schema
- Adding a new dependency to package.json
- Changing anything in .env or config

For everything else, proceed with the task.