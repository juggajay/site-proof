import 'dotenv/config'
import { processNotificationAutomation } from '../src/lib/notificationAutomation.js'
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

function parseProjectIdsArg(): string[] | undefined {
  const rawValue = readArg('projectIds')
  if (!rawValue) {
    return undefined
  }

  return rawValue
    .split(',')
    .map(projectId => projectId.trim())
    .filter(Boolean)
}

try {
  const result = await processNotificationAutomation({
    limit: parsePositiveIntegerArg('limit'),
    projectIds: parseProjectIdsArg(),
  })
  console.log(JSON.stringify(result, null, 2))
  process.exitCode = 0
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await prisma.$disconnect()
}
