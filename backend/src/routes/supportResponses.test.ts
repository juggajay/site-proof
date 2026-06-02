import { describe, expect, it } from 'vitest';
import { buildClientErrorReportResponse, buildSupportRequestResponse } from './supportResponses.js';

describe('support response helpers', () => {
  it('builds the support request success response', () => {
    expect(buildSupportRequestResponse('SP-123456', 'technical')).toEqual({
      success: true,
      message: 'Support request submitted successfully',
      ticketId: 'SP-123456',
      category: 'technical',
    });
  });

  it('builds the client error report response', () => {
    expect(buildClientErrorReportResponse('SP-ERR-123456')).toEqual({
      success: true,
      reportId: 'SP-ERR-123456',
    });
  });
});
