// Migration script to add OAuth columns to users table
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Adding OAuth columns to users table...');

  try {
    // Check if column exists by trying to select it
    try {
      await prisma.$queryRawUnsafe('SELECT oauth_provider FROM users LIMIT 1');
      console.log('oauth_provider column already exists');
    } catch (e) {
      // Column doesn't exist, add it
      await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN oauth_provider TEXT DEFAULT NULL');
      console.log('Added oauth_provider column');
    }

    try {
      await prisma.$queryRawUnsafe('SELECT oauth_provider_id FROM users LIMIT 1');
      console.log('oauth_provider_id column already exists');
    } catch (e) {
      // Column doesn't exist, add it
      await prisma.$executeRawUnsafe('ALTER TABLE users ADD COLUMN oauth_provider_id TEXT DEFAULT NULL');
      console.log('Added oauth_provider_id column');
    }

    console.log('Migration complete!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
