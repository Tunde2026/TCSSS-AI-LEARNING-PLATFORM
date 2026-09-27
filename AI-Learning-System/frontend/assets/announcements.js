/* ============================================================
   announcements.js — student-facing announcement display
   Fetches active announcements and shows them as a modal
   popup or inline top banner. Both are countdown-gated: the
   Done / close control is disabled until the admin-set delay
   elapses. Dismissal is recorded server-side (cooldown aware).
   ============================================================ */
(function () {
  'use strict';
  if (window.__announcementsInit) return;
  window.__announcementsInit = true;

  var path = location.pathname;
  if (path === '/' || path.endsWith('/index.html') || path.endsWith('/login.html')) return;
  if (path.indexOf('/admin/') !== -1) return;

  /* ---------- CSS injection ---------- */
  if (!document.getElementById('ann-css')) {
    var st = document.createElement('style');
    st.id = 'ann-css';
    st.textContent = [
      '.ann-modal-overlay{position:fixed;inset:0;background:rgba(17,16,74,0.55);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;z-index:9000;padding:20px;opacity:0;transition:opacity 220ms ease;}',
      '.ann-modal-overlay.is-open{display:flex;opacity:1;}',
      '.ann-modal-overlay.is-closing{opacity:0;}',
      '.ann-modal{width:100%;max-width:520px;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 64px rgba(17,16,74,0.35);display:flex;flex-direction:column;transform:translateY(12px) scale(0.98);transition:transform 240ms cubic-bezier(0.16,1,0.3,1);}',
      '.ann-modal-overlay.is-open .ann-modal{transform:translateY(0) scale(1);}',
      '.ann-modal__stripe{height:4px;background:#C9952E;}',
      '.ann-modal__stripe--important{background:#C9952E;}',
      '.ann-modal__stripe--urgent{background:#E6111E;}',
      '.ann-modal__head{display:flex;gap:8px;padding:18px 22px 0;align-items:center;}',
      '.ann-modal__tag{font-family:var(--font-ui,monospace);font-size:0.62rem;letter-spacing:0.1em;text-transform:uppercase;background:#ECEBF5;color:#11104A;padding:4px 10px;border-radius:999px;font-weight:700;}',
      '.ann-modal__tag--news{background:#FBF3E1;color:#6A4F13;}',
      '.ann-modal__tag--update{background:#EAF7EE;color:#2F8F4A;}',
      '.ann-modal__prio{font-family:var(--font-ui,monospace);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;padding:4px 10px;border-radius:999px;font-weight:700;}',
      '.ann-modal__prio--important{background:#FBF3E1;color:#6A4F13;}',
      '.ann-modal__prio--urgent{background:#FDECEC;color:#B80F1A;}',
      '.ann-modal__title{font-family:var(--font-head,serif);font-size:1.35rem;color:#11104A;margin:12px 22px 8px;line-height:1.3;}',
      '.ann-modal__body{padding:0 22px 8px;color:#1E1D3D;font-size:0.94rem;line-height:1.65;max-height:50vh;overflow-y:auto;}',
      '.ann-modal__body p{margin:0 0 0.7em;}',
      '.ann-modal__actions{display:flex;gap:10px;padding:18px 22px 22px;justify-content:flex-end;flex-wrap:wrap;}',
      '.ann-btn{padding:11px 22px;border-radius:999px;font-family:var(--font-body,sans-serif);font-size:0.9rem;font-weight:600;cursor:pointer;border:none;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:transform 120ms ease,opacity 150ms ease;}',
      '.ann-btn:disabled{cursor:not-allowed;opacity:0.5;}',
      '.ann-btn--primary{background:linear-gradient(135deg,#E6111E,#B80F1A);color:#fff;box-shadow:0 4px 14px rgba(230,17,30,0.28);}',
      '.ann-btn--primary:hover:not(:disabled){transform:translateY(-1px);}',
      '.ann-btn--secondary{background:#11104A;color:#fff;}',
      '.ann-btn--ghost{background:transparent;color:#5B5A6B;border:1.5px solid #E5E3EE;}',
      '.ann-btn--ghost:hover:not(:disabled){background:#FBEFEF;color:#11104A;}',
      '.ann-btn--sm{padding:8px 16px;font-size:0.82rem;}',
      '.ann-btn__count{opacity:0.75;font-variant-numeric:tabular-nums;}',
      '.ann-banner{position:fixed;left:50%;transform:translateX(-50%) translateY(-140%);top:16px;max-width:720px;width:calc(100% - 32px);background:#fff;border:1.5px solid #E5E3EE;border-radius:16px;box-shadow:0 18px 48px rgba(17,16,74,0.22);display:flex;gap:14px;padding:14px 16px;z-index:8000;transition:transform 320ms cubic-bezier(0.16,1,0.3,1),opacity 220ms ease;border-left:4px solid #C9952E;align-items:flex-start;}',
      '.ann-banner.is-open{transform:translateX(-50%) translateY(0);}',
      '.ann-banner.is-closing{transform:translateX(-50%) translateY(-140%);opacity:0;}',
      '.ann-banner--urgent{border-left-color:#E6111E;}',
      '.ann-banner--important{border-left-color:#C9952E;}',
      '.ann-banner--normal{border-left-color:#11104A;}',
      '.ann-banner__icon{width:38px;height:38px;border-radius:10px;background:#FBF3E1;color:#C9952E;display:grid;place-items:center;font-size:1rem;flex-shrink:0;}',
      '.ann-banner--urgent .ann-banner__icon{background:#FDECEC;color:#E6111E;}',
      '.ann-banner__body{flex:1;min-width:0;}',
      '.ann-banner__tag{font-family:var(--font-ui,monospace);font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:#5B5A6B;font-weight:700;margin-bottom:4px;}',
      '.ann-banner__title{font-family:var(--font-head,serif);font-size:1rem;color:#11104A;font-weight:600;margin-bottom:4px;}',
      '.ann-banner__text{font-size:0.86rem;color:#5B5A6B;line-height:1.5;max-height:120px;overflow-y:auto;}',
      '.ann-banner__actions{display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;}',
      '.ann-banner__close{width:32px;height:32px;border-radius:50%;border:1.5px solid #E5E3EE;background:#fff;color:#5B5A6B;cursor:pointer;display:grid;place-items:center;font-size:0.85rem;position:relative;}',
      '.ann-banner__close:hover:not(:disabled){background:#FBEFEF;color:#11104A;}',
      '.ann-banner__close:disabled{opacity:0.55;cursor:not-allowed;}',
      '.ann-banner__count{position:absolute;bottom:-6px;right:-6px;min-width:18px;height:18px;border-radius:999px;background:#11104A;color:#fff;font-family:var(--font-ui,monospace);font-size:0.6rem;font-weight:700;display:grid;place-items:center;padding:0 4px;}',
      '@media(max-width:640px){.ann-banner{flex-wrap:wrap;}.ann-banner__actions{flex-direction:row;width:100%;justify-content:flex-end;}}'
    ].join('');
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function renderBody(md, el) {
    if (window.renderMarkdown) window.renderMarkdown(md, el);
    else el.textContent = md;
  }
  async function fetchActive() {
    try {
      var res = await fetch('/api/announcements/active', { credentials: 'include' });
      if (!res.ok) return [];
      var d = await res.json();
      return d.announcements || [];
    } catch (_) { return []; }
  }
  async function dismiss(id) {
    try {
      await fetch('/api/announcements/' + id + '/dismiss', {
        method: 'POST', credentials: 'include',
      });
    } catch (_) {}
  }

  function showModal(ann, onDone) {
    var delay = Math.max(0, ann.modal_delay_seconds || 0);
    var ov = document.createElement('div');
    ov.className = 'ann-modal-overlay';
    ov.innerHTML =
      '<div class="ann-modal" role="dialog" aria-modal="true">' +
        '<div class="ann-modal__stripe ann-modal__stripe--' + esc(ann.priority) + '"></div>' +
        '<div class="ann-modal__head">' +
          '<span class="ann-modal__tag ann-modal__tag--' + esc(ann.category) + '">' + esc(ann.category) + '</span>' +
          (ann.priority !== 'normal'
            ? '<span class="ann-modal__prio ann-modal__prio--' + esc(ann.priority) + '">' + esc(ann.priority) + '</span>'
            : '') +
        '</div>' +
        '<h2 class="ann-modal__title">' + esc(ann.title) + '</h2>' +
        '<div class="ann-modal__body md-content"></div>' +
        '<div class="ann-modal__actions">' +
          (ann.action_url && ann.action_label
            ? '<a class="ann-btn ann-btn--' + esc(ann.action_style || 'primary') + '" href="' + esc(ann.action_url) + '"' +
              (ann.action_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(ann.action_label) + '</a>'
            : '') +
          '<button type="button" class="ann-btn ann-btn--ghost" data-role="close" disabled>' +
            'Done' +
            (delay > 0 ? ' <span class="ann-btn__count" data-role="count">(' + delay + ')</span>' : '') +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    renderBody(ann.body, ov.querySelector('.ann-modal__body'));

    var closeBtn = ov.querySelector('[data-role="close"]');
    var countEl  = ov.querySelector('[data-role="count"]');
    var remaining = delay;
    if (delay > 0) {
      var iv = setInterval(function () {
        remaining--;
        if (countEl) countEl.textContent = '(' + Math.max(remaining, 0) + ')';
        if (remaining <= 0) {
          clearInterval(iv);
          closeBtn.disabled = false;
          if (countEl) countEl.remove();
        }
      }, 1000);
    } else {
      closeBtn.disabled = false;
    }

    function close() {
      if (closeBtn.disabled) return;
      ov.classList.add('is-closing');
      dismiss(ann.id);
      setTimeout(function () { ov.remove(); onDone && onDone(); }, 220);
    }
    closeBtn.addEventListener('click', close);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (!document.body.contains(ov)) { document.removeEventListener('keydown', onKey); return; }
      if (e.key === 'Escape') close();
    });

    requestAnimationFrame(function () { ov.classList.add('is-open'); });
  }

  function showInline(ann) {
    var delay = Math.max(0, ann.inline_delay_seconds || 0);
    var el = document.createElement('div');
    el.className = 'ann-banner ann-banner--' + ann.priority;
    el.innerHTML =
      '<div class="ann-banner__icon"><i class="fa-solid fa-bullhorn"></i></div>' +
      '<div class="ann-banner__body">' +
        '<div class="ann-banner__tag">' + esc(ann.category) + '</div>' +
        '<div class="ann-banner__title">' + esc(ann.title) + '</div>' +
        '<div class="ann-banner__text md-content"></div>' +
      '</div>' +
      '<div class="ann-banner__actions">' +
        (ann.action_url && ann.action_label
          ? '<a class="ann-btn ann-btn--sm ann-btn--' + esc(ann.action_style || 'primary') + '" href="' + esc(ann.action_url) + '"' +
            (ann.action_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + esc(ann.action_label) + '</a>'
          : '') +
        '<button type="button" class="ann-banner__close" data-role="close" disabled>' +
          '<i class="fa-solid fa-xmark"></i>' +
          (delay > 0 ? '<span class="ann-banner__count" data-role="count">' + delay + '</span>' : '') +
        '</button>' +
      '</div>';
    document.body.appendChild(el);
    renderBody(ann.body, el.querySelector('.ann-banner__text'));

    var closeBtn = el.querySelector('[data-role="close"]');
    var countEl  = el.querySelector('[data-role="count"]');
    var remaining = delay;
    if (delay > 0) {
      var iv = setInterval(function () {
        remaining--;
        if (countEl) countEl.textContent = Math.max(remaining, 0);
        if (remaining <= 0) {
          clearInterval(iv);
          closeBtn.disabled = false;
          if (countEl) countEl.remove();
        }
      }, 1000);
    } else {
      closeBtn.disabled = false;
    }

    closeBtn.addEventListener('click', function () {
      if (closeBtn.disabled) return;
      el.classList.add('is-closing');
      dismiss(ann.id);
      setTimeout(function () { el.remove(); }, 260);
    });

    requestAnimationFrame(function () { el.classList.add('is-open'); });
  }

  var queue = [];
  function next() {
    if (!queue.length) return;
    var ann = queue.shift();
    if (ann.display_mode === 'modal') showModal(ann, next);
    else { showInline(ann); next(); }
  }

  async function init() {
    await new Promise(function (r) { setTimeout(r, 900); });
    var list = await fetchActive();
    if (!list.length) return;
    queue = list;
    next();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
