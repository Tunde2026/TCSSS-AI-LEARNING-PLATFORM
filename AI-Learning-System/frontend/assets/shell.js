/* ============================================================
   shell.js
   ------------------------------------------------------------
   The ONE approved shared script for this project.
   Single purpose: render the persistent sidebar into
   <div id="sidebar-mount"></div> on every app page, and wire
   up the mobile drawer toggle.

   Per project rule 41, any other JS must live inside the page
   that needs it.
   ============================================================ */

(function () {
  'use strict';

  // Determine base path so this works from /frontend/*.html
  // and /frontend/admin/*.html without hardcoding.
  var scriptSrc = document.currentScript
    ? document.currentScript.getAttribute('src')
    : 'assets/shell.js';
// BASE is the path back to the frontend root (relative).
// e.g. from /admin/dashboard.html with src="../assets/shell.js", BASE = "../"
//      from /chat.html         with src="assets/shell.js",   BASE = ""
var BASE = scriptSrc.replace(/assets\/shell\.js.*$/, '');

  var NAV_ITEMS = [
    { href: 'chat.html',    icon: '\u{1F4AC}', label: 'Chat'         },
    { href: 'lab.html',     icon: '\u{1F9EA}', label: 'Studying Lab' },
    { href: 'library.html', icon: '\u{1F4DA}', label: 'Library'      }
  ];

  var SETTINGS_ITEM = { href: 'settings.html', icon: '\u2699\uFE0F', label: 'Settings' };

  var SCHOOL_URL = 'https://gideon-olukanni.github.io/TCSSS/';

  // Which page are we on? Strip query/hash, take the filename.
  var current = (location.pathname.split('/').pop() || 'index.html');

  function isActive(href) {
    return href === current;
  }

  function linkHTML(item) {
    var active = isActive(item.href) ? ' is-active' : '';
    return (
      '<a class="sidebar__link' + active + '" href="' + BASE + item.href + '">' +
        '<span aria-hidden="true">' + item.icon + '</span>' +
        '<span>' + item.label + '</span>' +
      '</a>'
    );
  }

  function render() {
    var mount = document.getElementById('sidebar-mount');
    if (!mount) return;

    var mainLinks = NAV_ITEMS.map(linkHTML).join('');
    var settingsLink = linkHTML(SETTINGS_ITEM);

    mount.innerHTML =
      '<aside class="sidebar" id="sidebar" aria-label="Main navigation">' +
        '<div class="sidebar__brand">' +
          '<div class="sidebar__logo-slot" aria-hidden="true">LOGO</div>' +
          '<div class="sidebar__title">AI Learning<br>Platform</div>' +
        '</div>' +
        '<nav class="sidebar__nav">' + mainLinks + '</nav>' +
        '<div class="sidebar__spacer"></div>' +
        '<a class="sidebar__utility" href="' + SCHOOL_URL + '" ' +
           'target="_blank" rel="noopener noreferrer">' +
           'Official School Website \u2197' +
        '</a>' +
        settingsLink +
      '</aside>';

    // Mobile toggle
    var toggle = document.getElementById('sidebar-toggle');
    var backdrop = document.getElementById('sidebar-backdrop');
    var sidebar = document.getElementById('sidebar');

    function close() {
      sidebar.classList.remove('is-open');
      if (backdrop) backdrop.classList.remove('is-open');
    }
    function open() {
      sidebar.classList.add('is-open');
      if (backdrop) backdrop.classList.add('is-open');
    }

    if (toggle) {
      toggle.addEventListener('click', function () {
        sidebar.classList.contains('is-open') ? close() : open();
      });
    }
    if (backdrop) backdrop.addEventListener('click', close);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();