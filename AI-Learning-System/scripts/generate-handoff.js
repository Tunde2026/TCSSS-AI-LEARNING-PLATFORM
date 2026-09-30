#!/usr/bin/env node
// ============================================================
// scripts/generate-handoff.js
// ------------------------------------------------------------
// Walks the project and produces HANDOFF.md — a portable,
// complete description that can be pasted into any AI model
// (Qwen, DeepSeek, Claude, ChatGPT, Gemini) so it understands
// the project instantly.
//
// Run:  node scripts/generate-handoff.js
// Out:  HANDOFF.md (in project root)
//
// Safety: never reads .env (only .env.example). Never includes
// real keys. Masks anything that looks like a secret.
// ============================================================

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT  = path.join(ROOT, 'HANDOFF.md');

/* ============================================================
   Helpers
   ============================================================ */
function read(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_) { return null; }
}

function exists(p) {
  try { return fs.existsSync(p); } catch (_) { return false; }
}

function rel(p) {
  return path.relative(ROOT, p).replace(/\\/g, '/');
}

/* Recursively walk a directory. Skips node_modules, .git,
   uploads content, and dot-folders. */
function walk(dir, options) {
  options = options || {};
  const ignore = options.ignore || [
    'node_modules', '.git', '.github', '.continue',
    'uploads', 'dist', 'build', 'coverage', '.cache',
  ];
  const files = [];

  function recurse(current, depth) {
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); }
    catch (_) { return; }

    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;
      if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;

      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        recurse(full, depth + 1);
      } else {
        files.push(full);
      }
    }
  }
  recurse(dir, 0);
  return files;
}

/* Mask a value that might be a secret */
function maskSecret(v) {
  if (!v) return '';
  v = String(v).trim();
  if (!v) return '';
  // Common key prefixes
  if (/^(sk-|gsk_|sk-proj-|csk-|nvapi-|AIza|pk_|xai-)/.test(v)) {
    return v.slice(0, 6) + '…[REDACTED]';
  }
  if (v.length > 40 && /^[A-Za-z0-9_\-\.]+$/.test(v)) {
    return v.slice(0, 6) + '…[REDACTED]';
  }
  return v;
}

/* ============================================================
   Parsers
   ============================================================ */

/* Parse CREATE TABLE and ALTER TABLE from SQL migrations */
function parseMigrations(migrationsDir) {
  const out = { migrations: [], tables: {} };

  if (!exists(migrationsDir)) return out;

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const f of files) {
    const sql = read(path.join(migrationsDir, f)) || '';
    out.migrations.push({ name: f, bytes: sql.length, lines: sql.split('\n').length });

    // CREATE TABLE
    const createRe = /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s*\(([\s\S]*?)\)\s*;/gi;
    let m;
    while ((m = createRe.exec(sql)) !== null) {
      const name = m[1];
      const body = m[2];
      const columns = [];

      // Split by comma at depth 0
      let depth = 0, cur = '';
      const parts = [];
      for (const ch of body) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
        else cur += ch;
      }
      parts.push(cur);

      for (const raw of parts) {
        const line = raw.trim();
        if (!line) continue;
        if (/^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT|EXCLUDE)/i.test(line)) {
          columns.push({ name: null, def: line });
          continue;
        }
        const colMatch = line.match(/^([a-z_][a-z0-9_]*)\s+([A-Za-z0-9_]+(?:\s+[A-Za-z0-9_]+)?(?:\s*\([^)]*\))?)/);
        if (colMatch) {
          columns.push({ name: colMatch[1], def: line });
        } else {
          columns.push({ name: null, def: line });
        }
      }
      out.tables[name] = out.tables[name] || { columns: [], from: [] };
      out.tables[name].columns = columns;
      out.tables[name].from.push(f);
    }

    // ALTER TABLE ... ADD COLUMN
    const alterRe = /ALTER\s+TABLE\s+([a-z_][a-z0-9_]*)\s+([\s\S]*?);/gi;
    while ((m = alterRe.exec(sql)) !== null) {
      const table = m[1];
      const ops = m[2];
      const addColRe = /ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+([a-z_][a-z0-9_]*)\s+([A-Za-z0-9_]+(?:\([^)]*\))?)/gi;
      let cm;
      while ((cm = addColRe.exec(ops)) !== null) {
        out.tables[table] = out.tables[table] || { columns: [], from: [] };
        out.tables[table].columns.push({ name: cm[1], def: cm[0] });
        if (!out.tables[table].from.includes(f)) out.tables[table].from.push(f);
      }
    }
  }

  return out;
}

/* Parse routes from Express router files */
function parseRoutes(routesFile) {
  const src = read(routesFile);
  if (!src) return [];
  const routes = [];
  const re = /router\.(get|post|patch|put|delete)\s*\(\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    routes.push({ method: m[1].toUpperCase(), path: m[2] });
  }
  return routes;
}

/* Extract module.exports shape */
function parseExports(file) {
  const src = read(file);
  if (!src) return null;

  // module.exports = { a, b, c };
  const objRe = /module\.exports\s*=\s*\{([\s\S]*?)\};?/;
  const om = src.match(objRe);
  if (om) {
    const inner = om[1];
    const keys = [];
    const keyRe = /(?:^|\n|,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*[,:\n}]/g;
    let km;
    while ((km = keyRe.exec(inner)) !== null) {
      if (!keys.includes(km[1])) keys.push(km[1]);
    }
    return { type: 'object', keys: keys.slice(0, 40) };
  }

  // module.exports = router
  if (/module\.exports\s*=\s*router/.test(src)) return { type: 'router' };

  // module.exports = someIdentifier
  const singleRe = /module\.exports\s*=\s*([a-zA-Z_$][a-zA-Z0-9_$]*);/;
  const sm = src.match(singleRe);
  if (sm) return { type: 'single', name: sm[1] };

  return null;
}

/* ============================================================
   Extractors
   ============================================================ */

/* Extract env var names from .env.example */
function extractEnvVars() {
  const p = path.join(ROOT, '.env.example');
  const src = read(p);
  if (!src) return { source: null, vars: [] };

  const vars = [];
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    vars.push({ name: m[1], value: maskSecret(m[2]) });
  }
  return { source: '.env.example', vars };
}

/* Extract :root CSS variables */
function extractCssVars(cssFile) {
  const src = read(cssFile);
  if (!src) return [];
  const rootMatch = src.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) return [];
  const vars = [];
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(rootMatch[1])) !== null) {
    vars.push({ name: '--' + m[1], value: m[2].trim() });
  }
  return vars;
}

/* Extract nav items from shell.js */
function extractNavItems(shellJs) {
  const src = read(shellJs);
  if (!src) return {};
  const out = {};

  function captureArray(name) {
    const re = new RegExp(`var\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\];`, 'm');
    const m = src.match(re);
    if (!m) return [];
    const items = [];
    const iRe = /\{\s*href:\s*['"]([^'"]+)['"]\s*,\s*icon:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]/g;
    let im;
    while ((im = iRe.exec(m[1])) !== null) {
      items.push({ href: im[1], icon: im[2], label: im[3] });
    }
    return items;
  }

  out.nav          = captureArray('NAV_ITEMS');
  out.admin        = captureArray('ADMIN_SECTIONS');
  out.lab          = captureArray('LAB_SECTIONS');
  out.settings     = captureArray('SETTINGS_ITEM');
  return out;
}

/* ============================================================
   Document builder
   ============================================================ */
function buildDocument() {
  const lines = [];
  const push = (s) => lines.push(s == null ? '' : String(s));
  const hr = () => push('\n---\n');

  const now = new Date().toISOString();

  /* ---------- Title ---------- */
  push('# TCSSS AI Learning Platform — Complete Handoff Document');
  push('');
  push('> **Purpose:** paste this entire file into any AI model (Qwen, DeepSeek,');
  push('> Claude, ChatGPT, Gemini) so it fully understands the project before');
  push('> doing any work. It contains the architecture, every module, every');
  push('> endpoint, every database table, and the design system.');
  push('>');
  push('> **Generated:** ' + now);
  push('> **Generated by:** `scripts/generate-handoff.js`');
  push('> **Repository root:** `' + ROOT + '`');
  push('');

  /* ---------- Table of contents ---------- */
  push('## Table of Contents');
  push('');
  const sections = [
    '1. Project Identity',
    '2. Tech Stack',
    '3. Architecture Rules (non-negotiable)',
    '4. Complete File Tree',
    '5. Database Schema',
    '6. Backend Modules',
    '7. API Surface',
    '8. Frontend Pages',
    '9. Design System',
    '10. Authentication & Roles',
    '11. AI Layer (Gateway, Providers, Tools)',
    '12. Environment Variables',
    '13. Known Issues',
    '14. Development Conventions',
    '15. Current State',
  ];
  sections.forEach(s => push('- ' + s));
  push('');
  hr();

  /* ---------- 1. Project Identity ---------- */
  push('## 1. Project Identity');
  push('');
  push('**Name:** AI Learning Platform for TCSSS');
  push('**School:** Tomia Community Senior Secondary School');
  push('**Purpose:** A free, AI-powered study environment for Nigerian secondary');
  push('school students. Combines AI chat, quizzes, flashcards, practice,');
  push('exam mode, visualizations, and study plans into one place.');
  push('');
  push('**Live URL:** https://tcsss-ai-learning-platform.onrender.com');
  push('**GitHub:** https://github.com/Tunde2026/TCSSS-AI-LEARNING-PLATFORM');
  push('**Local path:** ~/Documents/ai project/AI-Learning-System');
  push('**Official school site:** https://gideon-olukanni.github.io/TCSSS/');
  push('');
  push('**Team:**');
  push('- **Emmanuel Ajibade** — Project Lead (aduraemmanuel123@gmail.com)');
  push('- Akinola Daniel — Team');
  push('- Matthias Olatunde — Team');
  push('- Ikobayo Victor — Team');
  push('- Adebowale Elijah — Team');
  push('- Emmanuel Excel — Team');
  push('- Oyedele David — Team');
  push('- Kehinde Joshua Oladipupo — Team');
  push('- Abdulkabir Isiaka — Team');
  push('- Timilehin Olatunji — Team');
  push('- Al Arashi Al Amin Olanrewaju — Team');
  push('');
  push('**Learning cycle the platform is built around:**');
  push('Learn → Visualize → Practice → Analyze → Adapt');
  push('');
  hr();

  /* ---------- 2. Tech Stack ---------- */
  push('## 2. Tech Stack');
  push('');
  push('### Frontend');
  push('- Plain HTML5, CSS3, vanilla JavaScript');
  push('- NO React, Vue, Angular, build step, or bundler');
  push('- CDN libraries only:');
  push('  - Font Awesome 6.7.2 (icons)');
  push('  - Lora, Work Sans, JetBrains Mono (Google Fonts)');
  push('  - Mermaid 10.9.1 (diagrams)');
  push('  - KaTeX 0.16.11 (math rendering)');
  push('  - Marked 12 (Markdown)');
  push('  - DOMPurify 3 (sanitization)');
  push('  - Chart.js 4.4.1 (analytics — optional, page has CSS fallback)');
  push('');
  push('### Backend');
  push('- Node.js v24 on Render, v25 on laptop');
  push('- Express 4.x');
  push('- **CommonJS only** — `require()` / `module.exports`. Never ESM.');
  push('- `pg` for Postgres');
  push('- `multer` for file uploads');
  push('- `bcrypt` for passwords');
  push('- `express-session` + `connect-pg-simple` for sessions');
  push('');
  push('### Database');
  push('- Local: PostgreSQL 17 on Windows');
  push('- Production: Neon (US East)');
  push('- `pgvector` extension for 768-dim embeddings (library RAG)');
  push('');
  push('### AI');
  push('- Provider fallback chain:');
  push('  - Groq (primary)');
  push('  - Cerebras');
  push('  - Google (Gemini)');
  push('  - NVIDIA NIM');
  push('  - OpenRouter');
  push('  - Ollama (local, last resort)');
  push('- Vision: OpenAI gpt-4o-mini, falling back to Ollama llava:7b');
  push('- Voice: OpenAI Whisper → Deepgram → Local Whisper');
  push('- Web search: Tavily');
  push('- Image search: Pexels');
  push('- Image generation: Pollinations');
  push('- Animated backgrounds: Giphy');
  push('');
  push('### Deployment');
  push('- Render free tier (Oregon)');
  push('- Root Directory: `AI-Learning-System`');
  push('- Auto-deploy on push to `main`');
  push('- **Ephemeral filesystem** — uploads vanish on redeploy');
  push('- Cold start ~30s after 15 min idle (mitigated by UptimeRobot pings)');
  push('');
  hr();

  /* ---------- 3. Architecture Rules ---------- */
  push('## 3. Architecture Rules (non-negotiable)');
  push('');
  push('These rules were established after painful bugs. Do not break them.');
  push('');
  push('### Rule 1 — The LLM decides; the application executes.');
  push('The AI returns structured intents (tool calls). The backend validates');
  push('and executes them. The AI never directly performs privileged operations.');
  push('');
  push('### Rule 2 — Migrations are append-only.');
  push('Never edit a merged migration. Always create a new file: `023_*.sql`,');
  push('`024_*.sql`, etc. The next number is 034.');
  push('');
  push('### Rule 3 — Every module exposes only through its `index.js`.');
  push('Routers, services, and helpers are re-exported from `index.js`. Other');
  push('modules import from the folder root, not from individual files.');
  push('');
  push('### Rule 4 — `routes.js` exports the Express router directly.');
  push('- `routes.js` files do: `module.exports = router;`');
  push('- Other files do: `module.exports = { fn1, fn2 };`');
  push('- NEVER mix these. This caused a critical bug before.');
  push('');
  push('### Rule 5 — All AI requests go through the AI Gateway.');
  push('Never call providers directly from routes. Always `require(\'../ai\').gateway.chat()`');
  push('or the higher-level `runWithTools()` in `ai/tool-executor.js`.');
  push('');
  push('### Rule 6 — Never trust the browser for roles, scores, exam results.');
  push('Server-side scoring only. The client never sends the truth.');
  push('');
  push('### Rule 7 — Never expose secrets.');
  push('No secrets in frontend code, HTML, logs, commits, screenshots, or chat.');
  push('The `.env` file is never committed. `.env.example` contains only names.');
  push('');
  push('### Rule 8 — Route ordering in Express.');
  push('Static-string paths (`/folders`, `/unread`) MUST come BEFORE parameterized');
  push('paths (`/:id`), or Express treats `folders` as an `:id` and 404s.');
  push('');
  push('### Rule 9 — Protected accounts cannot be demoted, suspended, or deleted.');
  push('Enforced both at the API layer and via the `is_protected` database flag.');
  push('');
  hr();

  /* ---------- 4. File Tree ---------- */
  push('## 4. Complete File Tree');
  push('');
  push('```');
  const ignore = [
    'node_modules', '.git', '.github', '.continue',
    'uploads', 'dist', 'build', 'coverage', '.cache',
    '.env', 'package-lock.json',
  ];

  function printTree(dir, prefix, depth) {
    if (depth > 4) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }

    entries = entries
      .filter(e => !ignore.includes(e.name))
      .filter(e => !e.name.startsWith('.') || e.name === '.env.example')
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const isDir = entry.isDirectory();
      push(prefix + (isDir ? '📁 ' : '   ') + entry.name + (isDir ? '/' : ''));
      if (isDir) printTree(full, prefix + '   ', depth + 1);
    }
  }
  printTree(ROOT, '', 0);
  push('```');
  push('');
  hr();

  /* ---------- 5. Database Schema ---------- */
  push('## 5. Database Schema');
  push('');
  const migrationsDir = path.join(ROOT, 'backend', 'src', 'db', 'migrations');
  const mig = parseMigrations(migrationsDir);

  push('### Migration files (' + mig.migrations.length + ' total)');
  push('');
  push('```');
  for (const m of mig.migrations) {
    push(m.name + '  (' + m.lines + ' lines)');
  }
  push('```');
  push('');

  push('### Tables');
  push('');
  const tableNames = Object.keys(mig.tables).sort();
  for (const t of tableNames) {
    push('#### `' + t + '`');
    push('');
    push('Source: ' + (mig.tables[t].from || []).join(', '));
    push('');
    push('```sql');
    for (const c of mig.tables[t].columns) {
      push('  ' + c.def);
    }
    push('```');
    push('');
  }
  hr();

  /* ---------- 6. Backend Modules ---------- */
  push('## 6. Backend Modules');
  push('');
  const backendSrc = path.join(ROOT, 'backend', 'src');
  if (exists(backendSrc)) {
    const dirs = fs.readdirSync(backendSrc, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();

    for (const mod of dirs) {
      const modDir = path.join(backendSrc, mod);
      const indexFile = path.join(modDir, 'index.js');
      push('### `' + mod + '/`');
      push('');

      if (exists(indexFile)) {
        const ex = parseExports(indexFile);
        if (ex) {
          push('Exports from `index.js`: `' + (ex.keys || []).join(', ') + '`');
        } else {
          push('`index.js` exists but exports are not parsed.');
        }
      } else {
        push('_(no index.js — module is imported directly)_');
      }

      const modFiles = walk(modDir, { ignore: ignore });
      push('');
      push('Files:');
      push('');
      for (const f of modFiles) {
        push('- `' + rel(f) + '`');
      }
      push('');
    }
  }
  hr();

  /* ---------- 7. API Surface ---------- */
  push('## 7. API Surface');
  push('');
  push('Every route file is scanned. Method, path, and file are listed.');
  push('');

  const routeFiles = walk(backendSrc).filter(f => f.endsWith('routes.js'));
  const mounts = [
    { prefix: '/api/auth',          file: 'backend/src/auth/routes.js' },
    { prefix: '/api/ai',            file: 'backend/src/ai/routes.js' },
    { prefix: '/api/conversations', file: 'backend/src/conversations/routes.js' },
    { prefix: '/api/chat',          file: 'backend/src/chat/routes.js' },
    { prefix: '/api/tools',         file: 'backend/src/tools/routes.js' },
    { prefix: '/api/agents',        file: 'backend/src/agents/routes.js' },
    { prefix: '/api/library',       file: 'backend/src/library/routes.js' },
    { prefix: '/api/voice',         file: 'backend/src/voice/routes.js' },
    { prefix: '/api/admin',         file: 'backend/src/admin/routes.js' },
    { prefix: '/api/support',       file: 'backend/src/support/routes.js' },
    { prefix: '/api/badges',        file: 'backend/src/badges/routes.js' },
    { prefix: '/api/announcements', file: 'backend/src/announcements/routes.js' },
    { prefix: '/api/theme',         file: 'backend/src/theme/routes.js' },
  ];

  for (const m of mounts) {
    const fullPath = path.join(ROOT, m.file);
    if (!exists(fullPath)) {
      push('### ' + m.prefix);
      push('_(file missing: ' + m.file + ')_');
      push('');
      continue;
    }
    const routes = parseRoutes(fullPath);
    push('### ' + m.prefix);
    push('File: `' + m.file + '`');
    push('');
    if (!routes.length) {
      push('_(no routes parsed)_');
    } else {
      for (const r of routes) {
        push('- `' + r.method.padEnd(7) + ' ' + m.prefix + r.path + '`');
      }
    }
    push('');
  }

  // Sub-routers under /api/tools
  const toolsDir = path.join(ROOT, 'backend', 'src', 'tools');
  if (exists(toolsDir)) {
    push('### /api/tools/* (sub-routers)');
    push('');
    const toolFolders = fs.readdirSync(toolsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)
      .sort();
    for (const t of toolFolders) {
      const tf = path.join(toolsDir, t, 'routes.js');
      if (!exists(tf)) continue;
      const routes = parseRoutes(tf);
      if (!routes.length) continue;
      push('**/api/tools/' + t + '**');
      for (const r of routes) {
        push('- `' + r.method.padEnd(7) + ' /api/tools/' + t + r.path + '`');
      }
      push('');
    }
  }

  // Admin announcement sub-routes
  const annAdmin = path.join(ROOT, 'backend', 'src', 'announcements', 'adminRoutes.js');
  if (exists(annAdmin)) {
    const routes = parseRoutes(annAdmin);
    if (routes.length) {
      push('### /api/admin/announcements (from `announcements/adminRoutes.js`)');
      push('');
      for (const r of routes) {
        push('- `' + r.method.padEnd(7) + ' /api/admin/announcements' + r.path + '`');
      }
      push('');
    }
  }

  hr();

  /* ---------- 8. Frontend Pages ---------- */
  push('## 8. Frontend Pages');
  push('');
  const frontendDir = path.join(ROOT, 'frontend');
  if (exists(frontendDir)) {
    const htmlFiles = walk(frontendDir).filter(f => f.endsWith('.html'));
    for (const f of htmlFiles) {
      const r = rel(f);
      const size = fs.statSync(f).size;
      push('- `' + r + '` (' + Math.round(size / 1024) + ' KB)');
    }
  } else {
    push('_(frontend folder not found)_');
  }
  push('');

  // Nav items
  const shellJs = path.join(frontendDir, 'assets', 'shell.js');
  if (exists(shellJs)) {
    const nav = extractNavItems(shellJs);
    push('### Sidebar navigation (from `shell.js`)');
    push('');
    push('**Main nav:**');
    for (const item of (nav.nav || [])) {
      push('- `' + item.href + '` — ' + item.label);
    }
    push('');
    if (nav.admin && nav.admin.length) {
      push('**Admin sections:**');
      for (const item of nav.admin) {
        push('- `' + item.href + '` — ' + item.label);
      }
      push('');
    }
    if (nav.lab && nav.lab.length) {
      push('**Studying Lab sections:**');
      for (const item of nav.lab) {
        push('- `' + item.href + '` — ' + item.label);
      }
      push('');
    }
  }

  hr();

  /* ---------- 9. Design System ---------- */
  push('## 9. Design System');
  push('');
  const shellCss = path.join(frontendDir, 'assets', 'shell.css');
  if (exists(shellCss)) {
    const cssVars = extractCssVars(shellCss);
    if (cssVars.length) {
      push('### CSS variables (`:root` block in `shell.css`)');
      push('');
      push('```css');
      for (const v of cssVars) {
        push(v.name + ': ' + v.value + ';');
      }
      push('```');
      push('');
    }
  }
  push('### Official color palette');
  push('');
  push('| Token | Hex | Purpose |');
  push('|-------|-----|---------|');
  push('| Navy | `#11104A` | Headings, sidebar, primary |');
  push('| Soft Navy | `#201F6B` | Gradient partner |');
  push('| Red | `#E6111E` | CTAs, AI accent |');
  push('| Deep Red | `#B80F1A` | Red hover |');
  push('| Gold | `#C9952E` | Accent, streaks |');
  push('| Blush | `#FBEFEF` | Background |');
  push('| Blush Deep | `#F6E0E0` | Input background |');
  push('| White | `#FFFFFF` | Surfaces |');
  push('| Ink | `#1E1D3D` | Body text |');
  push('| Slate | `#5B5A6B` | Secondary text |');
  push('');
  push('### Fonts');
  push('- **Headings:** Lora (serif)');
  push('- **Body:** Work Sans (sans)');
  push('- **UI labels:** JetBrains Mono (monospace)');
  push('');
  push('### Important gotcha');
  push('`var(--green)` and `var(--green-bg)` DO NOT EXIST in `shell.css`.');
  push('Use `#2F8F4A` and `#EAF7EE` directly.');
  push('');
  hr();

  /* ---------- 10. Authentication & Roles ---------- */
  push('## 10. Authentication & Roles');
  push('');
  push('### Session model');
  push('- Cookie name: `connect.sid`');
  push('- Store: Postgres (`session` table, `connect-pg-simple`)');
  push('- Cookie is `httpOnly`, `sameSite=lax`, `secure` in production');
  push('- `req.user` is attached by `auth.attachUser` middleware');
  push('');
  push('### Roles');
  push('- `student` — normal user');
  push('- `admin` — can access `/api/admin/*` and `/admin/*` pages');
  push('');
  push('### Guards');
  push('- `requireLogin` — 401 if `!req.user`');
  push('- `requireAdmin` — 401 if not logged in, 403 if not admin');
  push('');
  push('### Protected accounts');
  push('Accounts with `is_protected = TRUE` in the `users` table cannot be:');
  push('- Demoted from admin');
  push('- Suspended');
  push('- Deleted');
  push('- Have their password reset by another admin');
  push('');
  push('The lead account (`aduraemmanuel123@gmail.com`) has this flag.');
  push('');
  push('### Verified accounts');
  push('Accounts with `verified = TRUE` show a gold checkmark next to their name.');
  push('');
  hr();

  /* ---------- 11. AI Layer ---------- */
  push('## 11. AI Layer');
  push('');
  push('### Gateway (`ai/gateway.js`)');
  push('The gateway is the single entry point for all LLM requests.');
  push('');
  push('**Fallback chain (in order):**');
  push('1. Groq (up to 2 keys)');
  push('2. Cerebras');
  push('3. Google (Gemini)');
  push('4. NVIDIA NIM');
  push('5. OpenRouter');
  push('6. Ollama — tries each of these models in sequence:');
  push('   - `qwen2.5:3b` (fast)');
  push('   - `llama3.1:8b` (quality)');
  push('   - `deepseek-r1:7b` (math/science)');
  push('   - `qwen2.5:7b` (all-rounder)');
  push('');
  push('**Key behaviors:**');
  push('- Each key has its own health state (failures, cooldown)');
  push('- 429 → cooldown that key, try next');
  push('- 401/403 → disable that key permanently, try next');
  push('- 404 → try next provider (model retired)');
  push('- 5xx / timeout → cooldown, try next');
  push('- 400 / 422 → STOP (our request is malformed)');
  push('- Message history is trimmed: max 16 messages, max 5500 estimated tokens');
  push('  (Groq free tier caps at 8000 TPM)');
  push('');
  push('### Tool-calling architecture');
  push('Two paths — native first, regex fallback second:');
  push('');
  push('**Path A — Native tool-calling (preferred):**');
  push('1. Frontend sends user message to `/api/ai/chat`');
  push('2. Backend calls `runWithTools()` in `ai/tool-executor.js`');
  push('3. That sends `tools: [...TOOL_SCHEMAS]` to the gateway');
  push('4. AI returns `tool_calls` in the response');
  push('5. `ai/tool-dispatch.js` maps each call to the right service');
  push('6. The result is sent back to the AI as a `role: tool` message');
  push('7. AI produces a natural-language summary');
  push('8. Tool objects and reply are saved and returned to frontend');
  push('');
  push('**Path B — Regex fallback (only if native didn\'t fire):**');
  push('1. `runToolDetection()` in `ai/routes.js` scans user text for intent');
  push('2. Regex patterns detect "quiz me on X", "make flashcards on Y", etc.');
  push('3. The matching service runs directly');
  push('4. The tool object is added to the response');
  push('');
  push('**Available tools (13 total):**');
  push('- `create_quiz` — multi-choice quiz');
  push('- `create_flashcards` — flip-card deck');
  push('- `create_theory` — fill-in-the-gap theory');
  push('- `create_practice` — practice questions');
  push('- `create_study_plan` — multi-day study plan');
  push('- `create_exam` — timed exam');
  push('- `create_visualization` — Mermaid diagram');
  push('- `create_sketch` — formula/equation formatter + solver');
  push('- `web_search` — Tavily search');
  push('- `search_images` — Pexels search');
  push('- `generate_image` — Pollinations');
  push('- `save_note` — save to notes');
  push('- `get_mistakes` — show mistake bank');
  push('');
  push('### Vision layer (`ai/vision.js`)');
  push('When a student attaches an image:');
  push('1. Detect the image in `chat_attachments` (mime starts with `image/`)');
  push('2. Read file bytes from disk (`storage_path`)');
  push('3. Send base64 to OpenAI `gpt-4o-mini` with the user\'s prompt');
  push('4. **Fallback:** if OpenAI fails (no credits, error), retry with Ollama `llava:7b`');
  push('5. If both fail, return an honest "I could not read that image" message');
  push('');
  push('### Voice layer (`voice/`)');
  push('Provider chain:');
  push('1. OpenAI Whisper (if `VOICE_PROVIDER=openai`)');
  push('2. Deepgram Nova-2 (if `VOICE_PROVIDER=deepgram`)');
  push('3. Local `whisper.exe` (local dev only)');
  push('');
  push('Endpoint: `POST /api/voice/transcribe` with `multer` handling the upload.');
  push('Returns `{ text, provider }`.');
  push('');
  push('### Provider model names (as of ' + new Date().toISOString().slice(0, 10) + ')');
  push('');
  push('Read from `backend/src/ai/providers/*.js`:');
  push('');
  const providersDir = path.join(ROOT, 'backend', 'src', 'ai', 'providers');
  if (exists(providersDir)) {
    const providerFiles = fs.readdirSync(providersDir)
      .filter(f => f.endsWith('.js') && f !== 'index.js');
    for (const f of providerFiles) {
      const src = read(path.join(providersDir, f));
      const modelMatch = src && src.match(/model:\s*['"]([^'"]+)['"]/);
      const baseMatch  = src && src.match(/baseUrl:\s*['"]([^'"]+)['"]/);
      const supportsTools = src && /supportsTools:\s*true/.test(src);
      push('- **' + f.replace('.js', '') + '** — model: `' + (modelMatch ? modelMatch[1] : '?') + '`' +
           (baseMatch ? ' baseUrl: `' + baseMatch[1] + '`' : '') +
           (supportsTools ? ' · supports tools ✅' : ''));
    }
  }
  push('');
  hr();

  /* ---------- 12. Environment Variables ---------- */
  push('## 12. Environment Variables');
  push('');
  push('Names only — values are masked. The real values live in `.env`');
  push('(local) and Render\'s Environment tab (production).');
  push('');
  const env = extractEnvVars();
  if (env.vars.length) {
    push('Source: `' + env.source + '`');
    push('');
    push('```');
    for (const v of env.vars) {
      push(v.name + (v.value ? ' = ' + v.value : ''));
    }
    push('```');
  } else {
    push('_(no `.env.example` found — check project root)_');
  }
  push('');
  push('### Required for production (Render)');
  push('');
  push('- `DATABASE_URL` — Neon connection string');
  push('- `SESSION_SECRET` — 96-char hex');
  push('- At least one AI provider key (Groq preferred)');
  push('- `OPENAI_API_KEY` — for vision + voice');
  push('- `TAVILY_API_KEY`, `PEXELS_API_KEY`, `POLLINATIONS_API_KEY`, `GIPHY_API_KEY`');
  push('- `OLLAMA_URL` — tunnel URL if using Ollama from Render');
  push('- `NODE_ENV=production`');
  push('');
  push('### Local `.env` extras');
  push('');
  push('- `PORT=3000`');
  push('- `OLLAMA_URL=http://localhost:11434/v1`');
  push('- `OLLAMA_MODEL=qwen2.5:3b`');
  push('- `OLLAMA_EMBED_MODEL=nomic-embed-text`');
  push('- `OLLAMA_VISION_MODEL=llava:7b`');
  push('');
  hr();

  /* ---------- 13. Known Issues ---------- */
  push('## 13. Known Issues');
  push('');
  push('### Reported and still open');
  push('');
  push('1. **Contact Us** — student cannot submit a support ticket. Error "cannot send".');
  push('2. **Announcements not displaying** — admin creates, students do not see the popup.');
  push('3. **Audit log stuck** — admin page stays on "Loading…" forever.');
  push('4. **Reply to announcement broken** — student reply button does not save.');
  push('5. **Voice transcription unreliable** — OpenAI has no credits; needs Groq Whisper fallback.');
  push('');
  push('### Won\'t fix (documented workarounds)');
  push('');
  push('- **Gutenberg 403 on Render** — Cloudflare blocks Render IPs. Use Gutendex mirror or other sources.');
  push('- **Google Books 429 on Render** — Google rate-limits server IPs.');
  push('- **Library files vanish on Render redeploy** — ephemeral filesystem. Fix is Cloudflare R2 (planned).');
  push('- **Ollama timeout from Render** — needs Cloudflare Tunnel running on the developer\'s laptop.');
  push('');
  push('### Planned but not started');
  push('');
  push('- Friend chat with AI mention (student-to-student chat, `@ai` triggers AI response)');
  push('- Achievements expansion (progress + duration, reset flow, more badge types)');
  push('- Cloudflare R2 for persistent image storage');
  push('- Admin badge leaderboard');
  push('- Study Together (shared study rooms — separate from friend chat)');
  push('- Mobile app (Flutter WebView wrapper)');
  push('- Community feed (posts, likes, comments)');
  push('- Notice board (timetables, per-class targeting)');
  push('');
  hr();

  /* ---------- 14. Conventions ---------- */
  push('## 14. Development Conventions');
  push('');
  push('### File organization');
  push('- Backend modules live under `backend/src/<module>/`');
  push('- Every module has `index.js` (exports), `routes.js` (Express router),');
  push('  `service.js` (business logic)');
  push('- DB queries live in `backend/src/db/queries/<domain>.js`');
  push('- Every query module is re-exported from `backend/src/db/index.js`');
  push('');
  push('### Adding a new feature');
  push('1. Write migration `0NN_*.sql` (append-only)');
  push('2. Add DB queries file in `db/queries/`');
  push('3. Export from `db/index.js`');
  push('4. Add service file with business logic');
  push('5. Add routes with auth guards + audit logging');
  push('6. Mount router in `server.js` (respect route ordering rule)');
  push('7. Add frontend page if user-facing');
  push('8. Add nav item in `shell.js` if it needs one');
  push('');
  push('### Audit logging');
  push('Every admin action calls:');
  push('```js');
  push('await audit.log({');
  push('  req,');
  push('  action: \'thing.verb\',');
  push('  targetType: \'user\' | \'document\' | \'announcement\' | ...');
  push('  targetId: \'uuid\',');
  push('  targetLabel: \'human-readable name\',');
  push('  details: { ... }');
  push('});');
  push('```');
  push('Audit log never fails the caller — silent catch on error.');
  push('');
  push('### CSS conventions');
  push('- Design tokens via CSS variables from `shell.css`');
  push('- BEM-ish class names: `.block__element--modifier`');
  push('- Never `!important` unless fixing a specific cascade conflict');
  push('- Mobile-first: base styles, then `@media (min-width: 640px)`');
  push('');
  push('### User conventions with this developer');
  push('- Explain in simple plain English first, then code');
  push('- Never paste real secrets — use placeholders');
  push('- Prefer COMPLETE FILE CONTENTS over partial diffs');
  push('- Work in PHASES, one step at a time, confirm before moving on');
  push('- Verify migrations ran on BOTH local Postgres and Neon');
  push('- Push to GitHub frequently to protect work');
  push('');
  hr();

  /* ---------- 15. Current State ---------- */
  push('## 15. Current State');
  push('');
  push('### Working and tested');
  push('');
  push('**Chat:** quiz, flashcards, theory, practice, sketch (intelligent solver),');
  push('exam, mistakes, visualization, study plan, notes, message editing,');
  push('reply/refer, code copy, message actions, web search panel, image grid,');
  push('image upload with vision, extract text page.');
  push('');
  push('**Admin:** user management (stats, badges, filters, protected accounts),');
  push('announcements (create/list, view tracking), support inbox, audit log');
  push('(under repair), knowledge base, provider keys, branding, backup,');
  push('analytics, announcement replies inbox.');
  push('');
  push('**Tools:** Spark (JSS-level assessment), Library (Gutendex + Internet Archive),');
  push('voice transcription (OpenAI/Deepgram/local), badges + streaks, progress page.');
  push('');
  push('**Infrastructure:** unified tool-calls across providers, Ollama fallback chain,');
  push('Cloudflare Tunnel for Ollama, Giphy hero backgrounds, mobile admin bar,');
  push('table horizontal scroll.');
  push('');
  push('### Actively broken');
  push('See section 13 — Contact Us, announcements display, audit log, replies.');
  push('');
  push('### Next steps planned');
  push('1. Fix the four bugs listed above');
  push('2. Voice: Groq Whisper as primary provider');
  push('3. Achievements expansion');
  push('4. Friend chat with AI mention');
  push('5. Study Together (deferred)');
  push('');
  hr();

  push('---');
  push('');
  push('## How to use this document');
  push('');
  push('1. Copy the **entire** file.');
  push('2. Paste into a fresh AI conversation.');
  push('3. Ask it to do something specific.');
  push('');
  push('Example first message:');
  push('');
  push('```');
  push('I have attached the complete handoff for my project. Read it fully.');
  push('Then help me fix this bug: [describe the bug].');
  push('```');
  push('');
  push('The AI will now understand:');
  push('- The architecture and why it\'s this way');
  push('- Every module and its public API');
  push('- Every endpoint and what it expects');
  push('- The database schema');
  push('- The design system');
  push('- The conventions');
  push('- What\'s broken and what\'s next');
  push('');
  push('You do not need to re-explain anything.');
  push('');
  push('---');
  push('');
  push('_Generated on ' + now + ' by `scripts/generate-handoff.js`._');

  return lines.join('\n');
}

/* ============================================================
   Main
   ============================================================ */
function main() {
  console.log('');
  console.log('==============================================');
  console.log('  TCSSS AI Learning Platform');
  console.log('  Handoff document generator');
  console.log('==============================================');
  console.log('');

  let doc;
  try {
    doc = buildDocument();
  } catch (err) {
    console.error('Failed to build document:', err.message);
    process.exit(1);
  }

  fs.writeFileSync(OUT, doc, 'utf8');

  const bytes = Buffer.byteLength(doc, 'utf8');
  const words = doc.split(/\s+/).length;
  const lines = doc.split('\n').length;
  const estTokens = Math.round(doc.length / 4);

  console.log('  ✓ Wrote ' + path.basename(OUT));
  console.log('');
  console.log('  Bytes:      ' + bytes.toLocaleString());
  console.log('  Lines:      ' + lines.toLocaleString());
  console.log('  Words:      ' + words.toLocaleString());
  console.log('  ~Tokens:    ' + estTokens.toLocaleString());
  console.log('');
  console.log('  Location:   ' + OUT);
  console.log('');
  console.log('  Next: open HANDOFF.md and paste it into any AI model.');
  console.log('');
}

main();
