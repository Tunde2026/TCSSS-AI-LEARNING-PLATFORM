/* ============================================================
   shell.js
   ------------------------------------------------------------
   Renders sidebar, mobile bar, backdrop, user chip, admin bar,
   lab sub-navigation bar.
   ============================================================ */

(function () {
  'use strict';

  var STORAGE_KEY = 'sidebar-state';

  var scriptSrc = document.currentScript
    ? document.currentScript.getAttribute('src')
    : 'assets/shell.js';
  var BASE = scriptSrc.replace(/assets\/shell\.js.*$/, '');

  var NAV_ITEMS = [
    { href: 'chat.html',    icon: 'fa-comment-dots', label: 'Chat'         },
    { href: 'lab.html',     icon: 'fa-flask',        label: 'Studying Lab' },
    { href: 'library.html', icon: 'fa-book-open',    label: 'Library'      }
  ];
  var SETTINGS_ITEM = { href: 'settings.html', icon: 'fa-gear', label: 'Settings' };
  var SCHOOL_URL = 'https://gideon-olukanni.github.io/TCSSS/';

  var ADMIN_SECTIONS = [
    { href: 'dashboard.html', icon: 'fa-gauge-high', label: 'Dashboard' },
    { href: 'users.html',     icon: 'fa-users',      label: 'Users'     },
    { href: 'library.html',   icon: 'fa-book',       label: 'Library'   },
    { href: 'knowledge.html', icon: 'fa-brain',      label: 'Knowledge' },
    { href: 'models.html',    icon: 'fa-microchip',  label: 'Models'    },
    { href: 'analytics.html', icon: 'fa-chart-line', label: 'Analytics' },
    { href: 'audit.html',     icon: 'fa-clipboard-list', label: 'Audit' },
    { href: 'backup.html',    icon: 'fa-database',   label: 'Backup'    },
    { href: 'settings.html',  icon: 'fa-gears',      label: 'Settings'  }
  ];

  var LAB_SECTIONS = [
    { href: 'notes.html',         icon: 'fa-note-sticky',      label: 'Notes' },
    { href: 'flashcards.html',    icon: 'fa-clone',            label: 'Flashcards' },
    { href: 'quiz.html',          icon: 'fa-circle-question',  label: 'Quiz' },
    { href: 'practice.html',      icon: 'fa-dumbbell',         label: 'Practice' },
    { href: 'visualization.html', icon: 'fa-diagram-project',  label: 'Visualization' },
    { href: 'mistakes.html',      icon: 'fa-clipboard-list',   label: 'Mistakes' }
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
      return (
        '<a class="admin-bar__link' + active + '" href="' + s.href + '">' +
          '<i class="fa-solid ' + s.icon + '" aria-hidden="true"></i>' +
          '<span>' + s.label + '</span>' +
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();