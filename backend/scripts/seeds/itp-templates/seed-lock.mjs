const ITP_TEMPLATE_SEED_LOCK_ID = 731_452_019;

export async function withItpTemplateSeedLock(prisma, callback) {
  return prisma.$transaction(
    async (tx) => {
      // pg_advisory_xact_lock() returns void; use $executeRaw (returns a row
      // count) because Prisma 6's $queryRaw cannot deserialize a void column.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ITP_TEMPLATE_SEED_LOCK_ID})`;
      return callback();
    },
    {
      maxWait: 60_000,
      timeout: 30 * 60_000,
    },
  );
}
