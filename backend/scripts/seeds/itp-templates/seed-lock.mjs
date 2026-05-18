const ITP_TEMPLATE_SEED_LOCK_ID = 731_452_019;

export async function withItpTemplateSeedLock(prisma, callback) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${ITP_TEMPLATE_SEED_LOCK_ID})`;
      return callback();
    },
    {
      maxWait: 60_000,
      timeout: 30 * 60_000,
    },
  );
}
