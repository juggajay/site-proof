// Wave F / F2 — the Xero CSV export reads its account code and GST rate name
// from the COMPANY that owns the claim's project, never from a query parameter
// and never from one user's browser.
//
// DB-backed on purpose: the whole point of the change is which row the value is
// read from, and the tenant-isolation assertion (company A's setting can never
// reach company B's export) is only meaningful against real rows and the real
// `claim -> project -> company` join. The pure mapping is covered by
// `xeroExport.test.ts`. Spec: docs/plans/wave-f-claim-readiness-spec-2026-07-31.md §5 F2.

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { prisma } from '../../lib/prisma.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { registerTestUser } from '../../test/routeTestHarness.js';
import { authRouter } from '../auth.js';
import claimsRouter from '../claims.js';
import { XERO_INVOICE_CSV_HEADER } from './xeroExport.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/projects', claimsRouter);
app.use(errorHandler);

const tag = `xero-export-${Date.now()}`;
const col = (name: string) => (XERO_INVOICE_CSV_HEADER as readonly string[]).indexOf(name);

interface Tenant {
  companyId: string;
  userId: string;
  token: string;
  projectId: string;
  claimId: string;
}

/**
 * One company + one commercial user + one project + one submitted claim with a
 * single claimed lot. `projectNumber` is caller-supplied so the two-same-named-
 * projects case can be built without duplicating the whole bootstrap.
 */
async function createTenant(label: string, projectName: string, projectNumber: string) {
  const company = await prisma.company.create({ data: { name: `Co ${tag} ${label}` } });
  const user = await registerTestUser(app, {
    emailPrefix: `xero-export-${label}`,
    fullName: `Xero Export ${label}`,
    companyId: company.id,
    roleInCompany: 'project_manager',
  });
  const project = await prisma.project.create({
    data: {
      name: projectName,
      projectNumber,
      companyId: company.id,
      status: 'active',
      state: 'NSW',
      specificationSet: 'TfNSW',
    },
  });
  await prisma.projectUser.create({
    data: {
      projectId: project.id,
      userId: user.userId,
      role: 'project_manager',
      status: 'active',
    },
  });
  const lot = await prisma.lot.create({
    data: {
      projectId: project.id,
      lotNumber: `${tag}-${label}-LOT`,
      status: 'conformed',
      lotType: 'chainage',
      activityType: 'Earthworks',
      budgetAmount: 1000,
    },
  });
  const claim = await prisma.progressClaim.create({
    data: {
      projectId: project.id,
      claimNumber: 1,
      claimPeriodStart: new Date('2026-06-01T00:00:00.000Z'),
      claimPeriodEnd: new Date('2026-06-30T00:00:00.000Z'),
      status: 'submitted',
      totalClaimedAmount: 500,
      claimedLots: {
        create: [{ lotId: lot.id, amountClaimed: 500, percentageComplete: 50 }],
      },
    },
  });

  return {
    companyId: company.id,
    userId: user.userId,
    token: user.token,
    projectId: project.id,
    claimId: claim.id,
  } satisfies Tenant;
}

async function destroyTenant(tenant: Tenant) {
  await prisma.claimedLot.deleteMany({ where: { claim: { projectId: tenant.projectId } } });
  await prisma.progressClaim.deleteMany({ where: { projectId: tenant.projectId } });
  await prisma.lot.deleteMany({ where: { projectId: tenant.projectId } });
  await prisma.projectUser.deleteMany({ where: { projectId: tenant.projectId } });
  await prisma.auditLog.deleteMany({ where: { projectId: tenant.projectId } });
  await prisma.project.delete({ where: { id: tenant.projectId } }).catch(() => {});
  await prisma.emailVerificationToken.deleteMany({ where: { userId: tenant.userId } });
  await prisma.user.delete({ where: { id: tenant.userId } }).catch(() => {});
  await prisma.company.delete({ where: { id: tenant.companyId } }).catch(() => {});
}

function exportClaim(tenant: Tenant, query = '') {
  return request(app)
    .get(`/api/projects/${tenant.projectId}/claims/${tenant.claimId}/xero-export${query}`)
    .set('Authorization', `Bearer ${tenant.token}`);
}

let alpha: Tenant;
let bravo: Tenant;
let twin: Tenant;

beforeAll(async () => {
  alpha = await createTenant('alpha', `Alpha ${tag}`, `P-${tag}-A`);
  bravo = await createTenant('bravo', `Bravo ${tag}`, `P-${tag}-B`);
  // Same project NAME as alpha, different projectNumber — FR-B8.
  twin = await createTenant('twin', `Alpha ${tag}`, `P-${tag}-TWIN`);
}, 60_000);

afterAll(async () => {
  await destroyTenant(alpha);
  await destroyTenant(bravo);
  await destroyTenant(twin);
});

describe('GET /:projectId/claims/:claimId/xero-export — company-scoped config', () => {
  it('falls back to the export defaults when the company has configured nothing', async () => {
    await prisma.company.update({
      where: { id: alpha.companyId },
      data: { xeroAccountCode: null, xeroTaxType: null },
    });

    const res = await exportClaim(alpha);

    expect(res.status).toBe(200);
    expect(res.body.rows[0]).toEqual([...XERO_INVOICE_CSV_HEADER]);
    expect(res.body.rows[1][col('*AccountCode')]).toBe('200');
    expect(res.body.rows[1][col('*TaxType')]).toBe('GST on Income');
  });

  it("uses the claim's own company settings", async () => {
    await prisma.company.update({
      where: { id: alpha.companyId },
      data: { xeroAccountCode: '260', xeroTaxType: 'GST Free Income' },
    });

    const res = await exportClaim(alpha);

    expect(res.status).toBe(200);
    expect(res.body.rows[1][col('*AccountCode')]).toBe('260');
    expect(res.body.rows[1][col('*TaxType')]).toBe('GST Free Income');
  });

  it("never lets one company's settings reach another company's export", async () => {
    await prisma.company.update({
      where: { id: alpha.companyId },
      data: { xeroAccountCode: '260', xeroTaxType: 'GST Free Income' },
    });
    await prisma.company.update({
      where: { id: bravo.companyId },
      data: { xeroAccountCode: '910', xeroTaxType: 'BAS Excluded' },
    });

    const res = await exportClaim(bravo);

    expect(res.status).toBe(200);
    expect(res.body.rows[1][col('*AccountCode')]).toBe('910');
    expect(res.body.rows[1][col('*TaxType')]).toBe('BAS Excluded');
  });

  it('ignores an accountCode / taxType supplied as a query parameter', async () => {
    await prisma.company.update({
      where: { id: bravo.companyId },
      data: { xeroAccountCode: '910', xeroTaxType: 'BAS Excluded' },
    });

    const res = await exportClaim(bravo, '?accountCode=666&taxType=Nonsense%20Rate');

    expect(res.status).toBe(200);
    expect(res.body.rows[1][col('*AccountCode')]).toBe('910');
    expect(res.body.rows[1][col('*TaxType')]).toBe('BAS Excluded');
  });

  // FR-B8 — Project.name is not unique; @@unique([companyId, projectNumber]) is.
  it('gives two same-named projects distinct invoice numbers', async () => {
    const [first, second] = await Promise.all([exportClaim(alpha), exportClaim(twin)]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.rows[1][col('*InvoiceNumber')]).toBe(`Claim 1 — P-${tag}-A`);
    expect(second.body.rows[1][col('*InvoiceNumber')]).toBe(`Claim 1 — P-${tag}-TWIN`);
    expect(first.body.rows[1][col('*InvoiceNumber')]).not.toBe(
      second.body.rows[1][col('*InvoiceNumber')],
    );
  });

  // D8 — F2 does not touch the due date. The caller still owns it.
  it('still passes the caller-supplied due date straight through', async () => {
    const res = await exportClaim(alpha, '?dueDate=2026-07-21');

    expect(res.status).toBe(200);
    expect(res.body.rows[1][col('*DueDate')]).toBe('2026-07-21');
  });
});
