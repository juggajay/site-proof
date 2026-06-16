import type { Prisma } from '@prisma/client';

type ApiKeyRevocationClient = {
  apiKey: {
    updateMany: (args: Prisma.ApiKeyUpdateManyArgs) => Promise<Prisma.BatchPayload>;
  };
};

export async function revokeActiveApiKeysForUser(client: ApiKeyRevocationClient, userId: string) {
  return client.apiKey.updateMany({
    where: {
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });
}
