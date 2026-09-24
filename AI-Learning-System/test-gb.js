require('dotenv').config();
const gb = require('./backend/src/library/googlebooks');

(async () => {
  const r = await gb.search('science', { limit: 5 });
  console.log('search ok:', r.ok);
  console.log('books found:', (r.books || []).length);

  if (!r.books || r.books.length === 0) {
    console.log('No books to download.');
    return;
  }

  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const tmp = path.join(os.tmpdir(), 'gb-test.pdf');

  for (let i = 0; i < Math.min(2, r.books.length); i++) {
    const b = r.books[i];
    console.log('Trying:', b.title.slice(0, 60));
    try {
      await gb.downloadPdf(b.pdf_url, tmp);
      console.log('  OK —', fs.statSync(tmp).size, 'bytes');
      fs.unlinkSync(tmp);
    } catch (e) {
      console.log('  FAILED —', e.message);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
})().catch(e => console.error('FATAL:', e.message));
