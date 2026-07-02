import { describe, expect, it } from 'vitest';

import {
  XERO_INVOICE_CSV_HEADER,
  buildXeroInvoiceExport,
  type XeroClaimExportInput,
} from './xeroExport.js';

const H = XERO_INVOICE_CSV_HEADER as readonly string[];
const col = (name: string) => H.indexOf(name);

const base: XeroClaimExportInput = {
  claimNumber: 5,
  projectName: 'Northern Interchange',
  clientName: 'Acme Civil Pty Ltd',
  periodEnd: '2026-06-30T00:00:00.000Z',
  totalClaimedAmount: 61500,
  lots: [
    {
      lotNumber: '12',
      activityType: 'Bulk Earthworks',
      amountClaimed: 40000,
      thisClaimPercent: 40,
      cumulativePercent: 100,
    },
    {
      lotNumber: '18',
      activityType: 'Drainage Ch0-200',
      amountClaimed: 12500,
      thisClaimPercent: 25,
      cumulativePercent: 25,
    },
    {
      lotNumber: '23',
      activityType: 'Kerb & Channel',
      amountClaimed: 9000,
      thisClaimPercent: 60,
      cumulativePercent: 85,
    },
  ],
};
const config = { accountCode: '200' };

describe('buildXeroInvoiceExport', () => {
  it('emits one data row per lot plus a header row', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows).toHaveLength(1 + 3);
    expect(rows[0]).toEqual([...XERO_INVOICE_CSV_HEADER]);
  });

  it('writes the cumulative-aware description per lot', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows.map((r) => r[col('*Description')])).toContain(
      'Lot 18 — Drainage Ch0-200 — this claim 25% (cumulative 25%)',
    );
  });

  it('maps ex-GST amount to UnitAmount, quantity 1, account code from config', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    const row18 = rows.find((r) => String(r[col('*Description')]).includes('Lot 18'))!;
    expect(row18[col('*UnitAmount')]).toBe(12500);
    expect(row18[col('*Quantity')]).toBe(1);
    expect(row18[col('*AccountCode')]).toBe('200');
  });

  it('sets invoice number from claim + project and date as DD/MM/YYYY periodEnd', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*InvoiceNumber')]).toBe('Claim 5 — Northern Interchange');
    expect(rows[1][col('*InvoiceDate')]).toBe('30/06/2026');
    expect(rows[1][col('*DueDate')]).toBe('30/06/2026');
  });

  it('uses clientName as contact, falling back to project name when blank', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*ContactName')]).toBe('Acme Civil Pty Ltd');
    const noClient = buildXeroInvoiceExport({ ...base, clientName: null }, config);
    expect(noClient.rows[1][col('*ContactName')]).toBe('Northern Interchange');
  });

  it('leaves TaxType blank by default (Xero applies the account default rate)', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*TaxType')]).toBe('');
    const withTax = buildXeroInvoiceExport(base, { accountCode: '200', taxType: 'GST on Income' });
    expect(withTax.rows[1][col('*TaxType')]).toBe('GST on Income');
  });

  it('blocks export when line total does not match claim total', () => {
    expect(() =>
      buildXeroInvoiceExport({ ...base, totalClaimedAmount: 99999 }, config),
    ).toThrowError(/does not match/i);
  });

  it('reconciles cent-level rounding without false-blocking', () => {
    const rounding: XeroClaimExportInput = {
      ...base,
      totalClaimedAmount: 33.33,
      lots: [
        {
          lotNumber: 'L1',
          activityType: 'A',
          amountClaimed: 11.11,
          thisClaimPercent: 10,
          cumulativePercent: 10,
        },
        {
          lotNumber: 'L2',
          activityType: 'B',
          amountClaimed: 22.22,
          thisClaimPercent: 20,
          cumulativePercent: 20,
        },
      ],
    };
    expect(() => buildXeroInvoiceExport(rounding, config)).not.toThrow();
  });

  it('blocks export when there are no claimed lots', () => {
    expect(() =>
      buildXeroInvoiceExport({ ...base, lots: [], totalClaimedAmount: 0 }, config),
    ).toThrowError(/no claimed lots/i);
  });

  it('never adds GST — the line total equals the ex-GST claim total', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    const sum = rows.slice(1).reduce((s, r) => s + Number(r[col('*UnitAmount')]), 0);
    expect(sum).toBe(61500);
  });

  it('formats fractional percentages without trailing noise', () => {
    const frac = buildXeroInvoiceExport(
      {
        ...base,
        totalClaimedAmount: 100,
        lots: [
          {
            lotNumber: 'L1',
            activityType: 'A',
            amountClaimed: 100,
            thisClaimPercent: 12.5,
            cumulativePercent: 37.5,
          },
        ],
      },
      config,
    );
    expect(frac.rows[1][col('*Description')]).toBe(
      'Lot L1 — A — this claim 12.5% (cumulative 37.5%)',
    );
  });
});
