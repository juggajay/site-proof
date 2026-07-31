import { describe, expect, it } from 'vitest';

import {
  XERO_DEFAULT_ACCOUNT_CODE,
  XERO_DEFAULT_TAX_TYPE,
  XERO_INVOICE_CSV_HEADER,
  buildXeroInvoiceExport,
  resolveXeroExportConfig,
  type XeroClaimExportInput,
} from './xeroExport.js';

const H = XERO_INVOICE_CSV_HEADER as readonly string[];
const col = (name: string) => H.indexOf(name);

const base: XeroClaimExportInput = {
  claimNumber: 5,
  projectName: 'Northern Interchange',
  projectNumber: 'PRJ-0042',
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
  variations: [],
};
const config = { accountCode: '200' };

describe('buildXeroInvoiceExport', () => {
  // F2 exit gate (a) — characterization. This pins the MAPPING: every cell of
  // every row for a company on the defaults, with the due date supplied by the
  // caller exactly as the frontend supplies it today. It deliberately does NOT
  // pin the due date's PROVENANCE — whether a CIVOS-derived SOPA date belongs
  // on an accounting document at all is decision D8 and is untouched by F2.
  // A change to any cell here is a change a customer sees in their ledger.
  it('produces the frozen CSV for a company on the defaults (characterization)', () => {
    const { filename, rows } = buildXeroInvoiceExport(
      {
        ...base,
        totalClaimedAmount: 63750,
        variations: [
          {
            variationNumber: 'VAR-0007',
            title: 'Additional rock excavation',
            approvedAmount: 2250,
          },
        ],
      },
      // What the route now builds from a company with no stored settings.
      resolveXeroExportConfig(null, { dueDate: '2026-07-21' }),
    );

    expect(filename).toBe('xero-claim-5.csv');
    expect(rows).toEqual([
      [
        '*ContactName',
        '*InvoiceNumber',
        '*InvoiceDate',
        '*DueDate',
        '*Description',
        '*Quantity',
        '*UnitAmount',
        '*AccountCode',
        '*TaxType',
      ],
      [
        'Acme Civil Pty Ltd',
        'Claim 5 — PRJ-0042',
        '2026-06-30',
        '2026-07-21',
        'Lot 12 — Bulk Earthworks — this claim 40% (cumulative 100%)',
        1,
        40000,
        '200',
        'GST on Income',
      ],
      [
        'Acme Civil Pty Ltd',
        'Claim 5 — PRJ-0042',
        '2026-06-30',
        '2026-07-21',
        'Lot 18 — Drainage Ch0-200 — this claim 25% (cumulative 25%)',
        1,
        12500,
        '200',
        'GST on Income',
      ],
      [
        'Acme Civil Pty Ltd',
        'Claim 5 — PRJ-0042',
        '2026-06-30',
        '2026-07-21',
        'Lot 23 — Kerb & Channel — this claim 60% (cumulative 85%)',
        1,
        9000,
        '200',
        'GST on Income',
      ],
      [
        'Acme Civil Pty Ltd',
        'Claim 5 — PRJ-0042',
        '2026-06-30',
        '2026-07-21',
        'Variation VAR-0007 — Additional rock excavation',
        1,
        2250,
        '200',
        'GST on Income',
      ],
    ]);
  });

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

  it('sets invoice number from claim + project NUMBER and invoice date as ISO periodEnd', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*InvoiceNumber')]).toBe('Claim 5 — PRJ-0042');
    // ISO YYYY-MM-DD is locale-safe (Xero cannot misread it as US M/D/Y).
    expect(rows[1][col('*InvoiceDate')]).toBe('2026-06-30');
  });

  it('defaults DueDate to invoice date + payment terms, never equal to InvoiceDate', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    // 2026-06-30 + 30 calendar days = 2026-07-30. Never day-one overdue.
    expect(rows[1][col('*DueDate')]).toBe('2026-07-30');
    expect(rows[1][col('*DueDate')]).not.toBe(rows[1][col('*InvoiceDate')]);
  });

  it('uses an explicit due date override when provided (the SOPA-derived date)', () => {
    const { rows } = buildXeroInvoiceExport(base, {
      accountCode: '200',
      dueDate: '2026-07-21T00:00:00.000Z',
    });
    expect(rows[1][col('*DueDate')]).toBe('2026-07-21');
  });

  // M4 — the frontend owns the per-state SOPA tables and now sends the statutory
  // date as a bare `YYYY-MM-DD` calendar date rather than an instant. That is
  // the point: `formatDate` reads an instant in UTC, so the old Sydney-browser
  // local-midnight ISO (`2026-07-20T14:00:00Z`) landed the invoice a day early.
  it('accepts a bare calendar date from the SOPA calculator without shifting it', () => {
    const { rows } = buildXeroInvoiceExport(base, { accountCode: '200', dueDate: '2026-07-21' });
    expect(rows[1][col('*DueDate')]).toBe('2026-07-21');
  });

  it('honours a custom payment-terms window', () => {
    const { rows } = buildXeroInvoiceExport(base, { accountCode: '200', paymentTermsDays: 14 });
    expect(rows[1][col('*DueDate')]).toBe('2026-07-14');
  });

  it('uses clientName as contact, falling back to project name when blank', () => {
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*ContactName')]).toBe('Acme Civil Pty Ltd');
    const noClient = buildXeroInvoiceExport({ ...base, clientName: null }, config);
    expect(noClient.rows[1][col('*ContactName')]).toBe('Northern Interchange');
  });

  it('defaults TaxType to GST on Income and never emits a blank cell', () => {
    // A blank TaxType imports as *untaxed* in Xero (it does NOT inherit the
    // account default) — silent GST under-billing. So we always emit a rate name.
    const { rows } = buildXeroInvoiceExport(base, config);
    expect(rows[1][col('*TaxType')]).toBe('GST on Income');
    // A blank/whitespace override is treated as unset and falls back to default.
    const blank = buildXeroInvoiceExport(base, { accountCode: '200', taxType: '   ' });
    expect(blank.rows[1][col('*TaxType')]).toBe('GST on Income');
    const custom = buildXeroInvoiceExport(base, {
      accountCode: '200',
      taxType: 'GST Free Income',
    });
    expect(custom.rows[1][col('*TaxType')]).toBe('GST Free Income');
  });

  // FR-B8. `Project.name` has no uniqueness constraint — the only unique key on
  // the model is @@unique([companyId, projectNumber]) — so two same-named
  // projects in one company would otherwise both emit "Claim 1 — Site Works"
  // and collide on Xero's per-org invoice-number uniqueness.
  it('gives two same-named projects distinct invoice numbers', () => {
    const shared = { ...base, claimNumber: 1, projectName: 'Site Works' };
    const first = buildXeroInvoiceExport({ ...shared, projectNumber: 'PRJ-0100' }, config);
    const second = buildXeroInvoiceExport({ ...shared, projectNumber: 'PRJ-0101' }, config);

    expect(first.rows[1][col('*InvoiceNumber')]).toBe('Claim 1 — PRJ-0100');
    expect(second.rows[1][col('*InvoiceNumber')]).toBe('Claim 1 — PRJ-0101');
    expect(first.rows[1][col('*InvoiceNumber')]).not.toBe(second.rows[1][col('*InvoiceNumber')]);
  });

  it('blocks export when line total does not match claim total', () => {
    expect(() =>
      buildXeroInvoiceExport({ ...base, totalClaimedAmount: 99999 }, config),
    ).toThrowError(/does not match/i);
  });

  it('adds one invoice row per claimed variation and reconciles it into the claim total', () => {
    const { rows } = buildXeroInvoiceExport(
      {
        ...base,
        totalClaimedAmount: 63750,
        variations: [
          {
            variationNumber: 'VAR-0007',
            title: 'Additional rock excavation',
            approvedAmount: 2250,
          },
        ],
      },
      config,
    );

    expect(rows).toHaveLength(1 + 3 + 1);
    const variationRow = rows.find((r) =>
      String(r[col('*Description')]).includes('Variation VAR-0007'),
    )!;
    expect(variationRow[col('*Description')]).toBe(
      'Variation VAR-0007 — Additional rock excavation',
    );
    expect(variationRow[col('*Quantity')]).toBe(1);
    expect(variationRow[col('*UnitAmount')]).toBe(2250);
    expect(variationRow[col('*AccountCode')]).toBe('200');
    // The variation line has to land on the SAME invoice as the lot lines —
    // Xero groups rows by *InvoiceNumber. Dropping or splitting variation rows
    // also trips the total-matches-lines invariant, because the claim total
    // includes them, which would make every claim with a variation unexportable.
    const lotRow = rows.find((r) => String(r[col('*Description')]).includes('Lot 12'))!;
    expect(variationRow[col('*InvoiceNumber')]).toBe(lotRow[col('*InvoiceNumber')]);
    expect(variationRow[col('*ContactName')]).toBe(lotRow[col('*ContactName')]);
    expect(variationRow[col('*InvoiceDate')]).toBe(lotRow[col('*InvoiceDate')]);
    expect(variationRow[col('*DueDate')]).toBe(lotRow[col('*DueDate')]);
    expect(variationRow[col('*TaxType')]).toBe(lotRow[col('*TaxType')]);
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

  it('blocks export when there are no claimed lines', () => {
    expect(() =>
      buildXeroInvoiceExport({ ...base, lots: [], variations: [], totalClaimedAmount: 0 }, config),
    ).toThrowError(/no claimed lines/i);
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

describe('resolveXeroExportConfig', () => {
  it('falls back to the export defaults when the company has set nothing', () => {
    expect(resolveXeroExportConfig({ xeroAccountCode: null, xeroTaxType: null })).toEqual({
      accountCode: XERO_DEFAULT_ACCOUNT_CODE,
      taxType: undefined,
      dueDate: undefined,
    });
    // Same for a company row that could not be loaded at all.
    expect(resolveXeroExportConfig(null).accountCode).toBe(XERO_DEFAULT_ACCOUNT_CODE);
  });

  it('uses the company values when they are set', () => {
    const config = resolveXeroExportConfig({
      xeroAccountCode: '260',
      xeroTaxType: 'GST Free Income',
    });
    expect(config.accountCode).toBe('260');
    expect(config.taxType).toBe('GST Free Income');
    expect(buildXeroInvoiceExport(base, config).rows[1]).toEqual(
      expect.arrayContaining(['260', 'GST Free Income']),
    );
  });

  it('treats a blank stored value as unset rather than emitting blank', () => {
    // A blank *TaxType imports as untaxed in Xero (it does NOT inherit the
    // account default), which silently under-bills GST.
    const config = resolveXeroExportConfig({ xeroAccountCode: '  ', xeroTaxType: '   ' });
    expect(config.accountCode).toBe(XERO_DEFAULT_ACCOUNT_CODE);
    expect(config.taxType).toBeUndefined();
    expect(buildXeroInvoiceExport(base, config).rows[1][col('*TaxType')]).toBe(
      XERO_DEFAULT_TAX_TYPE,
    );
  });

  it("keeps one company's settings out of another company's export", () => {
    const companyA = { xeroAccountCode: '201', xeroTaxType: 'GST on Income' };
    const companyB = { xeroAccountCode: '910', xeroTaxType: 'BAS Excluded' };
    const rowsA = buildXeroInvoiceExport(base, resolveXeroExportConfig(companyA)).rows;
    const rowsB = buildXeroInvoiceExport(base, resolveXeroExportConfig(companyB)).rows;

    expect(rowsA[1][col('*AccountCode')]).toBe('201');
    expect(rowsA[1][col('*TaxType')]).toBe('GST on Income');
    expect(rowsB[1][col('*AccountCode')]).toBe('910');
    expect(rowsB[1][col('*TaxType')]).toBe('BAS Excluded');
  });

  it('passes the caller due date through untouched (D8 — F2 does not move it)', () => {
    const config = resolveXeroExportConfig(
      { xeroAccountCode: '200', xeroTaxType: null },
      { dueDate: '2026-07-21' },
    );
    expect(config.dueDate).toBe('2026-07-21');
    expect(buildXeroInvoiceExport(base, config).rows[1][col('*DueDate')]).toBe('2026-07-21');
  });
});
