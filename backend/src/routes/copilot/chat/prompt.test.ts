import { describe, expect, it } from 'vitest';

import { CHAT_STAGES, isAllowedNavigateTarget, isChatStage, MAX_ACTIONS } from './prompt.js';

describe('isAllowedNavigateTarget', () => {
  it('accepts whitelisted in-app paths', () => {
    for (const path of [
      '/dashboard',
      '/projects',
      '/projects/abc-123',
      '/projects/abc-123/lots',
      '/projects/abc-123/lots/lot-9',
      '/projects/abc-123/copilot',
      '/projects/abc-123/control-lines',
      '/projects/abc-123/plan-sheets',
      '/projects/abc-123/itp',
      '/projects/abc-123/diary',
    ]) {
      expect(isAllowedNavigateTarget(path)).toBe(true);
    }
  });

  it('rejects external, protocol-relative, and off-list targets', () => {
    for (const path of [
      'https://evil.com',
      'http://example.com/dashboard',
      '//evil.com',
      '/evil',
      '/projects/abc/settings/secret',
      '/projects/abc?redirect=/x',
      '/projects/abc#/x',
      '/company-settings',
      'javascript:alert(1)',
      '',
      '/projects/abc/lots/lot-9/edit',
    ]) {
      expect(isAllowedNavigateTarget(path)).toBe(false);
    }
  });

  it('rejects non-string input', () => {
    expect(isAllowedNavigateTarget(undefined)).toBe(false);
    expect(isAllowedNavigateTarget(42)).toBe(false);
    expect(isAllowedNavigateTarget(null)).toBe(false);
  });
});

describe('isChatStage', () => {
  it('accepts the four setup stages and nothing else', () => {
    for (const stage of CHAT_STAGES) {
      expect(isChatStage(stage)).toBe(true);
    }
    expect(isChatStage('claims')).toBe(false);
    expect(isChatStage('')).toBe(false);
    expect(isChatStage(undefined)).toBe(false);
  });
});

describe('MAX_ACTIONS', () => {
  it('caps actions at three', () => {
    expect(MAX_ACTIONS).toBe(3);
  });
});
