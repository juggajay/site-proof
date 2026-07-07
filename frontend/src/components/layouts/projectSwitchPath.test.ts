import { describe, expect, it } from 'vitest';
import { buildProjectSwitchPath } from './projectSwitchPath';

describe('buildProjectSwitchPath', () => {
  it('drops stale lot record ids when switching projects', () => {
    expect(buildProjectSwitchPath('/projects/A/lots/LOT123', 'A', 'B')).toBe('/projects/B/lots');
    expect(buildProjectSwitchPath('/projects/A/lots/LOT123/edit', 'A', 'B')).toBe(
      '/projects/B/lots',
    );
  });

  it('preserves only the current module segment', () => {
    expect(buildProjectSwitchPath('/projects/A/lots', 'A', 'B')).toBe('/projects/B/lots');
  });

  it('defaults to the target project lots page without a module segment', () => {
    expect(buildProjectSwitchPath('/projects/A', 'A', 'B')).toBe('/projects/B/lots');
  });

  it('defaults to the target project lots page from non-project paths', () => {
    expect(buildProjectSwitchPath('/dashboard', 'A', 'B')).toBe('/projects/B/lots');
  });
});
