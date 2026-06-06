import type { Prisma } from '@prisma/client';
import { escapeHtml } from './presentationHtml.js';

type DecimalLike = Prisma.Decimal | number | string | null;

export interface RequestFormSource {
  id: string;
  testRequestNumber: string | null;
  testType: string;
  laboratoryName: string | null;
  sampleDate: Date | null;
  sampleLocation: string | null;
  resultUnit: string | null;
  specificationMin: DecimalLike;
  specificationMax: DecimalLike;
  createdAt: Date;
  project: {
    name: string;
    projectNumber: string | null;
    clientName: string | null;
    company: { name: string; abn: string | null; address: string | null } | null;
  };
  lot: {
    lotNumber: string;
    description: string | null;
    chainageStart: DecimalLike;
    chainageEnd: DecimalLike;
    layer: string | null;
    activityType: string;
  } | null;
  enteredBy: { fullName: string | null; email: string; phone: string | null } | null;
}

export function renderTestRequestFormHtml(testResult: RequestFormSource): string {
  // Format dates for display
  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };
  const formatHtmlValue = (value: unknown, fallback = 'N/A') => escapeHtml(value, fallback);
  const requestNumber =
    testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase();
  const specificationValue = (value: unknown) => {
    if (value === undefined || value === null || value === '') {
      return 'N/A';
    }

    return `${formatHtmlValue(value, '')} ${formatHtmlValue(testResult.resultUnit, '')}`.trim();
  };
  const generatedAt = escapeHtml(new Date().toLocaleString('en-AU'));

  // Generate HTML for printable form
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Request Form - ${formatHtmlValue(requestNumber)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #333;
        }
        .company-info { flex: 1; }
        .company-name { font-size: 18px; font-weight: bold; color: #333; }
        .form-title { text-align: right; }
        .form-title h1 { font-size: 20px; color: #333; }
        .form-title p { font-size: 14px; color: #666; }

        .section {
            margin-bottom: 15px;
            border: 1px solid #ccc;
            padding: 10px;
        }
        .section-title {
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #ddd;
            background: #f5f5f5;
            margin: -10px -10px 10px -10px;
            padding: 8px 10px;
        }
        .row {
            display: flex;
            margin-bottom: 8px;
        }
        .field {
            flex: 1;
            padding-right: 15px;
        }
        .field label {
            font-weight: bold;
            display: block;
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
        }
        .field .value {
            border-bottom: 1px solid #999;
            min-height: 18px;
            padding: 2px 0;
        }

        .specifications {
            background: #f9f9f9;
        }

        .footer {
            margin-top: 30px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
        }
        .signature-row {
            display: flex;
            justify-content: space-between;
            margin-top: 40px;
        }
        .signature-block {
            width: 45%;
        }
        .signature-line {
            border-bottom: 1px solid #333;
            height: 30px;
            margin-bottom: 5px;
        }
        .signature-label {
            font-size: 10px;
            color: #666;
        }

        .notes {
            min-height: 60px;
            border: 1px solid #ccc;
            padding: 8px;
            margin-top: 5px;
        }

        @media print {
            body { padding: 10px; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="no-print" style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
        <button onclick="window.print()" style="padding: 8px 16px; cursor: pointer;">Print Form</button>
        <span style="margin-left: 10px; color: #666;">Press Ctrl+P to print or save as PDF</span>
    </div>

    <div class="header">
        <div class="company-info">
            <div class="company-name">${formatHtmlValue(testResult.project.company?.name, 'Company')}</div>
            ${testResult.project.company?.abn ? `<div>ABN: ${formatHtmlValue(testResult.project.company.abn)}</div>` : ''}
            ${testResult.project.company?.address ? `<div>${formatHtmlValue(testResult.project.company.address)}</div>` : ''}
        </div>
        <div class="form-title">
            <h1>TEST REQUEST FORM</h1>
            <p>Form No: ${formatHtmlValue(requestNumber)}</p>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Project Information</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Project Name</label>
                <div class="value">${formatHtmlValue(testResult.project.name)}</div>
            </div>
            <div class="field">
                <label>Project Number</label>
                <div class="value">${formatHtmlValue(testResult.project.projectNumber)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Client</label>
                <div class="value">${formatHtmlValue(testResult.project.clientName)}</div>
            </div>
            <div class="field">
                <label>Request Date</label>
                <div class="value">${formatHtmlValue(formatDate(testResult.createdAt))}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Sample Location</div>
        <div class="row">
            <div class="field">
                <label>Lot Number</label>
                <div class="value">${formatHtmlValue(testResult.lot?.lotNumber)}</div>
            </div>
            <div class="field">
                <label>Activity Type</label>
                <div class="value">${formatHtmlValue(testResult.lot?.activityType)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Lot Description</label>
                <div class="value">${formatHtmlValue(testResult.lot?.description)}</div>
            </div>
            <div class="field">
                <label>Layer</label>
                <div class="value">${formatHtmlValue(testResult.lot?.layer)}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Chainage Start</label>
                <div class="value">${formatHtmlValue(testResult.lot?.chainageStart)}</div>
            </div>
            <div class="field">
                <label>Chainage End</label>
                <div class="value">${formatHtmlValue(testResult.lot?.chainageEnd)}</div>
            </div>
            <div class="field">
                <label>Sample Location Detail</label>
                <div class="value">${formatHtmlValue(testResult.sampleLocation)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Test Details</div>
        <div class="row">
            <div class="field" style="flex: 2;">
                <label>Test Type</label>
                <div class="value">${formatHtmlValue(testResult.testType)}</div>
            </div>
            <div class="field">
                <label>Sample Date</label>
                <div class="value">${formatHtmlValue(formatDate(testResult.sampleDate))}</div>
            </div>
        </div>
        <div class="row">
            <div class="field">
                <label>Laboratory</label>
                <div class="value">${formatHtmlValue(testResult.laboratoryName, '(To be assigned)')}</div>
            </div>
            <div class="field">
                <label>Priority</label>
                <div class="value">Standard</div>
            </div>
        </div>
    </div>

    <div class="section specifications">
        <div class="section-title">Specification Requirements</div>
        <div class="row">
            <div class="field">
                <label>Specification Min</label>
                <div class="value">${specificationValue(testResult.specificationMin)}</div>
            </div>
            <div class="field">
                <label>Specification Max</label>
                <div class="value">${specificationValue(testResult.specificationMax)}</div>
            </div>
            <div class="field">
                <label>Unit of Measurement</label>
                <div class="value">${formatHtmlValue(testResult.resultUnit)}</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">Notes / Special Instructions</div>
        <div class="notes"></div>
    </div>

    <div class="footer">
        <div class="row">
            <div class="field">
                <label>Requested By</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.fullName)}</div>
            </div>
            <div class="field">
                <label>Contact Email</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.email)}</div>
            </div>
            <div class="field">
                <label>Contact Phone</label>
                <div class="value">${formatHtmlValue(testResult.enteredBy?.phone)}</div>
            </div>
        </div>

        <div class="signature-row">
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Contractor Signature / Date</div>
            </div>
            <div class="signature-block">
                <div class="signature-line"></div>
                <div class="signature-label">Laboratory Receipt / Date</div>
            </div>
        </div>
    </div>

    <div style="margin-top: 20px; text-align: center; font-size: 10px; color: #999;">
        Generated by SiteProof | ${generatedAt}
    </div>
</body>
</html>
`;
}

export function buildTestRequestFormMetadata(testResult: RequestFormSource) {
  return {
    requestNumber:
      testResult.testRequestNumber || 'TRF-' + testResult.id.substring(0, 8).toUpperCase(),
    project: {
      name: testResult.project.name,
      number: testResult.project.projectNumber,
      client: testResult.project.clientName,
      company: testResult.project.company?.name,
    },
    lot: testResult.lot
      ? {
          number: testResult.lot.lotNumber,
          description: testResult.lot.description,
          activityType: testResult.lot.activityType,
          chainageStart: testResult.lot.chainageStart,
          chainageEnd: testResult.lot.chainageEnd,
          layer: testResult.lot.layer,
        }
      : null,
    testDetails: {
      type: testResult.testType,
      laboratory: testResult.laboratoryName,
      sampleDate: testResult.sampleDate,
      sampleLocation: testResult.sampleLocation,
    },
    specifications: {
      min: testResult.specificationMin,
      max: testResult.specificationMax,
      unit: testResult.resultUnit,
    },
    requestedBy: testResult.enteredBy,
    createdAt: testResult.createdAt,
  };
}
