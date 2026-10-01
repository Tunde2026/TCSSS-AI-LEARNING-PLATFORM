// ============================================================
// PASTE THIS ENTIRE BLOCK INTO THE BROWSER DEVTOOLS CONSOLE
// while on /messages.html with a conversation open.
// It sends each tool request to the AI and reports what came back.
// ============================================================
(async function testDmWidgets() {
  const results = [];
  const tests = [
    { name: 'Quiz',          prompt: '@ai quiz me on photosynthesis' },
    { name: 'Flashcards',    prompt: '@ai make flashcards on the water cycle' },
    { name: 'Theory',        prompt: '@ai give me theory questions on cells' },
    { name: 'Practice',      prompt: '@ai practice questions on quadratic equations' },
    { name: 'Visualization', prompt: '@ai draw the water cycle' },
    { name: 'Sketch',        prompt: '@ai write H2SO4' },
    { name: 'Photo search',  prompt: '@ai show me photos of fog' },
    { name: 'Image gen',     prompt: '@ai generate an image of a plant cell' },
    { name: 'Mistakes',      prompt: '@ai show me my mistakes' },
  ];

  const convId = window.currentConversationId ||
                 (document.querySelector('[data-msg-id]') &&
                  document.querySelector('[data-msg-id]').closest('.dm-main') &&
                  (new URLSearchParams(location.search).get('id')));

  // Find the current conversation id from the DOM
  const activeConv = document.querySelector('.dm-item.is-active');
  const cid = activeConv ? activeConv.getAttribute('data-id') : null;

  if (!cid) {
    console.error('❌ Open a conversation first (click any chat)');
    return;
  }

  console.log('%c📋 Testing ' + tests.length + ' widget types in conversation ' + cid, 'color:#C9952E;font-weight:bold;font-size:14px');
  console.log('');

  for (const t of tests) {
    process.stdout && process.stdout.write('  ' + t.name + '… ');

    try {
      const res = await fetch('/api/dm/' + cid + '/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body: t.prompt }),
      });
      const data = await res.json();

      const hasAi = data.aiMessage;
      const hasMedia = hasAi && hasAi.media && hasAi.media.tools && hasAi.media.tools.length;

      if (hasMedia) {
        const types = hasAi.media.tools.map(x => x.type).join(',');
        results.push({ name: t.name, ok: true, tool: types, text: (hasAi.body || '').slice(0, 80) });
        console.log('%c✓ ' + t.name + '  →  ' + types, 'color:#2F8F4A;font-weight:bold');
      } else {
        results.push({ name: t.name, ok: false, tool: 'none', text: (hasAi && hasAi.body || '').slice(0, 120) });
        console.log('%c✗ ' + t.name + '  →  no tools returned', 'color:#B80F1A;font-weight:bold');
      }
    } catch (err) {
      results.push({ name: t.name, ok: false, tool: 'error', text: err.message });
      console.log('%c✗ ' + t.name + '  →  ' + err.message, 'color:#B80F1A;font-weight:bold');
    }

    // Short pause between requests to stay under rate limits
    await new Promise(r => setTimeout(r, 800));
  }

  console.log('');
  console.log('%c📊 SUMMARY', 'color:#11104A;font-weight:bold;font-size:14px');
  console.log('');
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok);

  results.forEach(r => {
    const icon = r.ok ? '✅' : '❌';
    console.log(icon + ' ' + r.name.padEnd(16) + ' → ' + r.tool + '  ' + (r.ok ? '' : '"' + r.text + '"'));
  });

  console.log('');
  console.log('%c' + passed + ' / ' + results.length + ' passed',
    'color:' + (passed === results.length ? '#2F8F4A' : '#B80F1A') + ';font-weight:bold;font-size:13px');
  console.log('');
  console.log('💡 Now scroll up in the chat to see the inline widgets rendered.');

  window.__widgetTestResults = results;
})();