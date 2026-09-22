// scripts/cloudinary-test.js
// Small safe test to verify Cloudinary credentials without touching the app.

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

/* ------------------------------------------------------------
   Load .env manually from the project root.
   This avoids depending on dotenv for the test script.
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

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  console.error('ERROR: Missing Cloudinary environment variables.');
  console.error('Please make sure your .env file contains:');
  console.error('CLOUDINARY_CLOUD_NAME=...');
  console.error('CLOUDINARY_API_KEY=...');
  console.error('CLOUDINARY_API_SECRET=...');
  process.exit(1);
}

async function main() {
  const timestamp = Math.floor(Date.now() / 1000);

  // Cloudinary signature:
  // sha1(timestamp=TIMESTAMP + API_SECRET)
  const stringToSign = 'timestamp=' + timestamp;
  const signature = crypto
    .createHash('sha1')
    .update(stringToSign + apiSecret)
    .digest('hex');

  const url = 'https://api.cloudinary.com/v1_1/' + cloudName + '/raw/upload';

  const formData = new FormData();

  const testText =
    'TCSSS Cloudinary connection test at ' + new Date().toISOString();

  const fileBlob = new Blob([Buffer.from(testText, 'utf8')], {
    type: 'text/plain',
  });

  formData.append('file', fileBlob, 'tcsss-cloudinary-test.txt');
  formData.append('api_key', apiKey);
  formData.append('timestamp', String(timestamp));
  formData.append('signature', signature);

  console.log('Testing Cloudinary upload...');

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(function () {
    return {};
  });

  if (!res.ok) {
    console.error('Cloudinary upload failed.');
    console.error('Status:', res.status);
    console.error('Response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log('SUCCESS: Cloudinary connection is working.');
  console.log('secure_url:', data.secure_url);
  console.log('public_id:', data.public_id);
}

main().catch(function (err) {
  console.error('Unexpected error:', err);
  process.exit(1);
});