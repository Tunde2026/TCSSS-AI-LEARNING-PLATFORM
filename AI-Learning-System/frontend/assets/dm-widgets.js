
/* ============================================================
   dm-widgets.js
   ------------------------------------------------------------
   Shared inline widget builders. Loaded by chat.html and
   messages.html. Each builder returns a DOM element ready to
   be appended into a message.
   ============================================================ */
(function (root) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function extractIdFromUrl(tool) {
    if (!tool || !tool.url) return null;
    var m = tool.url.match(/[?&]id=([^&]+)/);
    return m ? m[1] : null;
  }

  /* ----------------------------------------------------------
     Mermaid loader
     ---------------------------------------------------------- */
  function ensureMermaid() {
    if (window.mermaid && window.__mermaidReady) return Promise.resolve(window.mermaid);
    if (window.__mermaidLoading) return window.__mermaidLoading;
    window.__mermaidLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js';
      s.onload = function () {
        if (window.mermaid) {
          try {
            window.mermaid.initialize({
              startOnLoad: false, theme: 'base',
              themeVariables: {
                primaryColor: '#FBEFEF', primaryTextColor: '#1E1D3D',
                primaryBorderColor: '#11104A', lineColor: '#5B5A6B',
                fontFamily: 'Work Sans, sans-serif', fontSize: '14px'
              },
              securityLevel: 'loose', suppressErrorRendering: true
            });
            window.__mermaidReady = true;
            resolve(window.mermaid);
          } catch (e) { reject(e); }
        } else { reject(new Error('mermaid missing')); }
      };
      s.onerror = function () { reject(new Error('mermaid CDN')); };
      document.head.appendChild(s);
    });
    return window.__mermaidLoading;
  }

  /* ==========================================================
     QUIZ — one question at a time
     ========================================================== */
  async function buildQuiz(tool) {
    var id = extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'qa-widget';
    c.innerHTML = '<div class="widget-loading">Loading quiz…</div>';
    try {
      var res = await fetch('/api/tools/quiz/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load quiz.</div>'; return c; }
      var data = await res.json();
      if (!data.quiz || !data.quiz.questions || !data.quiz.questions.length) {
        c.innerHTML = '<div class="widget-error">Quiz has no questions.</div>';
        return c;
      }
      renderQuiz(c, data.quiz);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }

  function renderQuiz(container, quiz) {
    var total = quiz.questions.length;
    var idx = 0, answers = {}, submitted = false, graded = null;

    container.className = 'qa-widget';
    container.innerHTML =
      '<div class="qa-widget__head qa-widget__head--quiz">' +
        '<div class="qa-widget__icon"><i class="fa-solid fa-circle-question"></i></div>' +
        '<div class="qa-widget__headtext">' +
          '<div class="qa-widget__title">' + esc(quiz.title || 'Quiz') + '</div>' +
          '<div class="qa-widget__meta">' + esc(quiz.topic || 'general') + ' · ' + esc(quiz.difficulty || 'medium') + '</div>' +
        '</div>' +
        '<div class="qa-widget__pill" data-role="counter">1 / ' + total + '</div>' +
      '</div>' +
      '<div class="qa-progress"><div class="qa-progress__fill" data-role="progress" style="width:' + (1/total*100) + '%"></div></div>' +
      '<div class="qa-body" data-role="body"></div>' +
      '<div class="qa-actions">' +
        '<div class="qa-actions__left"><button type="button" class="qa-btn" data-role="prev"><i class="fa-solid fa-arrow-left"></i> Back</button></div>' +
        '<div class="qa-actions__right"><button type="button" class="qa-btn qa-btn--primary" data-role="next">Next <i class="fa-solid fa-arrow-right"></i></button></div>' +
      '</div>' +
      '<div data-role="result-slot"></div>';

    var bodyEl = container.querySelector('[data-role="body"]');
    var counterEl = container.querySelector('[data-role="counter"]');
    var progressEl = container.querySelector('[data-role="progress"]');
    var prevBtn = container.querySelector('[data-role="prev"]');
    var nextBtn = container.querySelector('[data-role="next"]');
    var resultSlot = container.querySelector('[data-role="result-slot"]');

    function renderCurrent() {
      var q = quiz.questions[idx];
      counterEl.textContent = (idx + 1) + ' / ' + total;
      progressEl.style.width = ((idx + 1) / total * 100) + '%';
      prevBtn.disabled = idx === 0;
      var isLast = idx === total - 1;
      if (submitted) nextBtn.innerHTML = isLast ? 'Done' : 'Next <i class="fa-solid fa-arrow-right"></i>';
      else nextBtn.innerHTML = isLast ? 'Submit <i class="fa-solid fa-check"></i>' : 'Next <i class="fa-solid fa-arrow-right"></i>';

      bodyEl.innerHTML =
        '<div class="qa-qnum">Question ' + (idx + 1) + ' of ' + total + '</div>' +
        '<p class="qa-qtext">' + esc(q.question) + '</p>' +
        '<div class="qa-opts" data-role="opts"></div>' +
        '<div class="qa-feedback" data-role="feedback"></div>';

      var optsEl = bodyEl.querySelector('[data-role="opts"]');
      (q.options || []).forEach(function (opt) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'qa-opt';
        b.setAttribute('data-label', opt.label);
        b.innerHTML = '<span class="qa-opt__label">' + esc(opt.label) + '</span><span class="qa-opt__text">' + esc(opt.text) + '</span>';
        if (submitted && graded) {
          var g = graded.find(function (x) { return x.questionId === q.id; });
          if (g) {
            b.disabled = true;
            if (opt.label === g.correct) b.classList.add('is-correct-answer');
            if (opt.label === g.selected && !g.isCorrect) b.classList.add('is-wrong-answer');
          }
        } else {
          if (answers[q.id] === opt.label) b.classList.add('is-selected');
          b.addEventListener('click', function () {
            optsEl.querySelectorAll('.qa-opt').forEach(function (o) { o.classList.remove('is-selected'); });
            b.classList.add('is-selected');
            answers[q.id] = opt.label;
          });
        }
        optsEl.appendChild(b);
      });

      if (submitted && graded) {
        var g2 = graded.find(function (x) { return x.questionId === q.id; });
        if (g2) {
          var fb = bodyEl.querySelector('[data-role="feedback"]');
          fb.classList.add('is-visible', g2.isCorrect ? 'qa-feedback--correct' : 'qa-feedback--wrong');
          var html = '<strong>' + (g2.isCorrect ? '✓ Correct' : '✗ Missed') + '</strong>';
          if (!g2.isCorrect) html += '<div>Correct answer: <b>' + esc(g2.correct) + '</b></div>';
          if (q.explanation) html += '<div style="margin-top:6px">' + esc(q.explanation) + '</div>';
          fb.innerHTML = html;
        }
      }
    }

    prevBtn.addEventListener('click', function () { if (idx > 0) { idx--; renderCurrent(); } });
    nextBtn.addEventListener('click', async function () {
      if (submitted) { if (idx < total - 1) { idx++; renderCurrent(); } return; }
      if (idx < total - 1) { idx++; renderCurrent(); return; }
      var missing = quiz.questions.filter(function (q) { return !answers[q.id]; });
      if (missing.length) {
        var first = quiz.questions.findIndex(function (q) { return !answers[q.id]; });
        idx = first; renderCurrent();
        return;
      }
      nextBtn.disabled = true; nextBtn.textContent = 'Submitting…';
      var payload = quiz.questions.map(function (q) { return { questionId: q.id, selected: answers[q.id] || null }; });
      try {
        var res = await fetch('/api/tools/quiz/' + quiz.id + '/attempt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ answers: payload })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) { nextBtn.disabled = false; nextBtn.textContent = 'Try again'; return; }
        submitted = true; graded = data.graded || [];
        resultSlot.innerHTML = '<div class="qa-result"><div class="qa-result__score">' + data.attempt.score + ' / ' + data.attempt.total + '<small>Final score</small></div></div>';
        idx = 0; nextBtn.disabled = false; renderCurrent();
      } catch (_) { nextBtn.disabled = false; nextBtn.textContent = 'Network error'; }
    });
    renderCurrent();
  }

  /* ==========================================================
     FLASHCARDS
     ========================================================== */
  async function buildFlashcards(tool) {
    var id = extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'flashcard-widget';
    c.innerHTML = '<div class="widget-loading">Loading flashcards…</div>';
    try {
      var res = await fetch('/api/tools/flashcards/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load.</div>'; return c; }
      var data = await res.json();
      if (!data.deck || !data.deck.cards || !data.deck.cards.length) {
        c.innerHTML = '<div class="widget-error">No cards.</div>'; return c;
      }
      renderFc(c, data.deck);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }

  function renderFc(container, deck) {
    var i = 0, total = deck.cards.length, flipped = false, ratings = {};
    container.innerHTML =
      '<div class="flashcard-widget__head">' +
        '<div class="flashcard-widget__icon"><i class="fa-solid fa-clone"></i></div>' +
        '<div><div class="flashcard-widget__title">' + esc(deck.title || 'Flashcards') + '</div>' +
        '<div class="flashcard-widget__meta">' + total + ' card' + (total===1?'':'s') + ' · ' + esc(deck.topic || 'general') + '</div></div>' +
      '</div>' +
      '<div class="flashcard-widget__stage">' +
        '<div class="flashcard-widget__card" id="fc-'+Math.random().toString(36).slice(2,8)+'">' +
          '<div class="flashcard-widget__inner">' +
            '<div class="flashcard-widget__face flashcard-widget__face--front">' +
              '<span class="flashcard-widget__corner">Question</span>' +
              '<p class="flashcard-widget__text" data-role="front">—</p>' +
              '<div class="flashcard-widget__hint">Click to flip</div>' +
            '</div>' +
            '<div class="flashcard-widget__face flashcard-widget__face--back">' +
              '<span class="flashcard-widget__corner">Answer</span>' +
              '<p class="flashcard-widget__text" data-role="back">—</p>' +
              '<div class="flashcard-widget__hint">Click to flip back</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="flashcard-widget__rate" data-role="rate">' +
          '<button type="button" class="flashcard-rate-btn flashcard-rate-btn--again" data-q="0">Again<small>&lt; 1 min</small></button>' +
          '<button type="button" class="flashcard-rate-btn flashcard-rate-btn--hard" data-q="1">Hard<small>~1 day</small></button>' +
          '<button type="button" class="flashcard-rate-btn flashcard-rate-btn--good" data-q="2">Good<small>days</small></button>' +
          '<button type="button" class="flashcard-rate-btn flashcard-rate-btn--easy" data-q="3">Easy<small>longer</small></button>' +
        '</div>' +
        '<div class="flashcard-widget__hint-line" data-role="hint">Flip to see the answer, then rate yourself</div>' +
      '</div>' +
      '<div class="flashcard-widget__progress">' +
        '<div class="flashcard-widget__progress-bar"><div class="flashcard-widget__progress-fill" data-role="fill" style="width:0%"></div></div>' +
        '<span class="flashcard-widget__progress-label" data-role="label">0 / ' + total + '</span>' +
      '</div>';

    var card = container.querySelector('.flashcard-widget__card');
    var front = container.querySelector('[data-role="front"]');
    var back = container.querySelector('[data-role="back"]');
    var rate = container.querySelector('[data-role="rate"]');
    var hint = container.querySelector('[data-role="hint"]');
    var fill = container.querySelector('[data-role="fill"]');
    var label = container.querySelector('[data-role="label"]');

    function load() {
      if (i >= total) { done(); return; }
      front.textContent = deck.cards[i].front;
      back.textContent = deck.cards[i].back;
      card.classList.remove('is-flipped');
      rate.classList.remove('is-visible');
      hint.classList.remove('is-hidden');
      flipped = false;
      fill.style.width = (i / total * 100) + '%';
      label.textContent = i + ' / ' + total;
    }
    card.addEventListener('click', function () {
      flipped = !flipped;
      card.classList.toggle('is-flipped', flipped);
      rate.classList.toggle('is-visible', flipped);
      hint.classList.toggle('is-hidden', flipped);
    });
    rate.querySelectorAll('.flashcard-rate-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (!flipped) return;
        var q = parseInt(btn.getAttribute('data-q'), 10);
        var c = deck.cards[i];
        fetch('/api/tools/flashcards/card/' + c.id + '/review', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ quality: q })
        }).catch(function () {});
        ratings[c.id] = q; i++;
        fill.style.width = (i / total * 100) + '%';
        label.textContent = i + ' / ' + total;
        load();
      });
    });
    function done() {
      container.querySelector('.flashcard-widget__stage').innerHTML =
        '<div class="flashcard-widget__done"><div class="flashcard-widget__done-icon"><i class="fa-solid fa-check"></i></div>' +
        '<h3 class="flashcard-widget__done-title">Deck complete</h3>' +
        '<p class="flashcard-widget__done-desc">You reviewed ' + total + ' cards.</p></div>';
    }
    load();
  }

  
  /* ==========================================================
     PHOTOS — multiple images from search
     ========================================================== */
  function buildPhotos(tool) {
    var c = document.createElement('div');
    c.className = 'dm-photos-widget';

    var images = Array.isArray(tool.images) ? tool.images.slice(0, 12) : [];
    if (!images.length) return null;

    var headerHtml =
      '<div class="dm-photos-widget__head">' +
        '<div class="dm-photos-widget__icon"><i class="fa-solid fa-images"></i></div>' +
        '<div>' +
          '<div class="dm-photos-widget__title">' + esc(tool.title || 'Photos') + '</div>' +
          '<div class="dm-photos-widget__meta">' + images.length + ' image' + (images.length === 1 ? '' : 's') + '</div>' +
        '</div>' +
      '</div>';

    var gridHtml = '<div class="dm-photos-widget__grid">';
    images.forEach(function (img) {
      var src = img.thumb || img.url;
      gridHtml += '<a class="dm-photos-widget__cell" href="' + esc(img.url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(src) + '" alt="' + esc(img.alt || '') + '" loading="lazy" ' +
          'onerror="this.parentElement.classList.add(\'is-broken\');this.remove();">' +
      '</a>';
    });
    gridHtml += '</div>';

    var creditHtml = '';
    var pexelsAuthor = images.find(function (x) { return x.author; });
    if (pexelsAuthor && pexelsAuthor.author) {
      creditHtml = '<div class="dm-photos-widget__credit">Photos by ' + esc(pexelsAuthor.author) + ' · Pexels</div>';
    }

    c.innerHTML = headerHtml + gridHtml + creditHtml;
    return c;
  }

  
  function buildSingleImage(tool) {
    var c = document.createElement('div');
    c.className = 'dm-image-widget';
    var url = tool.url || tool.imageUrl;
    if (!url) return null;
    c.innerHTML =
      '<a class="dm-image-widget__link" href="' + esc(url) + '" target="_blank" rel="noopener">' +
        '<img src="' + esc(tool.thumb || url) + '" alt="' + esc(tool.prompt || '') + '" loading="lazy">' +
      '</a>' +
      (tool.prompt ? '<div class="dm-image-widget__caption">' + esc(tool.prompt) + '</div>' : '');
    return c;
  }

  /* ==========================================================
     SKETCH
     ========================================================== */
  function buildSketch(tool) {
    var c = document.createElement('div');
    c.className = 'sketch-widget';
    var cid = 'sk-' + Math.random().toString(36).slice(2,8);
    c.innerHTML =
      '<div class="sketch-widget__head">' +
        '<div class="sketch-widget__icon"><i class="fa-solid fa-pen-ruler"></i></div>' +
        '<div><div class="sketch-widget__title">' + esc(tool.title || 'Formula') + '</div>' +
        '<div class="sketch-widget__meta">' + esc(tool.kind || 'formula') + '</div></div>' +
      '</div>' +
      '<div class="sketch-widget__canvas" id="' + cid + '"></div>' +
      (tool.explanation ? '<div class="sketch-widget__explain">' + esc(tool.explanation) + '</div>' : '') +
      '<div class="sketch-widget__actions">' +
        '<button type="button" class="sketch-copy-btn" data-copy="unicode"><i class="fa-solid fa-copy"></i> Copy</button>' +
        '<button type="button" class="sketch-copy-btn" data-copy="latex"><i class="fa-solid fa-square-root-variable"></i> LaTeX</button>' +
      '</div>';
    var canvas = c.querySelector('#' + cid);
    var latex = tool.latex || '', uni = tool.unicode || tool.plain || '';
    if (latex && window.renderMarkdown) {
      var wrapped = latex.indexOf('$') !== -1 ? latex : '$' + latex + '$';
      window.renderMarkdown(wrapped, canvas);
    } else { canvas.textContent = uni || '—'; }
    c.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-copy') === 'latex' ? latex : uni;
        navigator.clipboard.writeText(t);
        b.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        setTimeout(function () { b.innerHTML = '<i class="fa-solid fa-copy"></i> Copy'; }, 1400);
      });
    });
    return c;
  }

  /* ==========================================================
     VISUALIZATION
     ========================================================== */
  async function buildVisualization(tool) {
    var c = document.createElement('div');
    c.className = 'viz-widget';
    var cid = 'viz-' + Math.random().toString(36).slice(2,8);
    c.innerHTML =
      '<div class="viz-widget__head">' +
        '<div class="viz-widget__icon"><i class="fa-solid fa-diagram-project"></i></div>' +
        '<div><div class="viz-widget__title">' + esc(tool.title || 'Diagram') + '</div>' +
        '<div class="viz-widget__meta">' + esc(tool.kind || 'flowchart') + '</div></div>' +
      '</div>' +
      '<div class="viz-widget__canvas" id="' + cid + '"><div class="widget-loading">Rendering…</div></div>' +
      (tool.explanation ? '<div class="viz-widget__explanation">' + esc(tool.explanation) + '</div>' : '');
    var canvas = c.querySelector('#' + cid);
    try {
      var m = await ensureMermaid();
      var raw = tool.mermaid || tool.code || tool.diagram || '';
      if (!raw) { canvas.innerHTML = '<div class="widget-error">No diagram code.</div>'; return c; }
      try { await m.parse(raw); } catch (e) { canvas.innerHTML = '<div class="widget-error">Bad diagram: ' + esc(e.message) + '</div>'; return c; }
      var rid = 'r-' + Date.now();
      var out = await Promise.race([
        m.render(rid, raw),
        new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, 12000); })
      ]);
      canvas.innerHTML = out.svg;
    } catch (e) { canvas.innerHTML = '<div class="widget-error">' + esc(e.message || 'Render failed') + '</div>'; }
    return c;
  }

  /* ==========================================================
     THEORY
     ========================================================== */
  async function buildTheory(tool) {
    var id = tool.setId || extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'qa-widget';
    c.innerHTML = '<div class="widget-loading">Loading theory…</div>';
    try {
      var res = await fetch('/api/tools/theory/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load.</div>'; return c; }
      var data = await res.json();
      if (!data.set || !data.set.questions || !data.set.questions.length) { c.innerHTML = '<div class="widget-error">No questions.</div>'; return c; }
      renderTheory(c, data.set);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }

  function renderTheory(container, set) {
    var total = set.questions.length, i = 0, answers = {}, submitted = false, graded = null;
    container.className = 'qa-widget';
    container.innerHTML =
      '<div class="qa-widget__head qa-widget__head--theory">' +
        '<div class="qa-widget__icon"><i class="fa-solid fa-spell-check"></i></div>' +
        '<div class="qa-widget__headtext">' +
          '<div class="qa-widget__title">' + esc(set.title || 'Theory') + '</div>' +
          '<div class="qa-widget__meta">' + esc(set.topic || 'general') + '</div>' +
        '</div>' +
        '<div class="qa-widget__pill" data-role="counter">1 / ' + total + '</div>' +
      '</div>' +
      '<div class="qa-progress"><div class="qa-progress__fill" data-role="progress" style="width:' + (1/total*100) + '%"></div></div>' +
      '<div class="qa-body" data-role="body"></div>' +
      '<div class="qa-actions">' +
        '<button type="button" class="qa-btn" data-role="prev"><i class="fa-solid fa-arrow-left"></i> Back</button>' +
        '<button type="button" class="qa-btn qa-btn--primary" data-role="next">Next</button>' +
      '</div>' +
      '<div data-role="result"></div>';
    var body = container.querySelector('[data-role="body"]');
    var counter = container.querySelector('[data-role="counter"]');
    var prog = container.querySelector('[data-role="progress"]');
    var prev = container.querySelector('[data-role="prev"]');
    var next = container.querySelector('[data-role="next"]');
    var result = container.querySelector('[data-role="result"]');

    function render() {
      var q = set.questions[i];
      counter.textContent = (i + 1) + ' / ' + total;
      prog.style.width = ((i + 1) / total * 100) + '%';
      prev.disabled = i === 0;
      var isLast = i === total - 1;
      next.innerHTML = submitted ? (isLast ? 'Done' : 'Next') : (isLast ? 'Submit' : 'Next');
      body.innerHTML = '<div class="qa-qnum">Question ' + (i + 1) + ' of ' + total + '</div><div class="qa-qtext qa-qtext--template"></div><div class="qa-feedback"></div>';
      var t = body.querySelector('.qa-qtext--template');
      var parts = String(q.template).split('___');
      if (parts.length < 2) t.textContent = q.template;
      else {
        t.appendChild(document.createTextNode(parts[0]));
        var inp = document.createElement('input');
        inp.type = 'text'; inp.placeholder = 'answer';
        inp.value = answers[q.id] || '';
        if (submitted && graded) {
          var g = graded.find(function (x) { return x.questionId === q.id; });
          if (g) { inp.disabled = true; inp.classList.add(g.correct ? 'is-correct' : 'is-wrong'); }
        } else inp.addEventListener('input', function () { answers[q.id] = inp.value; });
        t.appendChild(inp);
        if (parts[1]) t.appendChild(document.createTextNode(parts.slice(1).join('___')));
        if (!submitted) setTimeout(function () { inp.focus(); }, 60);
      }
      if (submitted && graded) {
        var g2 = graded.find(function (x) { return x.questionId === q.id; });
        if (g2) {
          var fb = body.querySelector('.qa-feedback');
          fb.classList.add('is-visible', g2.correct ? 'qa-feedback--correct' : 'qa-feedback--wrong');
          fb.innerHTML = '<strong>' + (g2.correct ? '✓ Correct' : '✗ Not quite') + '</strong>' +
            (g2.correct ? '' : '<div>Accepted: ' + esc((g2.acceptedAnswers||[]).join(' / ')) + '</div>');
        }
      }
    }
    prev.addEventListener('click', function () { if (i > 0) { i--; render(); } });
    next.addEventListener('click', async function () {
      if (submitted) { if (i < total - 1) { i++; render(); } return; }
      if (i < total - 1) { i++; render(); return; }
      var missing = set.questions.filter(function (q) { return !String(answers[q.id]||'').trim(); });
      if (missing.length) { i = set.questions.findIndex(function (q) { return !String(answers[q.id]||'').trim(); }); render(); return; }
      next.disabled = true; next.textContent = 'Submitting…';
      try {
        var res = await fetch('/api/tools/theory/' + set.id + '/attempt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include', body: JSON.stringify({ answers: set.questions.map(function (q) { return { questionId: q.id, answer: answers[q.id]||'' }; }) })
        });
        var data = await res.json().catch(function () { return {}; });
        if (!res.ok) { next.disabled = false; next.textContent = 'Try again'; return; }
        submitted = true; graded = data.graded || [];
        result.innerHTML = '<div class="qa-result"><div class="qa-result__score">' + data.attempt.score + ' / ' + data.attempt.total + '<small>Final score</small></div></div>';
        i = 0; next.disabled = false; render();
      } catch (_) { next.disabled = false; next.textContent = 'Network error'; }
    });
    render();
  }

  /* ==========================================================
     PRACTICE
     ========================================================== */
  async function buildPractice(tool) {
    var id = tool.setId || extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'practice-widget';
    c.innerHTML = '<div class="widget-loading">Loading…</div>';
    try {
      var res = await fetch('/api/tools/practice/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load.</div>'; return c; }
      var data = await res.json();
      if (!data.set || !data.set.questions) { c.innerHTML = '<div class="widget-error">No questions.</div>'; return c; }
      renderPractice(c, data.set);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }
  function renderPractice(container, set) {
    container.innerHTML =
      '<div class="practice-widget__head"><div class="practice-widget__icon"><i class="fa-solid fa-dumbbell"></i></div>' +
      '<div><div class="practice-widget__title">' + esc(set.title || 'Practice') + '</div>' +
      '<div class="practice-widget__meta">' + set.questions.length + ' question' + (set.questions.length===1?'':'s') + '</div></div></div>' +
      '<div class="practice-widget__body">' +
        set.questions.map(function (q, idx) {
          return '<div class="practice-q"><div class="practice-q__num">Q' + (idx+1) + '</div>' +
            '<div class="practice-q__text">' + esc(q.question) + '</div>' +
            '<div class="practice-q__actions">' +
              (q.hint ? '<button type="button" class="practice-btn practice-btn--hint" data-role="hint">Hint</button>' : '') +
              '<button type="button" class="practice-btn" data-role="answer">Show answer</button>' +
            '</div>' +
            (q.hint ? '<div class="practice-hint"><strong>Hint</strong>' + esc(q.hint) + '</div>' : '') +
            '<div class="practice-answer"><strong>Answer</strong>' + esc(q.answer) + '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    container.querySelectorAll('.practice-q').forEach(function (qEl) {
      var h = qEl.querySelector('.practice-hint');
      var a = qEl.querySelector('.practice-answer');
      var hb = qEl.querySelector('[data-role="hint"]');
      var ab = qEl.querySelector('[data-role="answer"]');
      if (hb) hb.addEventListener('click', function () { h.classList.toggle('is-visible'); });
      if (ab) ab.addEventListener('click', function () {
        a.classList.toggle('is-visible');
        ab.textContent = a.classList.contains('is-visible') ? 'Hide answer' : 'Show answer';
      });
    });
  }

  /* ==========================================================
     EXAM
     ========================================================== */
  async function buildExam(tool) {
    var id = tool.examId || extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'qa-widget';
    c.innerHTML = '<div class="widget-loading">Loading exam…</div>';
    try {
      var res = await fetch('/api/tools/quiz/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load exam.</div>'; return c; }
      var data = await res.json();
      var exam = data.quiz;
      if (!exam || !exam.questions || !exam.questions.length) { c.innerHTML = '<div class="widget-error">No questions.</div>'; return c; }
      if (!exam.id) exam.id = id;
      renderExam(c, exam);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }
  function renderExam(container, exam) {
    // Simplified version — reuse quiz renderer with timer stripped
    renderQuiz(container, exam);
  }

  /* ==========================================================
     STUDY PLAN
     ========================================================== */
  async function buildStudyPlan(tool) {
    var id = tool.planId || extractIdFromUrl(tool);
    if (!id) return null;
    var c = document.createElement('div');
    c.className = 'plan-widget';
    c.innerHTML = '<div class="widget-loading">Loading…</div>';
    try {
      var res = await fetch('/api/tools/studyplans/' + id, { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load.</div>'; return c; }
      var data = await res.json();
      if (!data.plan || !data.plan.plan) { c.innerHTML = '<div class="widget-error">Invalid plan.</div>'; return c; }
      renderPlan(c, data.plan);
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }
  function renderPlan(container, plan) {
    var days = plan.plan.days || [];
    container.innerHTML =
      '<div class="plan-widget__head"><div class="plan-widget__icon"><i class="fa-solid fa-calendar-days"></i></div>' +
      '<div><div class="plan-widget__title">' + esc(plan.title || 'Study plan') + '</div>' +
      '<div class="plan-widget__meta">' + plan.duration_days + ' days · ' + esc(plan.topic || '') + '</div></div></div>' +
      '<div class="plan-widget__days">' +
        days.map(function (d, di) {
          return '<div class="plan-day' + (di===0?' is-open':'') + '">' +
            '<div class="plan-day__head"><div class="plan-day__num">' + (d.day||di+1) + '</div>' +
            '<div class="plan-day__body"><div class="plan-day__title">' + esc(d.title||'Day '+(di+1)) + '</div>' +
            '<div class="plan-day__sub">' + (d.tasks||[]).length + ' tasks</div></div>' +
            '<i class="fa-solid fa-chevron-down plan-day__arrow"></i></div>' +
            '<div class="plan-day__tasks">' +
              (d.tasks||[]).map(function (t) { return '<div class="plan-task"><div class="plan-task__check"></div><div class="plan-task__text">' + esc(t) + '</div></div>'; }).join('') +
            '</div></div>';
        }).join('') +
      '</div>';
    container.querySelectorAll('.plan-day__head').forEach(function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('is-open'); });
    });
    container.querySelectorAll('.plan-task').forEach(function (t) {
      t.addEventListener('click', function () {
        t.classList.toggle('is-done');
        var ck = t.querySelector('.plan-task__check');
        ck.innerHTML = t.classList.contains('is-done') ? '<i class="fa-solid fa-check" style="font-size:0.55rem"></i>' : '';
      });
    });
  }

  /* ==========================================================
     MISTAKES
     ========================================================== */
  async function buildMistakes(tool) {
    var c = document.createElement('div');
    c.className = 'mistakes-widget';
    c.innerHTML = '<div class="widget-loading">Loading…</div>';
    try {
      var res = await fetch('/api/tools/mistakes', { credentials: 'include' });
      if (!res.ok) { c.innerHTML = '<div class="widget-error">Could not load.</div>'; return c; }
      var data = await res.json();
      var groups = data.groups || [];
      if (!groups.length) {
        c.innerHTML = '<div class="mistakes-widget__head"><div class="mistakes-widget__icon"><i class="fa-solid fa-clipboard-list"></i></div><div><div class="mistakes-widget__title">Mistake Bank</div><div class="mistakes-widget__meta">No mistakes yet</div></div></div>';
        return c;
      }
      var total = groups.reduce(function (s, g) { return s + g.questions.length; }, 0);
      c.innerHTML =
        '<div class="mistakes-widget__head"><div class="mistakes-widget__icon"><i class="fa-solid fa-clipboard-list"></i></div>' +
        '<div><div class="mistakes-widget__title">Mistake Bank</div>' +
        '<div class="mistakes-widget__meta">' + groups.length + ' topics · ' + total + ' questions</div></div></div>' +
        '<div class="mistakes-widget__body">' +
          groups.map(function (g, gi) {
            return '<div class="mistakes-topic' + (gi===0?' is-open':'') + '">' +
              '<div class="mistakes-topic__head"><div class="mistakes-topic__count">' + g.questions.length + '</div>' +
              '<div class="mistakes-topic__body"><div class="mistakes-topic__name">' + esc(g.topic||'Uncategorized') + '</div>' +
              '<div class="mistakes-topic__sub">' + g.questions.length + ' missed</div></div>' +
              '<i class="fa-solid fa-chevron-down mistakes-topic__arrow"></i></div>' +
              '<div class="mistakes-topic__questions">' +
                g.questions.slice(0, 5).map(function (q) {
                  return '<div class="mistakes-q"><p class="mistakes-q__text">' + esc(q.question) + '</p>' +
                    '<div class="mistakes-q__row"><span class="mistakes-q__label">Correct</span><span class="mistakes-q__right">' + esc(q.correct) + '</span></div></div>';
                }).join('') +
              '</div></div>';
          }).join('') +
        '</div>';
      c.querySelectorAll('.mistakes-topic__head').forEach(function (h) {
        h.addEventListener('click', function () { h.parentElement.classList.toggle('is-open'); });
      });
    } catch (_) { c.innerHTML = '<div class="widget-error">Network error.</div>'; }
    return c;
  }

  /* ==========================================================
     NOTE
     ========================================================== */
  function buildNote(tool) {
    var c = document.createElement('div');
    c.className = 'note-widget';
    c.innerHTML =
      '<div class="note-widget__head"><div class="note-widget__icon"><i class="fa-solid fa-note-sticky"></i></div>' +
      '<div><div class="note-widget__title">Save as note</div>' +
      '<div class="note-widget__meta">' + esc(tool.topic || 'general') + '</div></div></div>' +
      '<div class="note-widget__body">' +
        '<input type="text" class="note-widget__input" data-role="title" placeholder="Title" style="min-height:0">' +
        '<textarea class="note-widget__input" data-role="body" placeholder="Write your note…"></textarea>' +
        '<div class="note-widget__actions">' +
          '<button type="button" class="btn btn-ghost" data-role="cancel">Cancel</button>' +
          '<button type="button" class="btn btn-primary" data-role="save">Save note</button>' +
        '</div>' +
      '</div>';
    var title = c.querySelector('[data-role="title"]');
    var body = c.querySelector('[data-role="body"]');
    if (tool.topic && tool.topic !== 'general knowledge') title.value = tool.topic;
    c.querySelector('[data-role="cancel"]').addEventListener('click', function () { c.remove(); });
    c.querySelector('[data-role="save"]').addEventListener('click', async function () {
      if (!body.value.trim()) { alert('Write something first.'); return; }
      try {
        await fetch('/api/tools/notes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ title: title.value.trim() || 'Note', content: body.value, subject: tool.topic || null })
        });
        c.innerHTML = '<div class="note-widget__head"><div class="note-widget__icon"><i class="fa-solid fa-check"></i></div><div><div class="note-widget__title">Saved</div></div></div>';
      } catch (_) { alert('Network error'); }
    });
    return c;
  }

  /* ==========================================================
     MAIN RENDERER
     ========================================================== */
  function renderOne(tool) {
    switch (tool.type) {
      case 'quiz':          return buildQuiz(tool);
      case 'flashcards':    return buildFlashcards(tool);
      case 'theory':        return buildTheory(tool);
      case 'practice':      return buildPractice(tool);
      case 'visualization': return buildVisualization(tool);
      case 'studyplan':     return buildStudyPlan(tool);
      case 'exam':          return buildExam(tool);
      case 'mistakes':      return buildMistakes(tool);
      case 'notes':         return buildNote(tool);
      case 'sketch':        return buildSketch(tool);
      default:              return null;
    }
  }

  // Attach to window
  root.DMWidgets = {
    render: function (media, container) {
      if (!media || !media.tools || !media.tools.length) return;
      media.tools.forEach(function (tool) {
        var result = renderOne(tool);
        if (!result) return;
        if (result && typeof result.then === 'function') {
          result.then(function (el) { if (el) container.appendChild(el); });
        } else {
          container.appendChild(result);
        }
      });
    }
  };

})(window);
