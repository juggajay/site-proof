// Script to add token_invalidated_at column to users table
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Check if column exists by trying to select it
    try {
      await prisma.$queryRaw`SELECT token_invalidated_at FROM users LIMIT 1`
      console.log('Column token_invalidated_at already exists')
    } catch (e) {
      // Column doesn't exist, add it
      console.log('Adding token_invalidated_at column to users table...')
      await prisma.$executeRaw`ALTER TABLE users ADD COLUMN token_invalidated_at TEXT`
      console.log('Column added successfully!')
    }
  } catch (error) {
    console.error('Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
