/* ============================================================
   shell.js
   ------------------------------------------------------------
   Renders sidebar, mobile bar, backdrop, user chip, admin bar,
   lab sub-navigation bar, and the floating "Ask AI" panel.

   Also loads the Markdown + KaTeX renderer and exposes
   window.renderMarkdown(text, targetElement).
   ============================================================ */

/* ------------------------------------------------------------------
   Markdown + math library loader.
   Runs first so the CDN requests start as early as possible.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  if (document.getElementById('katex-css')) return;

  // KaTeX stylesheet
  var css = document.createElement('link');
  css.id = 'katex-css';
  css.rel = 'stylesheet';
  css.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
  css.crossOrigin = 'anonymous';
  document.head.appendChild(css);

  // Scripts load in order (async=false preserves order)
  var sources = [
    'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
    'https://cdn.jsdelivr.net/npm/dompurify@3.0.8/dist/purify.min.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js',
    'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js',
  ];

  var loaded = 0;
  var failed = 0;

  sources.forEach(function (src) {
    var s = document.createElement('script');
    s.src = src;
    s.async = false;
    s.crossOrigin = 'anonymous';
    s.onload = function () {
      loaded++;
      if (loaded + failed === sources.length) finish();
    };
    s.onerror = function () {
      failed++;
      if (loaded + failed === sources.length) finish();
    };
    document.head.appendChild(s);
  });

  function finish() {
    if (window.marked && window.DOMPurify && window.katex && window.renderMathInElement) {
      window.__mdReady = true;
    } else {
      window.__mdReady = false;
    }
    try {
      document.dispatchEvent(new Event('markdown-ready'));
    } catch (_) {}
  }
})();

/* ------------------------------------------------------------------
   window.renderMarkdown(text, targetEl)
   Converts Markdown + LaTeX to safe HTML and inserts into targetEl.
   Falls back to plain text if libs haven't loaded yet.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  function isReady() {
    return !!(window.__mdReady && window.marked && window.DOMPurify);
  }

  function doRender(text, targetEl) {
    try {
      var html = window.marked.parse(String(text), {
        breaks: true,
        gfm: true,
        headerIds: false,
        mangle: false,
      });

      html = window.DOMPurify.sanitize(html, {
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'style'],
      });

      targetEl.innerHTML = html;

      // Render math
      if (window.renderMathInElement) {
        try {
          window.renderMathInElement(targetEl, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\(', right: '\\)', display: false },
            ],
            throwOnError: false,
            errorColor: '#B80F1A',
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
          });
        } catch (_) {}
      }

      // External links
      targetEl.querySelectorAll('a[href]').forEach(function (a) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      });
    } catch (err) {
      targetEl.textContent = String(text);
    }
  }

  window.renderMarkdown = function (text, targetEl) {
    if (!targetEl) return;
    if (text == null || text === '') { targetEl.textContent = ''; return; }

    if (isReady()) {
      doRender(text, targetEl);
      return;
    }

    // Libs not ready — show plain text now, upgrade once loaded.
    targetEl.textContent = String(text);
    var upgraded = false;
    function upgrade() {
      if (upgraded) return;
      upgraded = true;
      if (targetEl.isConnected && isReady()) {
        doRender(text, targetEl);
      }
    }
    document.addEventListener('markdown-ready', upgrade);
    // Safety net: also try again shortly
    setTimeout(upgrade, 1500);
  };
})();

/* ------------------------------------------------------------------
   App shell — sidebar, mobile bar, user chip, admin bar, lab bar
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  var STORAGE_KEY = 'sidebar-state';

  var scriptSrc = document.currentScript
    ? document.currentScript.getAttribute('src')
    : 'assets/shell.js';
  var BASE = scriptSrc.replace(/assets\/shell\.js.*$/, '');

     var NAV_ITEMS = [
    { href: 'chat.html',    icon: 'fa-comment-dots', label: 'Chat'         },
    { href: 'spark.html',   icon: 'fa-wand-magic-sparkles', label: 'Spark' },
    { href: 'lab.html',     icon: 'fa-flask',        label: 'Studying Lab' },
    { href: 'library.html', icon: 'fa-book-open',    label: 'Library'      }
  ];
  var SETTINGS_ITEM = { href: 'settings.html', icon: 'fa-gear', label: 'Settings' };
  var SCHOOL_URL = 'https://gideon-olukanni.github.io/TCSSS/';

      var ADMIN_SECTIONS = [
    { href: 'dashboard.html', icon: 'fa-gauge-high',  label: 'Dashboard' },
    { href: 'users.html',     icon: 'fa-users',       label: 'Users'     },
    { href: 'support.html',   icon: 'fa-headset',     label: 'Support'   },
    { href: 'library.html',   icon: 'fa-book',        label: 'Library'   },
    { href: 'knowledge.html', icon: 'fa-brain',       label: 'Knowledge' },
    { href: 'models.html',    icon: 'fa-microchip',   label: 'Models'    },
    { href: 'analytics.html', icon: 'fa-chart-line',  label: 'Analytics' },
    { href: 'audit.html',     icon: 'fa-clipboard-list', label: 'Audit'  },
    { href: 'backup.html',    icon: 'fa-database',    label: 'Backup'    },
    { href: 'settings.html',  icon: 'fa-gears',       label: 'Settings'  }
  ];
    var LAB_SECTIONS = [
    { href: 'notes.html',         icon: 'fa-note-sticky',       label: 'Notes' },
    { href: 'flashcards.html',    icon: 'fa-clone',             label: 'Flashcards' },
    { href: 'quiz.html',          icon: 'fa-circle-question',   label: 'Quiz' },
    { href: 'theory.html',        icon: 'fa-spell-check',       label: 'Theory' },
    { href: 'practice.html',      icon: 'fa-dumbbell',          label: 'Practice' },
    { href: 'visualization.html', icon: 'fa-diagram-project',   label: 'Visualization' },
    { href: 'sketch.html',        icon: 'fa-pen-ruler',         label: 'Sketch' },
    { href: 'study-plans.html',   icon: 'fa-calendar-days',     label: 'Plans' },
    { href: 'exam.html',          icon: 'fa-stopwatch',         label: 'Exam' },
    { href: 'quiz-history.html',  icon: 'fa-clock-rotate-left', label: 'History' },
    { href: 'mistakes.html',      icon: 'fa-clipboard-list',    label: 'Mistakes' }
  ];

  var path = location.pathname;
  var current = (path.split('/').pop() || 'index.html');
  var isAdminPage = path.indexOf('/admin/') !== -1;
  var isLabPage   = path.indexOf('/lab/') !== -1;

  function isActive(href) { return href === current; }
  function isMobile() { return window.matchMedia('(max-width: 860px)').matches; }

  function getStoredState() { try { return localStorage.getItem(STORAGE_KEY); } catch (_) { return null; } }
  function setStoredState(s) { try { localStorage.setItem(STORAGE_KEY, s); } catch (_) {} }

  function linkHTML(item) {
    var active = isActive(item.href) ? ' is-active' : '';
    return (
      '<a class="nav-item' + active + '" href="' + BASE + item.href + '">' +
        '<i class="fa-solid ' + item.icon + '" aria-hidden="true"></i>' +
        '<span>' + item.label + '</span>' +
      '</a>'
    );
  }

  function ensureMobileElements() {
    if (!document.querySelector('.mobile-bar')) {
      var bar = document.createElement('div');
      bar.className = 'mobile-bar';
      bar.innerHTML =
        '<button class="mobile-bar__toggle" id="sidebar-toggle-mobile" ' +
                'aria-label="Open menu" type="button">' +
          '<i class="fa-solid fa-bars" aria-hidden="true"></i>' +
        '</button>' +
        '<span class="mobile-bar__title">AI Learning Platform</span>';
      document.body.insertBefore(bar, document.body.firstChild);
    }
    if (!document.getElementById('sidebar-backdrop')) {
      var bd = document.createElement('div');
      bd.className = 'backdrop';
      bd.id = 'sidebar-backdrop';
      document.body.appendChild(bd);
    }
  }

  async function loadPlatformInfo() {
    try {
      var res = await fetch('/api/platform/info');
      if (!res.ok) return;
      var data = await res.json();

      if (data.name) {
        var titleEl = document.querySelector('.sidebar__title');
        if (titleEl) titleEl.innerHTML = data.name.replace(/\s+/g, '<br>').replace(/<br>$/, '');
        var mobileTitle = document.querySelector('.mobile-bar__title');
        if (mobileTitle) mobileTitle.textContent = data.name;
      }

      var slot = document.querySelector('.sidebar__logo-slot');
      if (slot && data.logoUrl) {
        slot.innerHTML = '<img src="' + data.logoUrl + '" alt="Logo">';
        slot.classList.add('has-image');
      }
    } catch (_) {}
  }

  async function loadUserChip() {
    var chip = document.getElementById('user-chip');
    if (!chip) return;
    try {
      var res = await fetch('/api/auth/me', { credentials: 'include' });
      if (!res.ok) { chip.style.display = 'none'; return; }
      var data = await res.json();
      var user = data.user;
      if (!user) { chip.style.display = 'none'; return; }

      var initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
      chip.querySelector('.user-chip__avatar').textContent = initial;
      chip.querySelector('.user-chip__name').textContent = user.name || 'Student';
      chip.querySelector('.user-chip__email').textContent = user.email || '';
      chip.style.display = 'flex';

      if (user.role === 'admin') {
        var adminLink = document.getElementById('admin-nav-link');
        if (adminLink) adminLink.style.display = '';
      }
    } catch (_) {
      chip.style.display = 'none';
    }
  }

  function ensureAdminBar() {
    if (!isAdminPage) return;
    if (document.getElementById('admin-bar')) return;

    var main = document.querySelector('main.page');
    if (!main) return;

        var linksHtml = ADMIN_SECTIONS.map(function (s) {
      var active = s.href === current ? ' is-active' : '';
      var badge = '';
      if (s.href === 'support.html') {
        badge = '<span class="admin-bar__badge-count" id="admin-support-badge" style="display:none"></span>';
      }
      return (
        '<a class="admin-bar__link' + active + '" href="' + s.href + '">' +
          '<i class="fa-solid ' + s.icon + '" aria-hidden="true"></i>' +
          '<span>' + s.label + '</span>' +
          badge +
        '</a>'
      );
    }).join('');

        main.insertAdjacentHTML('afterbegin',
      '<div class="admin-bar" id="admin-bar">' +
        '<div class="admin-bar__row">' +
          '<a class="admin-bar__back" href="' + BASE + 'chat.html">' +
            '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>' +
            '<span>Back to app</span>' +
          '</a>' +
          '<span class="admin-bar__badge">' +
            '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>' +
            'Admin' +
          '</span>' +
        '</div>' +
        '<nav class="admin-bar__nav">' + linksHtml + '</nav>' +
      '</div>'
    );

    loadAdminSupportBadge();
  }

  async function loadAdminSupportBadge() {
    try {
      var res = await fetch('/api/admin/support/unread/count', { credentials: 'include' });
      if (!res.ok) return;
      var data = await res.json();
      var n = data.unread || 0;
      var badge = document.getElementById('admin-support-badge');
      if (badge && n > 0) {
        badge.textContent = n > 9 ? '9+' : String(n);
        badge.style.display = '';
      }
    } catch (_) {}
  }

  function ensureLabBar() {
    if (!isLabPage) return;
    if (document.getElementById('lab-bar')) return;

    var main = document.querySelector('main.page');
    if (!main) return;

    var linksHtml = LAB_SECTIONS.map(function (s) {
      var active = s.href === current ? ' is-active' : '';
      return (
        '<a class="lab-bar__link' + active + '" href="' + s.href + '">' +
          '<i class="fa-solid ' + s.icon + '" aria-hidden="true"></i>' +
          '<span>' + s.label + '</span>' +
        '</a>'
      );
    }).join('');

    main.insertAdjacentHTML('afterbegin',
      '<div class="lab-bar" id="lab-bar">' +
        '<div class="lab-bar__row">' +
          '<a class="lab-bar__back" href="' + BASE + 'lab.html">' +
            '<i class="fa-solid fa-arrow-left" aria-hidden="true"></i>' +
            '<span>Back to Lab</span>' +
          '</a>' +
          '<span class="lab-bar__badge">' +
            '<i class="fa-solid fa-flask" aria-hidden="true"></i>' +
            'Studying Lab' +
          '</span>' +
        '</div>' +
        '<nav class="lab-bar__nav">' + linksHtml + '</nav>' +
      '</div>'
    );
  }

  function render() {
    var mount = document.getElementById('sidebar-mount');
    if (!mount) return;

    ensureMobileElements();

    var mainLinks    = NAV_ITEMS.map(linkHTML).join('');
    var settingsLink = linkHTML(SETTINGS_ITEM);

    var onAdminPage  = isAdminPage;
    var adminLinkHTML =
      '<a class="nav-item' + (onAdminPage ? ' is-active' : '') + '" ' +
         'id="admin-nav-link" href="' + BASE + 'admin/dashboard.html" ' +
         'style="display:none" title="Admin">' +
        '<i class="fa-solid fa-shield-halved" aria-hidden="true"></i>' +
        '<span>Admin</span>' +
      '</a>';

    mount.innerHTML =
      '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
        '<div class="sidebar__header">' +
          '<button class="sidebar__toggle" id="sidebar-toggle" aria-label="Toggle sidebar" type="button">' +
            '<i class="fa-solid fa-bars" aria-hidden="true"></i>' +
          '</button>' +
          '<div class="sidebar__brand">' +
            '<div class="sidebar__logo-slot" aria-hidden="true">LOGO</div>' +
            '<div class="sidebar__title">AI Learning<br>Platform</div>' +
          '</div>' +
        '</div>' +
        '<div class="sidebar__body">' +
          '<nav class="sidebar__nav">' + mainLinks + adminLinkHTML + '</nav>' +
          '<div id="sidebar-slot"></div>' +
        '</div>' +
                '<div class="sidebar__footer">' +
          settingsLink +
          '<a class="nav-item nav-item--support" href="' + BASE + 'support.html" title="Contact support">' +
            '<i class="fa-solid fa-headset" aria-hidden="true"></i>' +
            '<span>Contact Us</span>' +
            '<span class="nav-item__badge" id="support-badge" style="display:none"></span>' +
          '</a>' +
          
          '<a class="nav-item nav-item--utility" href="' + SCHOOL_URL + '" target="_blank" rel="noopener noreferrer" title="Official School Website">' +
            '<i class="fa-solid fa-arrow-up-right-from-square" aria-hidden="true"></i>' +
            '<span>Official School Website</span>' +
          '</a>' +
          '<button class="nav-item" id="logout-btn" type="button" title="Log out">' +
            '<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i>' +
            '<span>Log out</span>' +
          '</button>' +
          '<div class="user-chip" id="user-chip" style="display:none">' +
            '<div class="user-chip__avatar">?</div>' +
            '<div class="user-chip__info">' +
              '<div class="user-chip__name">—</div>' +
              '<div class="user-chip__email">—</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</aside>';

    var sidebar      = document.getElementById('sidebar');
    var toggle       = document.getElementById('sidebar-toggle');
    var mobileToggle = document.getElementById('sidebar-toggle-mobile');
    var backdrop     = document.getElementById('sidebar-backdrop');

    if (!isMobile() && getStoredState() === 'collapsed') {
      sidebar.classList.add('is-collapsed');
    }

    function toggleSidebar() {
      if (isMobile()) closeDrawer();
      else {
        sidebar.classList.toggle('is-collapsed');
        setStoredState(sidebar.classList.contains('is-collapsed') ? 'collapsed' : 'expanded');
      }
    }
    function openDrawer() {
      sidebar.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
    }
    function closeDrawer() {
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
    }

    if (toggle)       toggle.addEventListener('click', toggleSidebar);
    if (mobileToggle) mobileToggle.addEventListener('click', openDrawer);
    if (backdrop)     backdrop.addEventListener('click', closeDrawer);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async function () {
        logoutBtn.disabled = true;
        try {
          await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
        } catch (_) {}
        window.location.href = BASE + 'index.html';
      });
    }

    var lastMobile = isMobile();
    window.addEventListener('resize', function () {
      var nowMobile = isMobile();
      if (nowMobile === lastMobile) return;
      lastMobile = nowMobile;
      closeDrawer();
      if (nowMobile) sidebar.classList.remove('is-collapsed');
      else if (getStoredState() === 'collapsed') sidebar.classList.add('is-collapsed');
      else sidebar.classList.remove('is-collapsed');
    });

    loadPlatformInfo();
    loadUserChip();
    ensureAdminBar();
    ensureLabBar();
    loadSupportBadge();
  }

  async function loadSupportBadge() {
    try {
      var res = await fetch('/api/support/unread/count', { credentials: 'include' });
      if (!res.ok) return;
      var data = await res.json();
      var n = data.unread || 0;
      var badge = document.getElementById('support-badge');
      if (badge && n > 0) {
        badge.textContent = n > 9 ? '9+' : String(n);
        badge.style.display = '';
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();

/* ------------------------------------------------------------------
   Floating "Ask AI" panel — appears on every page.
   Uses window.renderMarkdown for AI replies.
   ------------------------------------------------------------------ */
(function () {
  'use strict';

  if (window.__askAiLoaded) return;
  window.__askAiLoaded = true;

  var path = location.pathname;
  var sectionName = 'Chat';
  if (path.indexOf('/lab/') !== -1) {
    var file = path.split('/').pop().replace('.html', '').replace(/-/g, ' ');
    sectionName = 'Studying Lab › ' + file.charAt(0).toUpperCase() + file.slice(1);
  } else if (path.indexOf('/admin/') !== -1) {
    sectionName = 'Admin';
  } else if (path.indexOf('/chat.html') !== -1) {
    sectionName = 'Chat';
  } else if (path.indexOf('/library') !== -1) {
    sectionName = 'Library';
  } else if (path.indexOf('/settings') !== -1) {
    sectionName = 'Settings';
  }

  if (path === '/' || path.endsWith('/index.html') || path.endsWith('/chat.html')) return;

  var open = false;
  var messages = [];
  var busy = false;

  var fab = document.createElement('button');
  fab.id = 'ask-ai-fab';
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Ask AI');
  fab.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i><span>Ask AI</span>';

  var panel = document.createElement('div');
  panel.id = 'ask-ai-panel';
  panel.innerHTML =
    '<div class="ask-ai__head">' +
      '<div class="ask-ai__title">' +
        '<i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>' +
        'Ask AI <small>' + sectionName + '</small>' +
      '</div>' +
      '<div class="ask-ai__head-actions">' +
        '<button id="ask-ai-new" type="button" title="New question"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>' +
        '<button id="ask-ai-close" type="button" title="Close"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
      '</div>' +
    '</div>' +
    '<div class="ask-ai__body" id="ask-ai-body"></div>' +
    '<form class="ask-ai__form" id="ask-ai-form">' +
      '<textarea id="ask-ai-input" rows="1" placeholder="Ask anything about what you are doing…"></textarea>' +
      '<button id="ask-ai-send" type="submit" aria-label="Send">' +
        '<i class="fa-solid fa-arrow-up" aria-hidden="true"></i>' +
      '</button>' +
    '</form>';

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var body = document.getElementById('ask-ai-body');
  var form = document.getElementById('ask-ai-form');
  var input = document.getElementById('ask-ai-input');
  var sendBtn = document.getElementById('ask-ai-send');

  function renderEmpty() {
    body.innerHTML =
      '<div class="ask-ai__empty">' +
        '<div class="ask-ai__empty-icon"><i class="fa-solid fa-lightbulb" aria-hidden="true"></i></div>' +
        '<p><strong>Stuck on something?</strong></p>' +
        '<p>Ask a quick question about what you are working on. Nothing is saved — this is just for the moment.</p>' +
        '<div class="ask-ai__suggest">' +
          '<button type="button" data-q="Can you explain that in a simpler way?">Explain simpler</button>' +
          '<button type="button" data-q="Can you give me an example?">Give an example</button>' +
          '<button type="button" data-q="Why is this important?">Why does this matter?</button>' +
        '</div>' +
      '</div>';
    body.querySelectorAll('.ask-ai__suggest button').forEach(function (b) {
      b.addEventListener('click', function () {
        input.value = b.getAttribute('data-q');
        input.focus();
      });
    });
  }

  function renderMessage(role, content) {
    var wrap = document.createElement('div');
    wrap.className = 'ask-ai__msg ask-ai__msg--' + (role === 'user' ? 'user' : 'ai');
    if (role === 'ai') wrap.classList.add('md-content');
    body.appendChild(wrap);
    if (role === 'ai' && window.renderMarkdown) {
      window.renderMarkdown(content, wrap);
    } else {
      wrap.textContent = content;
    }
    body.scrollTop = body.scrollHeight;
    return wrap;
  }

  function addTyping() {
    var wrap = document.createElement('div');
    wrap.className = 'ask-ai__msg ask-ai__msg--ai';
    wrap.id = 'ask-ai-typing';
    wrap.innerHTML = '<span class="ask-ai__dots"><span></span><span></span><span></span></span>';
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  }
  function removeTyping() {
    var el = document.getElementById('ask-ai-typing');
    if (el) el.remove();
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }

  async function send() {
    var text = input.value.trim();
    if (!text || busy) return;

    busy = true;
    sendBtn.disabled = true;
    input.disabled = true;

    var empty = body.querySelector('.ask-ai__empty');
    if (empty) empty.remove();

    renderMessage('user', text);
    messages.push({ role: 'user', content: text });
    input.value = '';
    autoGrow();
    addTyping();

    try {
      var res = await fetch('/api/ai/quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          messages: messages,
          context: { section: sectionName },
        }),
      });
      var data = await res.json().catch(function () { return {}; });
      removeTyping();
      if (!res.ok) {
        renderMessage('ai', data.error || 'Something went wrong.');
        return;
      }
      renderMessage('ai', data.reply);
      messages.push({ role: 'assistant', content: data.reply });
    } catch (err) {
      removeTyping();
      renderMessage('ai', 'Cannot reach the server.');
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  function openPanel() {
    open = true;
    panel.classList.add('is-open');
    fab.classList.add('is-hidden');
    setTimeout(function () { input.focus(); }, 250);
  }

  function closePanel() {
    open = false;
    panel.classList.remove('is-open');
    fab.classList.remove('is-hidden');
  }

  function reset() {
    messages = [];
    renderEmpty();
    input.value = '';
  }

  fab.addEventListener('click', openPanel);
  document.getElementById('ask-ai-close').addEventListener('click', closePanel);
  document.getElementById('ask-ai-new').addEventListener('click', reset);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send();
  });

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && open) closePanel();
  });

  // Initial empty state
  renderEmpty();
})();