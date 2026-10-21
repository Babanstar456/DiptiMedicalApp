// Prints .env lines from a Firebase service-account JSON file.
// Usage: npm run key-to-env -- path/to/serviceAccountKey.json
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run key-to-env -- path/to/serviceAccountKey.json');
  process.exit(1);
}

const key = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
if (key.type !== 'service_account' || !key.private_key || !key.client_email) {
  console.error('This does not look like a Firebase service-account key file.');
  process.exit(1);
}

console.log('# Paste this line into .env (replace any existing FIREBASE_SERVICE_ACCOUNT)');
console.log(`FIREBASE_SERVICE_ACCOUNT='${JSON.stringify(key)}'`);
