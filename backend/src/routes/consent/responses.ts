type ConsentVersions = Record<string, string>;

type ConsentRecord = {
  id: string;
  consentType: string;
  granted: boolean;
  version: string;
  createdAt: Date;
};

function buildConsentRecordPayload(record: ConsentRecord) {
  return {
    id: record.id,
    consentType: record.consentType,
    granted: record.granted,
    version: record.version,
    recordedAt: record.createdAt.toISOString(),
  };
}

export function buildCurrentConsentStatusResponse(
  consents: Record<string, { granted: boolean; version: string; grantedAt: string | null }>,
  currentVersions: ConsentVersions,
) {
  return { consents, currentVersions };
}

export function buildConsentRecordedResponse(record: ConsentRecord, granted: boolean) {
  return {
    consentRecord: buildConsentRecordPayload(record),
    message: granted ? 'Consent granted' : 'Consent withdrawn',
  };
}

export function buildBulkConsentRecordedResponse(records: ConsentRecord[]) {
  return {
    consentRecords: records.map(buildConsentRecordPayload),
    message: `${records.length} consent records created`,
  };
}

export function buildConsentHistoryResponse(records: ConsentRecord[]) {
  return {
    history: records.map(buildConsentRecordPayload),
  };
}

export function buildAllConsentsWithdrawnResponse(withdrawnCount: number, withdrawnAt: Date) {
  return {
    message: 'All consents withdrawn',
    withdrawnCount,
    withdrawnAt: withdrawnAt.toISOString(),
  };
}

export function buildConsentTypesResponse(
  consentTypes: readonly string[],
  versions: ConsentVersions,
  getDescription: (consentType: string) => string,
) {
  return {
    consentTypes: consentTypes.map((type) => ({
      type,
      version: versions[type],
      description: getDescription(type),
    })),
  };
}
