import { describe, expect, it } from 'vitest';

import { resolveEffectivePassFail } from './certificateExtraction.js';

// Pure coverage of the manual-create pass/fail backstop (audit finding: the
// manual POST/PATCH test-result paths trusted the client passFail with no H13
// recompute, so an out-of-spec result could be recorded as 'pass'). The resolver
// recomputes from the value + spec and only falls back to the client value when
// the data cannot decide (no value, or no spec bound).
describe('resolveEffectivePassFail', () => {
  it('overrides a client pass when the value is below the minimum spec', () => {
    expect(resolveEffectivePassFail('pass', 80, 90, 100)).toBe('fail');
  });

  it('overrides a client pass when the value is above the maximum spec', () => {
    expect(resolveEffectivePassFail('pass', 110, 90, 100)).toBe('fail');
  });

  it('overrides a client fail when the value is in spec', () => {
    expect(resolveEffectivePassFail('fail', 95, 90, 100)).toBe('pass');
  });

  it('derives pass from a client pending when the value is in spec', () => {
    expect(resolveEffectivePassFail('pending', 95, 90, 100)).toBe('pass');
  });

  it('keeps the client value when there is no spec bound to decide', () => {
    expect(resolveEffectivePassFail('pass', 95, null, null)).toBe('pass');
    expect(resolveEffectivePassFail('fail', 95, null, null)).toBe('fail');
  });

  it('keeps the client value when there is no result value', () => {
    expect(resolveEffectivePassFail('fail', null, 90, 100)).toBe('fail');
    expect(resolveEffectivePassFail('pending', null, 90, 100)).toBe('pending');
  });

  it('derives from the data even when the client value is omitted', () => {
    expect(resolveEffectivePassFail(undefined, 80, 90, 100)).toBe('fail');
    expect(resolveEffectivePassFail(undefined, 95, 90, 100)).toBe('pass');
    expect(resolveEffectivePassFail(undefined, null, null, null)).toBeUndefined();
  });
});
