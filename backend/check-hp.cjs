const Database = require('better-sqlite3');
const db = new Database('siteproof.db');
const holdpoints = db.prepare('SELECT hp.id, hp.name, hp.status, hp.lot_id, hp.project_id, p.name as project_name FROM hold_points hp LEFT JOIN projects p ON hp.project_id = p.id LIMIT 20').all();
console.log(JSON.stringify(holdpoints, null, 2));
