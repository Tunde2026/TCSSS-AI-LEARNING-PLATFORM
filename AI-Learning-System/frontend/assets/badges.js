/* ============================================================
   badges.js — verified checkmark, streak pill, badge toasts
   ============================================================ */
(function () {
  'use strict';
  if (window.__badgesInit) return;
  window.__badgesInit = true;

  var path = location.pathname;
  if (path === '/' || path.endsWith('/index.html') || path.endsWith('/login.html')) return;

  if (!document.getElementById('badges-css')) {
    var st = document.createElement('style');
    st.id = 'badges-css';
    st.textContent = [
      '.user-chip__name{display:inline-flex!important;align-items:center;gap:5px;}',
      '.verified-badge{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:linear-gradient(135deg,#C9952E,#9E7524);color:#fff;font-size:0.5rem;flex-shrink:0;}',
      '.streak-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:linear-gradient(135deg,#FDECEC,#FBEFEF);color:#B80F1A;font-family:var(--font-ui,monospace);font-size:0.6rem;letter-spacing:0.04em;font-weight:700;margin-top:4px;}',
      '.streak-pill i{font-size:0.66rem;}',
      '.streak-pill--zero{background:var(--blush);color:var(--slate);}',
      '.badge-toast-wrap{position:fixed;bottom:24px;right:24px;z-index:9500;display:flex;flex-direction:column;gap:10px;pointer-events:none;}',
      '.badge-toast{position:relative;background:linear-gradient(135deg,#11104A,#201F6B);color:#fff;border-radius:16px;padding:14px 40px 14px 14px;display:flex;align-items:center;gap:12px;box-shadow:0 16px 44px rgba(17,16,74,0.4);min-width:260px;max-width:340px;pointer-events:auto;transform:translateX(120%);opacity:0;transition:transform 400ms cubic-bezier(0.16,1,0.3,1),opacity 300ms ease;}',
      '.badge-toast.is-visible{transform:translateX(0);opacity:1;}',
      '.badge-toast__icon{width:44px;height:44px;border-radius:12px;background:rgba(201,149,46,0.22);color:#C9952E;display:grid;place-items:center;font-size:1.2rem;flex-shrink:0;}',
      '.badge-toast__body{flex:1;min-width:0;}',
      '.badge-toast__label{font-family:var(--font-ui,monospace);font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;color:#C9952E;font-weight:700;margin-bottom:3px;}',
      '.badge-toast__name{font-family:var(--font-head,serif);font-size:1rem;font-weight:600;margin-bottom:2px;}',
      '.badge-toast__desc{font-size:0.78rem;opacity:0.85;line-height:1.4;}',
      '.badge-toast__close{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;border:none;background:rgba(255,255,255,0.12);color:#fff;cursor:pointer;font-size:0.7rem;}',
      '@media(max-width:640px){.badge-toast-wrap{bottom:12px;right:12px;left:12px;}.badge-toast{max-width:100%;}}'
    ].join('');
    document.head.appendChild(st);
  }

  function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

  function renderVerified(chip, isVerified) {
    var nameEl = chip.querySelector('.user-chip__name');
    if (!nameEl) return;
    var existing = nameEl.querySelector('.verified-badge');
    if (existing) existing.remove();
    if (isVerified) {
      var b = document.createElement('span');
      b.className = 'verified-badge';
      b.title = 'Verified account';
      b.innerHTML = '<i class="fa-solid fa-check"></i>';
      nameEl.appendChild(b);
    }
  }

  function renderStreak(chip, streak) {
    var info = chip.querySelector('.user-chip__info');
    if (!info) return;
    var existing = info.querySelector('.streak-pill');
    if (existing) existing.remove();
    var pill = document.createElement('div');
    pill.className = 'streak-pill' + (streak.current === 0 ? ' streak-pill--zero' : '');
    if (streak.current > 0) {
      pill.innerHTML = '<i class="fa-solid fa-fire"></i> ' + streak.current + ' day' + (streak.current === 1 ? '' : 's');
      pill.title = 'Longest: ' + streak.longest + ' days · Total: ' + streak.total + ' active days';
    } else {
      pill.innerHTML = '<i class="fa-regular fa-circle"></i> Start a streak';
      pill.title = 'Study today to begin a streak';
    }
    info.appendChild(pill);
  }

  function showToast(badge) {
    var wrap = document.querySelector('.badge-toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'badge-toast-wrap';
      document.body.appendChild(wrap);
    }
    var t = document.createElement('div');
    t.className = 'badge-toast';
    t.innerHTML =
      '<div class="badge-toast__icon"><i class="fa-solid ' + esc(badge.icon || 'fa-medal') + '"></i></div>' +
      '<div class="badge-toast__body">' +
        '<div class="badge-toast__label">New badge unlocked</div>' +
        '<div class="badge-toast__name">' + esc(badge.name) + '</div>' +
        '<div class="badge-toast__desc">' + esc(badge.desc) + '</div>' +
      '</div>' +
      '<button type="button" class="badge-toast__close" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>';
    wrap.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('is-visible'); });
    var hideTimer = setTimeout(hide, 6000);
    function hide() {
      clearTimeout(hideTimer);
      t.classList.remove('is-visible');
      setTimeout(function () { t.remove(); }, 400);
    }
    t.querySelector('.badge-toast__close').addEventListener('click', hide);
  }

  async function init() {
    // Wait for shell.js to finish rendering the user chip.
    var attempts = 0;
    var chip = null;
    while (attempts < 6) {
      await new Promise(function (r) { setTimeout(r, 600); });
      chip = document.getElementById('user-chip');
      if (chip && chip.style.display !== 'none' && chip.querySelector('.user-chip__name')) break;
      attempts++;
    }

    try {
      var res = await fetch('/api/badges/me', { credentials: 'include' });
      if (!res.ok) return;
      var data = await res.json();

      if (chip && data.user) {
        renderVerified(chip, !!data.user.verified);
        if (data.streak) renderStreak(chip, data.streak);
      }

      if (data.newly_awarded && data.newly_awarded.length) {
        var byKey = {};
        (data.badges || []).forEach(function (b) { byKey[b.key] = b; });
        data.newly_awarded.forEach(function (key, i) {
          var info = byKey[key];
          if (info) setTimeout(function () { showToast(info); }, i * 1400);
        });
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
