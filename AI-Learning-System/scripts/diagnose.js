#!/usr/bin/env node
// ============================================================
// scripts/diagnose.js
// ------------------------------------------------------------
// Tests every endpoint in the platform and reports PASS/FAIL.
//
// Requires your local server to be running:
//     npm run dev
//
// Run:  node scripts/diagnose.js
// Out:  DIAGNOSTIC.md (project root)
//
// Prompts once for admin email + password. Never stores them.
// ============================================================

const fs       = require('fs');
const path     = require('path');
const readline = require('readline');

const BASE  = process.env.BASE_URL || 'http://localhost:3000';
const ROOT  = path.resolve(__dirname, '..');
const OUT   = path.join(ROOT, 'DIAGNOSTIC.md');

let COOKIE  = '';
let RESULTS = [];

function hr() { return '━'.repeat(60); }

/* ============================================================
   HTTP helper
   ============================================================ */
async function req(method, urlPath, options) {
  options = options || {};
  const started = Date.now();
  const headers = Object.assign({}, options.headers || {});
  if (COOKIE && options.auth !== false) headers['Cookie'] = COOKIE;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  try {
    const res = await fetch(BASE + urlPath, {
      method: method,
      headers: headers,
      body: options.body || undefined,
      redirect: 'manual',
    });

    // Capture Set-Cookie for login
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const m = setCookie.match(/connect\.sid=[^;]+/);
      if (m) COOKIE = m[0];
    }

    let body;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      body = await res.json().catch(() => null);
    } else {
      const text = await res.text();
      body = text.length > 500 ? text.slice(0, 500) + '…' : text;
    }

    return {
      ok: res.ok,
      status: res.status,
      body: body,
      ms: Date.now() - started,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      body: null,
      error: err.message,
      ms: Date.now() - started,
    };
  }
}

/* ============================================================
   Test wrapper
   ============================================================ */
async function test(name, fn) {
  process.stdout.write('  ' + name.padEnd(55).slice(0, 55) + ' ');
  let result;
  try {
    result = await fn();
  } catch (err) {
    result = { ok: false, status: 0, error: err.message };
  }
  result.name = name;

  if (result.ok) {
    console.log('✓ ' + (result.status || 200) + '  (' + result.ms + 'ms)');
  } else {
    let label = result.status ? result.status : 'ERR';
    console.log('✗ ' + label + '  (' + result.ms + 'ms)');
  }

  RESULTS.push(result);
  return result;
}

function expect2xx(r) {
  return r.ok && r.status >= 200 && r.status < 300;
}
function expectStatus(r, code) {
  return r.status === code;
}

/* ============================================================
   Prompt helper
   ============================================================ */
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

/* ============================================================
   Main
   ============================================================ */
async function main() {
  console.log('');
  console.log(hr());
  console.log('  TCSSS AI Learning Platform — Diagnostic');
  console.log(hr());
  console.log('');
  console.log('  Target: ' + BASE);
  console.log('');

  /* ---------- Login ---------- */
  const email    = await ask('  Admin email:    ');
  const password = await ask('  Admin password: ');
  console.log('');

  const login = await test('Login (admin)', async () => {
    const r = await req('POST', '/api/auth/login', {
      auth: false,
      body: { email: email.trim(), password: password },
    });
    return r;
  });

  if (!login.ok) {
    console.log('');
    console.log('  ✗ Cannot log in — aborting tests.');
    console.log('  Response: ' + JSON.stringify(login.body || login.error));
    process.exit(1);
  }

  console.log('');
  console.log('  ─── Health ───');
  await test('GET /health',                  () => req('GET', '/health', { auth: false }));
  await test('GET /api/platform/info',       () => req('GET', '/api/platform/info', { auth: false }));
  await test('GET /api/auth/me',             () => req('GET', '/api/auth/me'));

  console.log('');
  console.log('  ─── Admin: stats & users ───');
  await test('GET /api/admin/stats',         () => req('GET', '/api/admin/stats'));
  await test('GET /api/admin/users',         () => req('GET', '/api/admin/users'));
  await test('GET /api/admin/users/stats',   () => req('GET', '/api/admin/users/stats'));
  await test('GET /api/admin/analytics/summary', () => req('GET', '/api/admin/analytics/summary'));
  await test('GET /api/admin/analytics/recent',  () => req('GET', '/api/admin/analytics/recent'));

  console.log('');
  console.log('  ─── Admin: audit log (BUG: stuck loading) ───');
  await test('GET /api/admin/audit',             () => req('GET', '/api/admin/audit?limit=10'));
  await test('GET /api/admin/audit/meta',        () => req('GET', '/api/admin/audit/meta'));

  console.log('');
  console.log('  ─── Support (BUG: cannot send) ───');
  await test('GET /api/support',                 () => req('GET', '/api/support'));
  await test('GET /api/support/unread/count',    () => req('GET', '/api/support/unread/count'));
  await test('GET /api/support/team',            () => req('GET', '/api/support/team'));
  await test('POST /api/support (create ticket)', async () => {
    return req('POST', '/api/support', {
      body: {
        subject: '[DIAG] Test ticket ' + Date.now(),
        category: 'question',
        priority: 'normal',
        name: 'Diag Test',
        email: email.trim(),
        whatsapp: '+2340000000000',
        body: 'This is a diagnostic test ticket. Safe to delete.',
      },
    });
  });

  console.log('');
  console.log('  ─── Admin: support inbox ───');
  await test('GET /api/admin/support',            () => req('GET', '/api/admin/support'));
  await test('GET /api/admin/support/folders',    () => req('GET', '/api/admin/support/folders'));
  await test('GET /api/admin/support/unread/count', () => req('GET', '/api/admin/support/unread/count'));

  console.log('');
  console.log('  ─── Announcements ───');
  await test('GET /api/admin/announcements',       () => req('GET', '/api/admin/announcements'));
  await test('GET /api/announcements/active',      () => req('GET', '/api/announcements/active'));

  // Create a test announcement, then exercise the reply + view flow
  let testAnnId = null;
  await test('POST /api/admin/announcements',      async () => {
    const r = await req('POST', '/api/admin/announcements', {
      body: {
        title: '[DIAG] Test announcement',
        body: 'This is a diagnostic test. Safe to delete.',
        category: 'announcement',
        priority: 'normal',
        display_mode: 'inline',
        inline_delay_seconds: 0,
        cooldown_hours: 0,
        is_active: true,
        target_role: 'all',
      },
    });
    if (r.ok && r.body && r.body.announcement) testAnnId = r.body.announcement.id;
    return r;
  });

  if (testAnnId) {
    await test('POST /api/announcements/:id/view',    () => req('POST', '/api/announcements/' + testAnnId + '/view', { body: { display_mode: 'inline' } }));
    await test('POST /api/announcements/:id/dismiss', () => req('POST', '/api/announcements/' + testAnnId + '/dismiss'));
    await test('POST /api/announcements/:id/reply (BUG: broken)', () =>
      req('POST', '/api/announcements/' + testAnnId + '/reply', {
        body: { body: 'Diagnostic test reply.' },
      })
    );
    await test('GET /api/announcements/:id/my-replies', () => req('GET', '/api/announcements/' + testAnnId + '/my-replies'));
    await test('GET /api/admin/announcements/:id/replies', () => req('GET', '/api/admin/announcements/' + testAnnId + '/replies'));
    await test('GET /api/admin/announcements/replies',     () => req('GET', '/api/admin/announcements/replies?filter=inbox'));
    await test('GET /api/admin/announcements/replies/unread/count', () => req('GET', '/api/admin/announcements/replies/unread/count'));
    await test('GET /api/admin/announcements/:id/views',   () => req('GET', '/api/admin/announcements/' + testAnnId + '/views'));

    // Clean up
    await req('DELETE', '/api/admin/announcements/' + testAnnId);
  }

  console.log('');
  console.log('  ─── Badges & progress ───');
  await test('GET /api/badges/me',                 () => req('GET', '/api/badges/me'));
  await test('GET /api/badges/catalog',            () => req('GET', '/api/badges/catalog'));
  await test('GET /api/badges/progress (BUG: not loading)', () => req('GET', '/api/badges/progress'));

  console.log('');
  console.log('  ─── Tools: individual fetches ───');
  // Try to fetch a quiz id from conversations
  const conv = await req('GET', '/api/conversations');
  if (conv.ok && conv.body && conv.body.conversations && conv.body.conversations.length) {
    const convId = conv.body.conversations[0].id;
    await test('GET /api/conversations/:id',        () => req('GET', '/api/conversations/' + convId));
  } else {
    await test('GET /api/conversations/:id',        () => req('GET', '/api/conversations'));
  }

  await test('GET /api/tools/mistakes',            () => req('GET', '/api/tools/mistakes'));
  await test('GET /api/tools/notes',               () => req('GET', '/api/tools/notes'));
  await test('GET /api/tools/sketch',              () => req('GET', '/api/tools/sketch'));

  console.log('');
  console.log('  ─── AI chat (basic) ───');
  await test('POST /api/ai/chat (Hello)',          () => req('POST', '/api/ai/chat', {
    body: {
      messages: [{ role: 'user', content: 'Reply with just the word OK.' }],
      conversationId: null,
      attachmentIds: [],
    },
  }));

  console.log('');
  console.log('  ─── Voice ───');
  await test('POST /api/voice/transcribe (no file)', () => req('POST', '/api/voice/transcribe'));

  console.log('');
  console.log('  ─── Theme / Giphy ───');
  await test('GET /api/theme/hero-video',          () => req('GET', '/api/theme/hero-video', { auth: false }));

  /* ---------- Build report ---------- */
  const pass = RESULTS.filter(r => r.ok).length;
  const fail = RESULTS.filter(r => !r.ok).length;
  const total = RESULTS.length;

  console.log('');
  console.log(hr());
  console.log('  ' + pass + ' passed, ' + fail + ' failed, ' + total + ' total');
  console.log(hr());
  console.log('');

  const report = [];
  report.push('# Diagnostic Report');
  report.push('');
  report.push('**Date:** ' + new Date().toISOString());
  report.push('**Target:** ' + BASE);
  report.push('**Result:** ' + pass + ' passed · ' + fail + ' failed · ' + total + ' total');
  report.push('');
  report.push('## Failures');
  report.push('');
  const failures = RESULTS.filter(r => !r.ok);
  if (!failures.length) {
    report.push('_None — everything passed._');
  } else {
    for (const f of failures) {
      report.push('### ' + f.name);
      report.push('');
      report.push('- **Status:** ' + (f.status || 'no response'));
      report.push('- **Time:** ' + f.ms + 'ms');
      if (f.error) report.push('- **Error:** `' + f.error + '`');
      if (f.body) {
        const preview = typeof f.body === 'string'
          ? f.body
          : JSON.stringify(f.body, null, 2);
        report.push('');
        report.push('```json');
        report.push(preview.slice(0, 600));
        report.push('```');
      }
      report.push('');
    }
  }

  report.push('## All results');
  report.push('');
  report.push('| Test | Status | Time |');
  report.push('|------|--------|------|');
  for (const r of RESULTS) {
    report.push('| ' + r.name + ' | ' + (r.ok ? '✓ ' + (r.status || 200) : '✗ ' + (r.status || 'ERR')) + ' | ' + r.ms + 'ms |');
  }

  fs.writeFileSync(OUT, report.join('\n'), 'utf8');
  console.log('  Full report: ' + OUT);
  console.log('');
}

main().catch(err => {
  console.error('');
  console.error('  Diagnostic failed hard:', err.message);
  console.error(err.stack);
  process.exit(1);
});
