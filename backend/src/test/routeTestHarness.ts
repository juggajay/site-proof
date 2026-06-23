import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Shared bootstrap helpers for backend route integration tests.
 *
 * These collapse the ~23-line "create a registered user (and optionally assign
 * a company + role)" block that was copy-pasted across ~17 `src/routes/*.test.ts`
 * suites — both inline in `beforeAll` and as per-file `registerXUser` helpers.
 *
 * IMPORTANT — vitest hoisting: this module contains NO `vi.mock(...)` calls.
 * vitest hoists `vi.mock` to the top of each test file at transform time, so
 * mock declarations can never live in an imported helper. The duplicated
 * bootstrap block extracted here is plain runtime code (a supertest request
 * plus a Prisma write), so it is safe to import. Files that mock modules (e.g.
 * `../lib/supabase.js` in comments/documents/drawings) keep their `vi.mock`
 * lines exactly where they were.
 *
 * Behaviour is preserved 1:1 with the original inline blocks:
 *  - same `/api/auth/register` payload shape (`email`, `password`, `fullName`,
 *    `tosAccepted: true`);
 *  - same default password literal;
 *  - the optional `prisma.user.update({ data: { companyId, roleInCompany } })`
 *    runs only when a role assignment is requested, matching each original
 *    call site;
 *  - the generated email is unique per call (no test asserts the literal email;
 *    callers that re-use or assert the address pass an explicit `email`).
 */

/** The password literal every route test registered users with. */
export const TEST_USER_PASSWORD = 'SecureP@ssword123!';

export interface RegisterTestUserOptions {
  /**
   * Explicit email address. Use this when a test re-uses the address later
   * (e.g. to log in again) or asserts on it. When omitted, a unique address is
   * generated from `emailPrefix` (or a slug of `fullName`).
   */
  email?: string;
  /** Prefix for the generated unique email (ignored when `email` is set). */
  emailPrefix?: string;
  /** Full name sent in the registration payload. */
  fullName: string;
  /** Registration password. Defaults to {@link TEST_USER_PASSWORD}. */
  password?: string;
  /**
   * When provided (including explicit `null`), the freshly registered user is
   * updated with this `companyId` and `roleInCompany`. Pair with
   * `roleInCompany`. Leave both undefined to register without any role update
   * (matching the suites whose register helper did not assign a role).
   */
  companyId?: string | null;
  /** Company role to assign. See `companyId` for when the update runs. */
  roleInCompany?: string;
}

export interface RegisteredTestUser {
  token: string;
  userId: string;
  email: string;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-');
}

function uniqueEmail(prefix: string): string {
  // randomUUID (not Math.random): the production-readiness guard
  // "backend runtime identifiers avoid Math.random" scans every non-*.test.ts
  // file under backend/src/, and this helper is runtime-shaped enough to
  // deserve the stronger source anyway.
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@example.com`;
}

/**
 * Register a user via `POST /api/auth/register` and (optionally) assign it a
 * company role. Returns the auth token, user id, and the email used.
 *
 * The `roleInCompany` presence is what drives the optional
 * `prisma.user.update`, so callers that previously only registered (no role
 * update) simply omit it.
 */
export async function registerTestUser(
  app: Express,
  options: RegisterTestUserOptions,
): Promise<RegisteredTestUser> {
  const { fullName, roleInCompany } = options;
  const password = options.password ?? TEST_USER_PASSWORD;
  const email = options.email ?? uniqueEmail(options.emailPrefix ?? slugify(fullName));

  const res = await request(app).post('/api/auth/register').send({
    email,
    password,
    fullName,
    tosAccepted: true,
  });

  const userId = res.body.user.id as string;

  // Test users are treated as email-verified so they can exercise the
  // verification-gated happy paths (company creation, invites — M1). Tests that
  // specifically assert unverified behaviour register via the API directly.
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      ...(roleInCompany !== undefined
        ? { companyId: options.companyId ?? null, roleInCompany }
        : {}),
    },
  });

  return {
    token: res.body.token as string,
    userId,
    email,
  };
}
