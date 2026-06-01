import { describe, expect, it } from 'vitest';

import {
  buildAllConsentsWithdrawnResponse,
  buildBulkConsentRecordedResponse,
  buildConsentHistoryResponse,
  buildConsentRecordedResponse,
  buildConsentTypesResponse,
  buildCurrentConsentStatusResponse,
} from './responses.js';

const createdAt = new Date('2026-06-01T01:02:03.000Z');
const record = {
  id: 'consent-1',
  consentType: 'privacy_policy',
  granted: true,
  version: '1.0',
  createdAt,
};

describe('consent response helpers', () => {
  it('preserves current consent status response shape', () => {
    const consents = {
      privacy_policy: {
        granted: true,
        version: '1.0',
        grantedAt: '2026-06-01T01:02:03.000Z',
      },
    };
    const currentVersions = { privacy_policy: '1.0' };

    expect(buildCurrentConsentStatusResponse(consents, currentVersions)).toEqual({
      consents,
      currentVersions,
    });
  });

  it('preserves single consent granted and withdrawn messages', () => {
    expect(buildConsentRecordedResponse(record, true)).toEqual({
      consentRecord: {
        id: 'consent-1',
        consentType: 'privacy_policy',
        granted: true,
        version: '1.0',
        recordedAt: '2026-06-01T01:02:03.000Z',
      },
      message: 'Consent granted',
    });

    expect(buildConsentRecordedResponse({ ...record, granted: false }, false).message).toBe(
      'Consent withdrawn',
    );
  });

  it('preserves bulk consent response shape and count message', () => {
    expect(buildBulkConsentRecordedResponse([record])).toEqual({
      consentRecords: [
        {
          id: 'consent-1',
          consentType: 'privacy_policy',
          granted: true,
          version: '1.0',
          recordedAt: '2026-06-01T01:02:03.000Z',
        },
      ],
      message: '1 consent records created',
    });
  });

  it('preserves history and withdraw-all responses', () => {
    expect(buildConsentHistoryResponse([record])).toEqual({
      history: [
        {
          id: 'consent-1',
          consentType: 'privacy_policy',
          granted: true,
          version: '1.0',
          recordedAt: '2026-06-01T01:02:03.000Z',
        },
      ],
    });

    expect(buildAllConsentsWithdrawnResponse(6, createdAt)).toEqual({
      message: 'All consents withdrawn',
      withdrawnCount: 6,
      withdrawnAt: '2026-06-01T01:02:03.000Z',
    });
  });

  it('preserves consent type descriptions and versions', () => {
    expect(
      buildConsentTypesResponse(
        ['privacy_policy', 'analytics'],
        { privacy_policy: '1.0' },
        (type) => `${type} description`,
      ),
    ).toEqual({
      consentTypes: [
        {
          type: 'privacy_policy',
          version: '1.0',
          description: 'privacy_policy description',
        },
        {
          type: 'analytics',
          version: undefined,
          description: 'analytics description',
        },
      ],
    });
  });
});
