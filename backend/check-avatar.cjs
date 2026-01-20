const Database = require('better-sqlite3');
const db = new Database('siteproof.db');
const user = db.prepare('SELECT id, email, avatar_url FROM users WHERE email = ?').get('admin@test.com');
console.log(JSON.stringify(user, null, 2));
