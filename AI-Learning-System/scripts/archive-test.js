// scripts/archive-test.js
// Complete test to verify Internet Archive credentials.

const path = require('path');
const fs = require('fs');

/* ------------------------------------------------------------
   Load .env manually from the project root.
   ------------------------------------------------------------ */
function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    let key = match[1];
    let value = match[2];

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const accessKey = process.env.ARCHIVE_ACCESS_KEY;
const secretKey = process.env.ARCHIVE_SECRET_KEY;

if (!accessKey || !secretKey) {
  console.error('ERROR: Missing Internet Archive environment variables.');
  console.error('Please make sure your .env file contains:');
  console.error('ARCHIVE_ACCESS_KEY=...');
  console.error('ARCHIVE_SECRET_KEY=...');
  process.exit(1);
}

async function main() {
  const timestamp = Date.now();
  const identifier = 'tcsss-test-' + timestamp;
  const filename = 'connection-test.txt';
  const content = 'TCSSS Internet Archive connection test at ' + new Date().toISOString();

  const url = 'https://s3.us.archive.org/' + identifier + '/' + filename;

  console.log('Testing Internet Archive upload...');
  console.log('Item identifier:', identifier);
  console.log('');

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': 'LOW ' + accessKey + ':' + secretKey,
      'Content-Type': 'text/plain',
      'x-archive-auto-make-bucket': '1',
      'x-archive-meta-title': 'TCSSS Connection Test',
      'x-archive-meta-collection': 'opensource',
      'x-archive-meta-mediatype': 'texts',
      'x-archive-meta-subject': 'test; connection; tcsss',
      'x-archive-meta-description': 'Automated connection test from TCSSS AI Learning Platform',
    },
    body: content,
  });

  if (response.ok) {
    console.log('SUCCESS: File uploaded to Internet Archive!');
    console.log('');
    console.log('Item page:');
    console.log('  https://archive.org/details/' + identifier);
    console.log('');
    console.log('Direct file URL:');
    console.log('  https://archive.org/download/' + identifier + '/' + filename);
    console.log('');
    console.log('Your API keys are working correctly.');
  } else {
    const text = await response.text();
    console.error('FAILED: Upload failed with status', response.status);
    console.error('');
    console.error('Response:', text);
    process.exit(1);
  }
}

main().catch(function (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
});