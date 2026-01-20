// Migration script to add OAuth columns to users table
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, '..', 'dev.db');

const db = new Database(dbPath);

console.log('Adding OAuth columns to users table...');

try {
  // Check if columns exist
  const columns = db.pragma('table_info(users)');
  const columnNames = columns.map(c => c.name);

  if (!columnNames.includes('oauth_provider')) {
    db.exec('ALTER TABLE users ADD COLUMN oauth_provider TEXT DEFAULT NULL');
    console.log('Added oauth_provider column');
  } else {
    console.log('oauth_provider column already exists');
  }

  if (!columnNames.includes('oauth_provider_id')) {
    db.exec('ALTER TABLE users ADD COLUMN oauth_provider_id TEXT DEFAULT NULL');
    console.log('Added oauth_provider_id column');
  } else {
    console.log('oauth_provider_id column already exists');
  }

  console.log('Migration complete!');
} catch (error) {
  console.error('Migration error:', error);
  process.exit(1);
} finally {
  db.close();
}
