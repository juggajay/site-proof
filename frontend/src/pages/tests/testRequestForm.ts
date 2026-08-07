// Download the printable lab request form for one test.
//
// `GET /api/test-results/:id/request-form` is AUTHENTICATED, so it cannot be
// opened with `window.open` or an anchor href: a top-level navigation carries no
// Authorization header and lands on a 401. It is fetched with the bearer token,
// turned into a blob, and saved through the shared `downloadBlob` helper.
//
// DOCUMENT GENERATION ONLY. It mutates nothing — no status change, no
// `sentToLabAt` stamp. It is deliberately separate from "Send to lab", which is
// the lifecycle action; printing the form for a lab you have not sent to yet is
// a normal thing to want.

import { authFetch } from '@/lib/api';
import { downloadBlob } from '@/lib/downloads';

export function requestFormFilename(testType: string, testRequestNumber?: string | null): string {
  const reference = testRequestNumber?.trim();
  return `test-request-${reference ? `${reference}-` : ''}${testType}.html`;
}

export async function downloadTestRequestForm(test: {
  id: string;
  testType: string;
  testRequestNumber?: string | null;
}): Promise<void> {
  const response = await authFetch(`/api/test-results/${encodeURIComponent(test.id)}/request-form`);
  if (!response.ok) {
    throw new Error('Could not generate the lab request form.');
  }

  downloadBlob(
    await response.blob(),
    requestFormFilename(test.testType, test.testRequestNumber),
    'test-request.html',
  );
}
