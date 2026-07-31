/**
 * The one rule this feature cannot get wrong: nothing says a docket is FILED
 * until the server has answered the evidence PATCH.
 *
 * A foreman who reads "Filed" stops carrying the paper docket around. If the
 * photo is actually still in the offline queue, the evidence is gone the moment
 * he clears his phone — and the gap only surfaces at handover, months later.
 * Every case below is a stage of the four-step chain failing, asserting the
 * state the row shows for it.
 */
import { describe, expect, it } from 'vitest';

import { docketChipTone, docketFilingStatusKey, needsDocketFiling } from './docketFilingState';

const pending = { syncStatus: 'pending' as const };
const errored = { syncStatus: 'error' as const };
const synced = { syncStatus: 'synced' as const };

describe('docketFilingStatusKey', () => {
  it('is FILED only when the server returned an evidence link', () => {
    expect(docketFilingStatusKey({ docketDocumentId: 'doc-1', isOnline: true })).toBe(
      'delivery_docket_filed',
    );
  });

  it('never claims FILED while the photo is only queued on the device', () => {
    for (const isOnline of [true, false]) {
      for (const photo of [pending, errored, synced]) {
        expect(docketFilingStatusKey({ docketDocumentId: null, photo, isOnline })).not.toBe(
          'delivery_docket_filed',
        );
      }
    }
  });

  // Stage 1/2 failure — the delivery itself has not reached the server, so the
  // photo cannot even be filed yet. Offline that is the honest reading.
  it('says SAVED ON DEVICE while queued with no signal', () => {
    expect(docketFilingStatusKey({ docketDocumentId: null, photo: pending, isOnline: false })).toBe(
      'delivery_docket_saved_on_device',
    );
  });

  // Stage 3 in flight.
  it('says UPLOADING while queued with signal', () => {
    expect(docketFilingStatusKey({ docketDocumentId: null, photo: pending, isOnline: true })).toBe(
      'delivery_docket_uploading',
    );
  });

  // Stage 3 or 4 hard-failed and the worker marked the photo errored.
  it('says FILING FAILED when the queued photo errored, online or off', () => {
    expect(docketFilingStatusKey({ docketDocumentId: null, photo: errored, isOnline: true })).toBe(
      'delivery_docket_filing_failed',
    );
    expect(docketFilingStatusKey({ docketDocumentId: null, photo: errored, isOnline: false })).toBe(
      'delivery_docket_filing_failed',
    );
  });

  it('says NOT FILED when nothing is queued and nothing is linked', () => {
    expect(docketFilingStatusKey({ docketDocumentId: null, isOnline: true })).toBe(
      'delivery_docket_not_filed',
    );
    expect(docketFilingStatusKey({ isOnline: false })).toBe('delivery_docket_not_filed');
  });

  // The delivery row can be older than the PATCH that filed it. A photo the
  // worker has finished with proves nothing on its own, so the surface falls
  // back to the honest "not filed" rather than guessing forward.
  it('does not infer FILED from a photo the worker marked synced', () => {
    expect(docketFilingStatusKey({ docketDocumentId: null, photo: synced, isOnline: true })).toBe(
      'delivery_docket_not_filed',
    );
  });

  // A second capture queued behind an already-filed docket must not un-file it.
  it('keeps FILED even while another capture is in flight', () => {
    expect(
      docketFilingStatusKey({ docketDocumentId: 'doc-1', photo: pending, isOnline: true }),
    ).toBe('delivery_docket_filed');
    expect(
      docketFilingStatusKey({ docketDocumentId: 'doc-1', photo: errored, isOnline: true }),
    ).toBe('delivery_docket_filed');
  });
});

describe('needsDocketFiling', () => {
  it('offers the File-docket action exactly when the docket is missing or stuck', () => {
    expect(needsDocketFiling('delivery_docket_not_filed')).toBe(true);
    expect(needsDocketFiling('delivery_docket_filing_failed')).toBe(true);
    expect(needsDocketFiling('delivery_docket_filed')).toBe(false);
    expect(needsDocketFiling('delivery_docket_uploading')).toBe(false);
    expect(needsDocketFiling('delivery_docket_saved_on_device')).toBe(false);
  });
});

describe('docketChipTone', () => {
  it('only ever paints a chip green for the state the server confirmed', () => {
    expect(docketChipTone('delivery_docket_filed')).toBe('success');
    expect(docketChipTone('delivery_docket_uploading')).toBe('info');
    expect(docketChipTone('delivery_docket_saved_on_device')).toBe('warning');
    expect(docketChipTone('delivery_docket_filing_failed')).toBe('danger');
    expect(docketChipTone('delivery_docket_not_filed')).toBe('neutral');
  });
});
