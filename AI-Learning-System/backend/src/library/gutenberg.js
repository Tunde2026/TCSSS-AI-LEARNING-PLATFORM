// ============================================================
// library/gutenberg.js
// ------------------------------------------------------------
// Fetch public-domain books from Project Gutenberg via the
// Gutendex API (https://gutendex.com).
// Every item here is legally public domain.
// ============================================================

const fs = require('fs');
const path = require('path');

const GUTENDEX = 'https://gutendex.com/books';

async function search(query, { limit = 25 } = {}) {
  const url = GUTENDEX +
    '?search=' + encodeURIComponent(query) +
    '&languages=en' +
    '&mime_type=application/epub%2Bzip';

  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    return { ok: false, code: 'NETWORK_ERROR' };
  }
  if (!res.ok) return { ok: false, code: 'HTTP_' + res.status };

  const data = await res.json();
  const results = (data.results || []).slice(0, limit);

  return {
    ok: true,
    books: results.map(b => {
      const formats = b.formats || {};
      const epubUrl = formats['application/epub+zip'];
      const cover = formats['image/jpeg'];
      const author = (b.authors && b.authors[0] && b.authors[0].name) || 'Unknown';
      return {
        external_id: 'gutenberg-' + b.id,
        title: b.title,
        author,
        epub_url: epubUrl,
        cover_url: cover,
        external_url: 'https://www.gutenberg.org/ebooks/' + b.id,
      };
    }).filter(b => !!b.epub_url),
  };
}

async function downloadEpub(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
  return true;
}

module.exports = { search, downloadEpub };