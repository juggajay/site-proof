const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

const lots = db.prepare("SELECT id, lotNumber, status, projectId FROM Lot WHERE status = 'conformed' LIMIT 5").all();
console.log('Conformed lots:');
lots.forEach(l => console.log(l.lotNumber, l.status, l.id, l.projectId));

if (lots.length === 0) {
  console.log('\nNo conformed lots found. Checking for claimed lots...');
  const claimedLots = db.prepare("SELECT id, lotNumber, status, projectId FROM Lot WHERE status = 'claimed' LIMIT 5").all();
  console.log('Claimed lots:');
  claimedLots.forEach(l => console.log(l.lotNumber, l.status, l.id, l.projectId));
}

// Also list all statuses
const statuses = db.prepare("SELECT status, COUNT(*) as cnt FROM Lot GROUP BY status").all();
console.log('\nLot status counts:');
statuses.forEach(s => console.log(s.status, ':', s.cnt));

db.close();
