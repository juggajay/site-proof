import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '../dev.db'));
const row = db.prepare("SELECT id FROM User WHERE email='admin@test.com'").get();
const token = jwt.sign({ userId: row.id }, 'dev-secret-key-change-in-production', { expiresIn: '24h' });

// Simulate another user editing the lot
fetch('http://localhost:4006/api/lots/5ad22216-dc13-44ea-aab6-cf27f5072f10', {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    description: 'Modified by another session - concurrent edit test at ' + new Date().toISOString()
  })
})
.then(res => res.json())
.then(data => {
  console.log('Lot updated to simulate concurrent edit:');
  console.log(JSON.stringify(data, null, 2));
  db.close();
})
.catch(err => {
  console.error('Error:', err);
  db.close();
});
