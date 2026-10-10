# TCSSS AI Learning Platform — Copilot Brief

You are helping fix a real, live school platform. Read this entire brief
before touching any code. Do NOT guess at file contents.

---

## 1. PROJECT IDENTITY

- Name: AI Learning Platform for TCSSS
- School: Tomia Community Senior Secondary School, Alagbado, Lagos, Nigeria
- Repo: Tunde2026/TCSSS-AI-LEARNING-PLATFORM
- Live: https://tcsss-ai-learning-platform.onrender.com
- Lead dev: Emmanuel Ajibade (solo, no other coders on the team)
- Built for the TechUp Boys Inter-District AI Competition (Learntor Foundation)
- Free for TCSSS students. No ads. No subscriptions.

---

## 2. TECH STACK — NON-NEGOTIABLE

Frontend:  Plain HTML5 / CSS3 / vanilla JS.
           NO React, NO Vue, NO build step, NO bundler.
           CDN libs only: Font Awesome, Mermaid, KaTeX, Marked,
           DOMPurify, JSZip, Epub.js.

Backend:   Node.js v24 (Render) / v25 (local). Express 4.x.
           CommonJS only — require()/module.exports. Never ESM.

Database:  PostgreSQL (local) + Neon (production). pgvector for RAG.

AI:        AI Gateway → provider chain: Groq → Cerebras → Google →
           NVIDIA → OpenRouter → Ollama (local only).
           All model requests go through the gateway.

Deploy:    Render free tier. Root dir: AI-Learning-System.
           Auto-deploy on push to main. Ephemeral filesystem.

---

## 3. FILE STRUCTURE

backend/
  server.js                 ← mounts every router
  src/
    core/                   ← config, logger, settings, audit, middleware
    auth/                   ← signup, login, sessions, guards
    db/
      pool.js               ← shared pg Pool — exports { pool, ping }
      index.js              ← re-exports all query modules
      migrations/           ← APPEND-ONLY SQL files (never edit old ones)
      queries/              ← one file per domain
    ai/
      gateway.js            ← provider fallback chain
      router.js             ← resolves @mentions — exports { route }
      routes.js             ← exports Express router directly
      quick.js              ← floating Ask AI panel
      prompts/system.js     ← main system prompt
      providers/            ← groq, cerebras, google, nvidia,
                              openrouter, ollama
    conversations/          ← chat threads
    chat/                   ← attachments
    agents/                 ← Custom @AI
    library/                ← books, RAG, storage, fetcher
    voice/                  ← speech-to-text
    admin/                  ← admin routes + service + backup
    support/                ← student support tickets
    announcements/          ← admin announcements system
    badges/                 ← user badges + streaks
    tools/
      registry.js
      routes.js             ← mounts every tool sub-router
      quiz/ flashcards/ theory/ sketch/ practice/ visualization/
      studyplans/ mistakes/ notes/ imagegen/ imagesearch/
      websearch/ spark/

frontend/
  index.html                ← LANDING PAGE (rich SEO content) + login at bottom
  chat.html                 ← main chat UI — all inline widgets
  lab.html library.html settings.html spark.html support.html
  badges.html about.html
  assets/
    shell.css               ← shared design system
    shell.js                ← sidebar, mobile bar, markdown, Ask AI
    announcements.js        ← student-facing announcement popups
    badges.js               ← verified checkmark, streak pill, toasts
    pwa.js                  ← service worker registration
  lab/                      ← quiz, flashcards, theory, sketch, exam, etc.
  admin/                    ← dashboard, users, library, support, etc.
  manifest.json
  sw.js                     ← service worker
  robots.txt
  sitemap.xml

---

## 4. ARCHITECTURE RULES — DO NOT BREAK

1. LLM decides; application executes.
2. Migrations are APPEND-ONLY. Never edit a merged migration.
   New: 034_*.sql, 035_*.sql, etc.
3. Every module exposes through its index.js.
4. `routes.js` exports the Express router directly:
     module.exports = router;
   Other files export objects/named functions.
   NEVER mix these.
5. All AI requests go through the AI Gateway.
6. Never trust the browser for roles, scores, exam results.
7. Never expose secrets in frontend, HTML, logs, commits, chats.
8. In Express: static-string paths (/folders) MUST come BEFORE
   parameterized paths (/:id), or Express treats "folders" as an :id.

---

## 5. DESIGN SYSTEM

Colors:
  Navy        #11104A
  Soft Navy   #201F6B
  Red         #E6111E
  Deep Red    #B80F1A
  Gold        #C9952E
  Blush       #FBEFEF
  Blush Deep  #F6E0E0
  White       #FFFFFF
  Ink         #1E1D3D
  Slate       #5B5A6B

Fonts:
  Headings:  Lora
  Body:      Work Sans
  UI labels: JetBrains Mono

IMPORTANT: `var(--green)` and `var(--green-bg)` DO NOT EXIST.
Use #2F8F4A and #EAF7EE directly.

---

## 6. HOW EACH SYSTEM BEHAVES

### AUTHENTICATION
- `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/me`
- Sessions via `connect.sid` cookie, PostgreSQL-backed.
- Login/signup form lives at the bottom of index.html (id="login").
- Redirects to index.html#login when session expires.

### CHAT (chat.html)
- POST /api/ai/chat with { messages, conversationId, attachmentIds }
- Backend runs ai/router.js route() then ai/routes.js detectQuizIntent etc.
- Backend returns { reply, provider, conversationId, tools, images, webSearch }
- addMessage() splits tools by type and builds inline widgets:
    quiz, flashcards, theory, sketch, exam, practice, mistakes, notes,
    visualization, studyplan, image
- Each widget fetches its own data from /api/tools/<type>/:id
- Message actions: Copy, Reply, Edit, Listen (TTS), Regenerate,
  Save as note (all), Save to knowledge (admin)

### TOOLS (backend/src/tools/)
- Each tool has: routes.js, service.js, index.js
- All tools mounted under /api/tools/<name>
- Registry at tools/registry.js lists all tools

### ANNOUNCEMENTS
- Table: announcements (title, body, display_mode, priority,
  is_active, starts_at, expires_at, target_role, cooldown_hours,
  modal_delay_seconds, inline_delay_seconds, action_*)
- Table: announcement_dismissals (per-user cooldown tracking)
- Table: announcement_views (per-user view count)
- Table: announcement_replies (user replies to announcements)
- API: GET /api/announcements/active, POST /api/announcements/:id/dismiss,
       POST /api/announcements/:id/view,
       GET/POST /api/announcements/:id/replies
- Frontend: frontend/assets/announcements.js — shows popups/banners,
  loaded by shell.js on every non-admin page
- Admin page: frontend/admin/announcements.html

### BADGES
- Tables: user_badges, user_streaks, user_activity_log
- API: GET /api/badges/me returns { user, badges, streak, newly_awarded }
- Frontend: badges.js shows verified checkmark, streak pill, toasts
- Badges page: frontend/badges.html
- award() in badges/service.js does ONE insert with earned_at = now()

### LIBRARY
- Books stored in library_documents
- Upload via admin/library.html → POST /api/library/upload
- Fields: title, author, subject, level, mime_type, storage_path, etc.
- On Render: files stored on ephemeral disk — vanish on redeploy
- Reader supports PDF, EPUB, plain text

### SIDEBAR (frontend/assets/shell.js)
- Renders into #sidebar-mount on every page
- On student pages: NAV_ITEMS (Chat, Messages, Spark, Lab, Library,
  Achievements, Progress)
- On admin pages: NAV_ITEMS + a "Back to app" link
- Mobile: sidebar hidden, bottom nav (Chat / Lab / Library / More)

### MOBILE
- Bottom nav (bottom-nav class) below 860px
- More sheet opens with additional links
- Admin pages: hamburger to open sidebar

---

## 7. KNOWN BUGS (as of this brief)

1. Admin library upload: fails with "cannot upload" error
2. Announcements: not displaying reliably for students
3. New chat: on mobile, doesn't work properly
4. Various admin pages: missing nav

Verify each before attempting a fix.

---

## 8. HOW TO HELP ME

When I ask you to fix something:

1. Ask me to paste the CURRENT content of every file involved.
   Do NOT guess at file contents.
2. Read the actual code before proposing changes.
3. Make the smallest change that fixes the bug.
4. If a patch has anchors (search strings), show me what it
   will match against — do not assume.
5. Prefer whole-file replacements over partial patches when the
   file is short (under 500 lines).
6. Never touch migrations after they're applied.
7. Never invent new API endpoints — check the existing ones first.

When I describe a bug:
- Ask: what page, what did you click, what happened, any console errors
- Then: what does the network tab show for the failing request

Do NOT:
- Rewrite whole features without being asked
- Add npm packages without asking
- Change the tech stack
- Add React/Vue/anything with a build step
- Delete code without understanding why it exists

---

## 9. ENVIRONMENT VARIABLES

Local .env (never commit):
  PORT=3000
  DATABASE_URL=postgresql://...
  SESSION_SECRET=<96-char hex>
  GROQ_KEY_1, GROQ_KEY_2, CEREBRAS_KEY_1, GOOGLE_KEY_1,
  NVIDIA_KEY_1, OPENROUTER_KEY_1
  TAVILY_API_KEY, PEXELS_API_KEY, POLLINATIONS_API_KEY
  OPENAI_API_KEY (for voice transcription)
  VOICE_PROVIDER=openai
  OLLAMA_URL (local only)

Render: same, but OLLAMA_ENABLED=false, no PORT.

---

## 10. CURRENT WORKFLOW

- Solo developer on Windows + Git Bash
- Push to GitHub, Render auto-deploys
- Local Postgres + Neon (production)
- Testing on Android phone + Chrome DevTools mobile view
- Has a Chrome extension ("Simulator") that injects a strict CSP —
  MUST test in Incognito or disable the extension

END OF BRIEF
