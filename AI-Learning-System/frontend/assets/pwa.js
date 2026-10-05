/* ============================================================
   pwa.js
   ------------------------------------------------------------
   Registers the service worker, handles install prompt
   (desktop only), and shows a "new version ready" toast when
   the SW updates.
   ============================================================ */
(function () {
  'use strict';

  if (!('serviceWorker' in navigator)) return;

  var path = location.pathname;
  if (path.endsWith('/sw.js') || path.endsWith('/manifest.json')) return;

  /* ---------- 1) Register service worker ---------- */
  var swPath = '/sw.js';
  // Handle subfolders (admin/, lab/): service worker still at root
  navigator.serviceWorker.register(swPath, { scope: '/' }).then(function (reg) {
    // If a new SW is waiting, ask it to activate immediately
    if (reg.waiting) notifyUpdate(reg.waiting);

    reg.addEventListener('updatefound', function () {
      var installing = reg.installing;
      if (!installing) return;
      installing.addEventListener('statechange', function () {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          notifyUpdate(installing);
        }
      });
    });

    // Check for updates every 30 minutes while the app is open
    setInterval(function () {
      reg.update().catch(function () {});
    }, 30 * 60 * 1000);
  }).catch(function (err) {
    console.warn('[pwa] SW registration failed:', err.message);
  });

  // When the SW takes over, reload once so the user sees the fresh version
  var refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  /* ---------- 2) "New version ready" toast ---------- */
  function notifyUpdate(waitingWorker) {
    if (document.getElementById('pwa-update-toast')) return;

    var el = document.createElement('div');
    el.id = 'pwa-update-toast';
    el.style.cssText =
      'position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));' +
      'transform:translateX(-50%) translateY(140%);z-index:9500;' +
      'background:#11104A;color:#fff;border-radius:14px;' +
      'padding:12px 16px;display:flex;align-items:center;gap:12px;' +
      'box-shadow:0 16px 44px rgba(17,16,74,0.42);' +
      'font-family:system-ui,-apple-system,sans-serif;font-size:0.88rem;' +
      'transition:transform 380ms cubic-bezier(0.16,1,0.3,1);' +
      'max-width:calc(100vw - 32px);';
    el.innerHTML =
      '<span style="flex:1;min-width:0;">A new version is ready.</span>' +
      '<button id="pwa-update-btn" type="button" style="' +
        'background:#E6111E;color:#fff;border:none;' +
        'padding:8px 16px;border-radius:999px;font-weight:600;' +
        'font-size:0.84rem;cursor:pointer;white-space:nowrap;' +
      '">Refresh</button>' +
      '<button id="pwa-update-dismiss" type="button" aria-label="Dismiss" style="' +
        'background:transparent;color:rgba(255,255,255,0.7);border:none;' +
        'padding:6px;cursor:pointer;font-size:1rem;' +
      '">×</button>';

    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transform = 'translateX(-50%) translateY(0)';
    });

    document.getElementById('pwa-update-btn').addEventListener('click', function () {
      if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    });
    document.getElementById('pwa-update-dismiss').addEventListener('click', function () {
      el.style.transform = 'translateX(-50%) translateY(140%)';
      setTimeout(function () { el.remove(); }, 400);
    });
  }

  /* ---------- 3) Install prompt — DESKTOP ONLY ---------- */
  var deferredPrompt = null;
  var DISMISS_KEY = 'pwa-install-dismissed';
  var DISMISS_DAYS = 7;
  var DESKTOP_MIN_WIDTH = 900;

  function isDesktop() {
    return window.innerWidth >= DESKTOP_MIN_WIDTH &&
           !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function wasRecentlyDismissed() {
    try {
      var ts = parseInt(localStorage.getItem(DISMISS_KEY) || '0', 10);
      if (!ts) return false;
      var age = Date.now() - ts;
      return age < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch (_) { return false; }
  }

  function markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (_) {}
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;

    if (!isDesktop()) return;    // never show on mobile
    if (wasRecentlyDismissed()) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    var el = document.createElement('div');
    el.id = 'pwa-install-banner';
    el.style.cssText =
      'position:fixed;right:24px;bottom:24px;z-index:9400;' +
      'background:#fff;border:1.5px solid #E7E6EE;border-radius:18px;' +
      'padding:16px 18px;display:flex;align-items:center;gap:14px;' +
      'box-shadow:0 20px 52px rgba(17,16,74,0.22);' +
      'max-width:380px;font-family:system-ui,-apple-system,sans-serif;' +
      'transform:translateY(140%);transition:transform 380ms cubic-bezier(0.16,1,0.3,1);';
    el.innerHTML =
      '<div style="width:42px;height:42px;border-radius:11px;' +
        'background:linear-gradient(135deg,#11104A,#201F6B);' +
        'display:grid;place-items:center;flex-shrink:0;color:#fff;font-weight:700;">' +
        'TC' +
      '</div>' +
      '<div style="flex:1;min-width:0;">' +
        '<div style="font-weight:700;color:#11104A;font-size:0.94rem;margin-bottom:2px;">Install the app</div>' +
        '<div style="color:#5B5A6B;font-size:0.82rem;line-height:1.4;">Get one-tap access from your desktop.</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:6px;">' +
        '<button id="pwa-install-go" type="button" style="' +
          'background:linear-gradient(135deg,#E6111E,#B80F1A);color:#fff;border:none;' +
          'padding:9px 16px;border-radius:999px;font-weight:600;' +
          'font-size:0.84rem;cursor:pointer;white-space:nowrap;' +
        '">Install</button>' +
        '<button id="pwa-install-dismiss" type="button" style="' +
          'background:transparent;color:#5B5A6B;border:none;' +
          'padding:4px;cursor:pointer;font-size:0.74rem;text-decoration:underline;' +
        '">Not now</button>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(function () {
      el.style.transform = 'translateY(0)';
    });

    document.getElementById('pwa-install-go').addEventListener('click', async function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (_) {}
      deferredPrompt = null;
      el.style.transform = 'translateY(140%)';
      setTimeout(function () { el.remove(); }, 400);
    });

    document.getElementById('pwa-install-dismiss').addEventListener('click', function () {
      markDismissed();
      el.style.transform = 'translateY(140%)';
      setTimeout(function () { el.remove(); }, 400);
    });
  }

  window.addEventListener('appinstalled', function () {
    var el = document.getElementById('pwa-install-banner');
    if (el) el.remove();
    try { localStorage.removeItem(DISMISS_KEY); } catch (_) {}
  });

})();
