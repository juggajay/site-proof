import 'dotenv/config'
import { processDueNotificationDigests } from '../src/lib/notificationJobs.js'
import { prisma } from '../src/lib/prisma.js'

function readArg(name: string): string | undefined {
  return process.argv
    .find(argument => argument.startsWith(`--${name}=`))
    ?.slice(name.length + 3)
}

function parsePositiveIntegerArg(name: string): number | undefined {
  const rawValue = readArg(name)
  if (!rawValue) {
    return undefined
  }

  const value = Number(rawValue)
  return Number.isInteger(value) && value > 0 ? value : undefined
}

try {
  const result = await processDueNotificationDigests({
    limit: parsePositiveIntegerArg('limit'),
    timeOfDay: readArg('time'),
  })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = result.failed > 0 ? 1 : 0
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
