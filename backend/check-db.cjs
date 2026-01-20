const Database = require('better-sqlite3');
const db = new Database('./prisma/dev.db');

// List projects
console.log('=== Projects ===');
const projects = db.prepare('SELECT id, name FROM Project LIMIT 10').all();
console.log(projects);

// List users
console.log('\n=== Users ===');
const users = db.prepare('SELECT id, email, fullName FROM User LIMIT 10').all();
console.log(users);

// List project users
console.log('\n=== Project Users ===');
const projectUsers = db.prepare(`
  SELECT pu.id, pu.projectId, pu.userId, pu.role, p.name as projectName, u.email
  FROM ProjectUser pu
  JOIN Project p ON pu.projectId = p.id
  JOIN User u ON pu.userId = u.id
  LIMIT 20
`).all();
console.log(projectUsers);

db.close();
