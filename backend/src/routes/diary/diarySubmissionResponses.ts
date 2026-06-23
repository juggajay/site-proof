type DiaryValidationIssue = {
  section: string;
  message: string;
};

type DiaryValidationWarning = DiaryValidationIssue & {
  severity: 'warning' | 'info';
};

type DiaryValidationSummary = {
  personnel: number;
  activities: number;
  plant: number;
  delays: number;
  visitors: number;
  hasWeather: boolean;
};

export function buildDiaryValidationResponse(input: {
  isValid: boolean;
  hasWarnings: boolean;
  errors: DiaryValidationIssue[];
  warnings: DiaryValidationWarning[];
  summary: DiaryValidationSummary;
}) {
  return {
    isValid: input.isValid,
    hasWarnings: input.hasWarnings,
    canSubmit: input.isValid,
    errors: input.errors,
    warnings: input.warnings,
    summary: input.summary,
  };
}

export function buildDiarySubmitResponse(diary: unknown, warningsAcknowledged: boolean) {
  return { diary, warningsAcknowledged };
}

export function buildDiaryReopenedResponse(diary: unknown) {
  return { diary };
}

export function buildDiaryAddendumCreatedResponse(addendum: unknown) {
  return addendum;
}

export function buildDiaryAddendumsResponse(addendums: unknown[]) {
  return addendums;
}
