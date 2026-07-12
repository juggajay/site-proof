import { PrismaClient } from '@prisma/client';

// Prisma 6 removed the `$use` middleware API in favour of client extensions
// (`$extends`), but extensions return a *new* client while our code shares a
// single `prisma` singleton by reference. To keep query interception working on
// that shared instance (used by fault-injection / concurrency tests), we build
// the singleton with an `$allOperations` query extension that runs a mutable
// middleware chain. With no middleware registered this is a single length check
// per query — negligible for production.
type PrismaMiddlewareParams = {
  model?: string;
  action: string;
  // Matches the removed Prisma 5 `MiddlewareParams.args` (typed `any`) so
  // existing test bodies that read `params.args?.where` / `.data` compile.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any;
  dataPath: string[];
  // ponytail: query extensions expose no transaction context, so this is always
  // false. The only reader (itp.test) guards a findFirst production never issues,
  // so the value is inert. Add real tx-depth tracking only if a test needs it.
  runInTransaction: boolean;
};

type PrismaMiddlewareNext = (params: PrismaMiddlewareParams) => Promise<unknown>;

type PrismaMiddleware = (
  params: PrismaMiddlewareParams,
  next: PrismaMiddlewareNext,
) => Promise<unknown>;

const middlewares: PrismaMiddleware[] = [];

/**
 * Register a query middleware (Prisma 5 `$use` compatibility shim). Middlewares
 * run in registration order and cannot be removed — matching the old `$use`
 * semantics, where tests toggle their own `active` flag to go inert. Intended
 * for tests only.
 */
export function usePrismaMiddleware(middleware: PrismaMiddleware): void {
  middlewares.push(middleware);
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Connection pool is configured via DATABASE_URL query params:
// ?connection_limit=10&pool_timeout=30
function createPrismaClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (middlewares.length === 0) {
            return query(args);
          }
          let index = -1;
          const run: PrismaMiddlewareNext = (params) => {
            index += 1;
            const middleware = middlewares[index];
            if (middleware) {
              return middleware(params, run);
            }
            return query(params.args as typeof args);
          };
          return run({
            model,
            action: operation,
            args,
            dataPath: [],
            runInTransaction: false,
          });
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
