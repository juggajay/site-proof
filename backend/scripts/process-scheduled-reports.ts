import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'
import { processDueScheduledReports } from '../src/lib/scheduledReports.js'

function parseLimitArg(): number | undefined {
  const rawLimit = process.argv
    .find(argument => argument.startsWith('--limit='))
    ?.slice('--limit='.length)

  if (!rawLimit) {
    return undefined
  }

  const limit = Number(rawLimit)
  return Number.isInteger(limit) && limit > 0 ? limit : undefined
}

try {
  const result = await processDueScheduledReports({ limit: parseLimitArg() })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.failed > 0 ? 1 : 0
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
