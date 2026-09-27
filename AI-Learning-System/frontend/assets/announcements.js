/* ============================================================
   announcements.js — student-facing display
   Labels each message by type: Urgent / Important / Update /
   News / Announcement. Countdown-gated dismiss. View tracking.
   ============================================================ */
(function () {
  'use strict';
  if (window.__announcementsInit) return;
  window.__announcementsInit = true;

  var path = location.pathname;
  if (path === '/' || path.endsWith('/index.html') || path.endsWith('/login.html')) return;
  if (path.indexOf('/admin/') !== -1) return;

  /* ---------- Label resolver ---------- */
  function labelFor(ann) {
    if (ann.priority === 'urgent') {
      return { text: 'Urgent message',         icon: 'fa-triangle-exclamation', tone: 'urgent' };
    }
    if (ann.priority === 'important') {
      return { text: 'Important message',      icon: 'fa-star',                 tone: 'important' };
    }
    if (ann.category === 'update') {
      return { text: 'New update available',   icon: 'fa-wand-magic-sparkles',  tone: 'update' };
    }
    if (ann.category === 'news') {
      return { text: 'Latest news',            icon: 'fa-newspaper',            tone: 'news' };
    }
    return   { text: 'Announcement',           icon: 'fa-bullhorn',             tone: 'announcement' };
  }

  /* ---------- CSS ---------- */
  if (!document.getElementById('ann-css')) {
    var st = document.createElement('style');
    st.id = 'ann-css';
    st.textContent = [
      /* Overlay + popup container */
      '.ann-overlay{position:fixed;inset:0;background:rgba(17,16,74,0.62);backdrop-filter:blur(5px);display:none;align-items:center;justify-content:center;z-index:9000;padding:16px;opacity:0;transition:opacity 220ms ease;}',
      '.ann-overlay.is-open{display:flex;opacity:1;}',
      '.ann-overlay.is-closing{opacity:0;}',
      '.ann-popup{width:100%;max-width:520px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 28px 72px rgba(17,16,74,0.42);display:flex;flex-direction:column;transform:translateY(16px) scale(0.98);transition:transform 260ms cubic-bezier(0.16,1,0.3,1);max-height:calc(100vh - 32px);}',
      '.ann-overlay.is-open .ann-popup{transform:translateY(0) scale(1);}',

      /* Ribbon — big, clear, colour-coded */
      '.ann-ribbon{padding:12px 20px;color:#fff;display:flex;align-items:center;gap:10px;font-family:var(--font-ui,monospace);font-size:0.68rem;letter-spacing:0.13em;text-transform:uppercase;font-weight:700;}',
      '.ann-ribbon i{font-size:0.9rem;flex-shrink:0;}',
      '.ann-ribbon__text{flex:1;min-width:0;}',
      '.ann-ribbon__badge{font-size:0.54rem;padding:3px 8px;border-radius:999px;background:rgba(255,255,255,0.22);letter-spacing:0.1em;font-weight:700;}',

      /* Tone variants */
      '.ann-ribbon--announcement{background:linear-gradient(135deg,#11104A,#201F6B);}',
      '.ann-ribbon--announcement i{color:#C9952E;}',
      '.ann-ribbon--news{background:linear-gradient(135deg,#1F6B35,#2F8F4A);}',
      '.ann-ribbon--news i{color:#FFE8B8;}',
      '.ann-ribbon--update{background:linear-gradient(135deg,#4A47A3,#6E6BE5);}',
      '.ann-ribbon--update i{color:#FFD97D;}',
      '.ann-ribbon--important{background:linear-gradient(135deg,#C9952E,#9E7524);}',
      '.ann-ribbon--important i{color:#FFF4DD;}',
      '.ann-ribbon--urgent{background:linear-gradient(135deg,#E6111E,#B80F1A);}',
      '.ann-ribbon--urgent i{color:#FFE0E2;}',
      '.ann-ribbon--urgent{animation:urgentPulse 1.6s ease-in-out infinite;}',
      '@keyframes urgentPulse{0%,100%{filter:brightness(1);}50%{filter:brightness(1.15);}}',

      /* Popup body */
      '.ann-popup__body{padding:22px 24px 8px;overflow-y:auto;flex:1;}',
      '.ann-popup__title{font-family:var(--font-head,serif);font-size:1.32rem;color:#11104A;margin:0 0 12px;line-height:1.35;}',
      '.ann-popup__text{color:#1E1D3D;font-size:0.95rem;line-height:1.7;}',
      '.ann-popup__text p{margin:0 0 0.75em;}',
      '.ann-popup__text p:last-child{margin-bottom:0;}',
      '.ann-popup__foot{padding:16px 24px 22px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;}',

      /* Buttons */
      '.ann-btn{padding:12px 24px;border-radius:999px;font-family:var(--font-body,sans-serif);font-size:0.92rem;font-weight:600;cursor:pointer;border:none;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;gap:7px;transition:transform 120ms ease,opacity 150ms ease,background 200ms ease;}',
      '.ann-btn:disabled{cursor:not-allowed;opacity:0.55;}',
      '.ann-btn--primary{background:linear-gradient(135deg,#E6111E,#B80F1A);color:#fff;box-shadow:0 4px 14px rgba(230,17,30,0.3);}',
      '.ann-btn--primary:hover:not(:disabled){transform:translateY(-1px);}',
      '.ann-btn--secondary{background:#11104A;color:#fff;}',
      '.ann-btn--secondary:hover:not(:disabled){transform:translateY(-1px);}',
      '.ann-btn--ghost{background:transparent;color:#5B5A6B;border:1.5px solid #E5E3EE;}',
      '.ann-btn--ghost:hover:not(:disabled){background:#FBEFEF;color:#11104A;}',
      '.ann-btn--sm{padding:9px 18px;font-size:0.84rem;}',
      '.ann-btn__count{opacity:0.8;font-variant-numeric:tabular-nums;font-family:var(--font-ui,monospace);}',

      /* Inline banner */
      '.ann-bar{position:fixed;left:50%;top:14px;transform:translateX(-50%) translateY(-150%);max-width:760px;width:calc(100% - 24px);background:#fff;border-radius:18px;box-shadow:0 20px 52px rgba(17,16,74,0.28);display:flex;flex-direction:column;z-index:8000;overflow:hidden;transition:transform 340ms cubic-bezier(0.16,1,0.3,1),opacity 240ms ease;}',
      '.ann-bar.is-open{transform:translateX(-50%) translateY(0);}',
      '.ann-bar.is-closing{transform:translateX(-50%) translateY(-150%);opacity:0;}',
      '.ann-bar__main{display:flex;gap:14px;padding:16px 18px;align-items:flex-start;}',
      '.ann-bar__icon{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:1.1rem;flex-shrink:0;background:#ECEBF5;color:#11104A;}',
      '.ann-bar--announcement .ann-bar__icon{background:#ECEBF5;color:#11104A;}',
      '.ann-bar--news .ann-bar__icon{background:#EAF7EE;color:#2F8F4A;}',
      '.ann-bar--update .ann-bar__icon{background:#EEEAFA;color:#4A47A3;}',
      '.ann-bar--important .ann-bar__icon{background:#FBF3E1;color:#9E7524;}',
      '.ann-bar--urgent .ann-bar__icon{background:#FDECEC;color:#E6111E;}',
      '.ann-bar__content{flex:1;min-width:0;}',
      '.ann-bar__title{font-family:var(--font-head,serif);font-size:1.02rem;color:#11104A;font-weight:600;margin-bottom:5px;line-height:1.35;}',
      '.ann-bar__text{font-size:0.88rem;color:#5B5A6B;line-height:1.55;max-height:130px;overflow-y:auto;}',
      '.ann-bar__actions{display:flex;flex-direction:column;gap:8px;align-items:flex-end;flex-shrink:0;}',
      '.ann-bar__close{width:36px;height:36px;border-radius:50%;border:1.5px solid #E5E3EE;background:#fff;color:#5B5A6B;cursor:pointer;display:grid;place-items:center;font-size:0.88rem;position:relative;transition:background 150ms ease,transform 150ms ease;}',
      '.ann-bar__close:hover:not(:disabled){background:#FBEFEF;color:#11104A;}',
      '.ann-bar__close:disabled{opacity:0.55;cursor:not-allowed;}',
      '.ann-bar__count{position:absolute;bottom:-7px;right:-7px;min-width:22px;height:22px;border-radius:999px;background:#11104A;color:#fff;font-family:var(--font-ui,monospace);font-size:0.64rem;font-weight:700;display:grid;place-items:center;padding:0 6px;box-shadow:0 2px 6px rgba(17,16,74,0.3);}',
      '.ann-bar--urgent .ann-bar__count{background:#E6111E;}',
      '.ann-bar--important .ann-bar__count{background:#9E7524;}',

      /* Mobile */
      '@media(max-width:600px){',
      '.ann-overlay{padding:0;align-items:flex-end;}',
      '.ann-popup{max-width:100%;border-radius:22px 22px 0 0;transform:translateY(100%);}',
      '.ann-overlay.is-open .ann-popup{transform:translateY(0);}',
      '.ann-popup__body{padding:20px 20px 6px;}',
      '.ann-popup__title{font-size:1.2rem;}',
      '.ann-popup__foot{padding:14px 20px 20px;flex-direction:column-reverse;}',
      '.ann-popup__foot .ann-btn{width:100%;}',
      '.ann-bar{top:8px;width:calc(100% - 16px);border-radius:16px;}',
      '.ann-bar__main{flex-wrap:wrap;padding:14px 14px;}',
      '.ann-bar__actions{flex-direction:row;width:100%;justify-content:flex-end;align-items:center;}',
      '.ann-ribbon{font-size:0.64rem;padding:11px 16px;}',
      '}'
    ].join('');
    document.head.appendChild(st);
  }

  /* ---------- Helpers ---------- */
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
  function recordView(ann) {
    try {
      fetch('/api/announcements/' + ann.id + '/view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ display_mode: ann.display_mode }),
      }).catch(function () {});
    } catch (_) {}
  }

  /* ---------- Popup ---------- */
  function showModal(ann, onDone) {
    var delay = Math.max(0, ann.modal_delay_seconds || 0);
    var label = labelFor(ann);

    var ov = document.createElement('div');
    ov.className = 'ann-overlay';
    ov.innerHTML =
      '<div class="ann-popup" role="dialog" aria-modal="true" aria-label="' + esc(label.text) + '">' +
        '<div class="ann-ribbon ann-ribbon--' + label.tone + '">' +
          '<i class="fa-solid ' + label.icon + '" aria-hidden="true"></i>' +
          '<span class="ann-ribbon__text">' + esc(label.text) + '</span>' +
          '<span class="ann-ribbon__badge">TCSSS</span>' +
        '</div>' +
        '<div class="ann-popup__body">' +
          '<h2 class="ann-popup__title">' + esc(ann.title) + '</h2>' +
          '<div class="ann-popup__text md-content"></div>' +
        '</div>' +
        '<div class="ann-popup__foot">' +
          (ann.action_url && ann.action_label
            ? '<a class="ann-btn ann-btn--' + esc(ann.action_style || 'primary') +
              '" href="' + esc(ann.action_url) + '"' +
              (ann.action_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
              esc(ann.action_label) + '</a>'
            : '') +
          '<button type="button" class="ann-btn ann-btn--ghost" data-role="close" disabled>' +
            'Done' +
            (delay > 0 ? ' <span class="ann-btn__count" data-role="count">(' + delay + ')</span>' : '') +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    renderBody(ann.body, ov.querySelector('.ann-popup__text'));

    recordView(ann);

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

  /* ---------- Inline banner ---------- */
  function showInline(ann) {
    var delay = Math.max(0, ann.inline_delay_seconds || 0);
    var label = labelFor(ann);

    var el = document.createElement('div');
    el.className = 'ann-bar ann-bar--' + label.tone;
    el.innerHTML =
      '<div class="ann-ribbon ann-ribbon--' + label.tone + '">' +
        '<i class="fa-solid ' + label.icon + '" aria-hidden="true"></i>' +
        '<span class="ann-ribbon__text">' + esc(label.text) + '</span>' +
        '<span class="ann-ribbon__badge">TCSSS</span>' +
      '</div>' +
      '<div class="ann-bar__main">' +
        '<div class="ann-bar__icon"><i class="fa-solid ' + label.icon + '"></i></div>' +
        '<div class="ann-bar__content">' +
          '<div class="ann-bar__title">' + esc(ann.title) + '</div>' +
          '<div class="ann-bar__text md-content"></div>' +
        '</div>' +
        '<div class="ann-bar__actions">' +
          (ann.action_url && ann.action_label
            ? '<a class="ann-btn ann-btn--sm ann-btn--' + esc(ann.action_style || 'primary') +
              '" href="' + esc(ann.action_url) + '"' +
              (ann.action_new_tab ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
              esc(ann.action_label) + '</a>'
            : '') +
          '<button type="button" class="ann-bar__close" data-role="close" disabled>' +
            '<i class="fa-solid fa-xmark"></i>' +
            (delay > 0 ? '<span class="ann-bar__count" data-role="count">' + delay + '</span>' : '') +
          '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    renderBody(ann.body, el.querySelector('.ann-bar__text'));

    recordView(ann);

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
      setTimeout(function () { el.remove(); }, 280);
    });

    requestAnimationFrame(function () { el.classList.add('is-open'); });
  }

  /* ---------- Queue ---------- */
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