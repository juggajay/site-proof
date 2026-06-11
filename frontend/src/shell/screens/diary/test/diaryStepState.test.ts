/**
 * Tests for diaryStepState — pure step-state derivation.
 * All combinations including submitted state.
 */

import { describe, it, expect } from 'vitest';
import { deriveDiaryStepState, crewDescription, workDescription } from '../diaryStepState';
import type { DailyDiary } from '@/pages/diary/types';

// ── Helper to build minimal diary objects ──────────────────────────────────────

function makeDiary(overrides: Partial<DailyDiary> = {}): DailyDiary {
  return {
    id: 'diary-1',
    projectId: 'proj-1',
    date: '2026-06-11',
    status: 'draft',
    personnel: [],
    plant: [],
    activities: [],
    delays: [],
    deliveries: [],
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── deriveDiaryStepState ───────────────────────────────────────────────────────

describe('deriveDiaryStepState — null/no diary', () => {
  it('all locked except weather=now when diary is null', () => {
    const state = deriveDiaryStepState(null);
    expect(state.weather).toBe('now');
    expect(state.crew).toBe('locked');
    expect(state.work).toBe('locked');
    expect(state.review).toBe('locked');
    expect(state.allDone).toBe(false);
    expect(state.stepsComplete).toBe(0);
    expect(state.currentStep).toBe(0);
  });

  it('undefined diary behaves like null', () => {
    const state = deriveDiaryStepState(undefined);
    expect(state.weather).toBe('now');
    expect(state.stepsComplete).toBe(0);
  });
});

describe('deriveDiaryStepState — weather only', () => {
  it('weather=done, crew=now after weather recorded', () => {
    const diary = makeDiary({ weatherConditions: 'Fine' });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
    expect(state.crew).toBe('now');
    expect(state.work).toBe('locked');
    expect(state.review).toBe('locked');
    expect(state.stepsComplete).toBe(1);
    expect(state.currentStep).toBe(1);
  });
});

describe('deriveDiaryStepState — weather + crew', () => {
  it('weather=done, crew=done, work=now', () => {
    const diary = makeDiary({
      weatherConditions: 'Rain',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
    expect(state.crew).toBe('done');
    expect(state.work).toBe('now');
    expect(state.review).toBe('locked');
    expect(state.stepsComplete).toBe(2);
    expect(state.currentStep).toBe(2);
  });

  it('plant counts for crew done', () => {
    const diary = makeDiary({
      weatherConditions: 'Fine',
      plant: [{ id: 'pl1', description: 'Grader', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.crew).toBe('done');
  });
});

describe('deriveDiaryStepState — full work logged, review unlocked', () => {
  it('review=now when work exists but not submitted', () => {
    const diary = makeDiary({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      activities: [{ id: 'a1', description: 'Fill layer', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
    expect(state.crew).toBe('done');
    expect(state.work).toBe('done');
    expect(state.review).toBe('now');
    expect(state.stepsComplete).toBe(3);
    expect(state.currentStep).toBe(3);
  });

  it('delays count for work done', () => {
    const diary = makeDiary({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      delays: [{ id: 'd1', delayType: 'Weather', description: 'Rain stopped work', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.work).toBe('done');
  });

  it('deliveries count for work done', () => {
    const diary = makeDiary({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      deliveries: [{ id: 'dv1', description: 'Crushed rock', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.work).toBe('done');
  });

  it('events count for work done', () => {
    const diary = makeDiary({
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      events: [{ id: 'ev1', eventType: 'Visitor', description: 'Site visit', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.work).toBe('done');
  });
});

describe('deriveDiaryStepState — submitted', () => {
  it('all steps done when status=submitted', () => {
    const diary = makeDiary({
      status: 'submitted',
      weatherConditions: 'Fine',
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      activities: [{ id: 'a1', description: 'Fill', createdAt: '' }],
    });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
    expect(state.crew).toBe('done');
    expect(state.work).toBe('done');
    expect(state.review).toBe('done');
    expect(state.allDone).toBe(true);
    expect(state.stepsComplete).toBe(4);
    expect(state.currentStep).toBe(3);
  });

  it('submitted with no weather still all done', () => {
    // Edge case: diary submitted without weather
    const diary = makeDiary({ status: 'submitted' });
    const state = deriveDiaryStepState(diary);
    expect(state.allDone).toBe(true);
    expect(state.review).toBe('done');
  });
});

describe('deriveDiaryStepState — temperature-only weather', () => {
  it('weather done when only temperatureMin recorded (no weatherConditions text)', () => {
    const diary = makeDiary({ temperatureMin: 12 });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
  });

  it('weather done when only temperatureMax recorded', () => {
    const diary = makeDiary({ temperatureMax: 28 });
    const state = deriveDiaryStepState(diary);
    expect(state.weather).toBe('done');
  });
});

// ── crewDescription ────────────────────────────────────────────────────────────

describe('crewDescription', () => {
  it('returns hint when no diary', () => {
    expect(crewDescription(null)).toContain('Log who worked today');
  });

  it('returns no-crew message for empty diary', () => {
    const result = crewDescription(makeDiary());
    expect(result).toBeTruthy();
  });

  it('shows worker count only', () => {
    const diary = makeDiary({
      personnel: [
        { id: 'p1', name: 'Jay', createdAt: '' },
        { id: 'p2', name: 'Bob', createdAt: '' },
      ],
    });
    expect(crewDescription(diary)).toContain('2 workers');
  });

  it('shows plant count only', () => {
    const diary = makeDiary({
      plant: [{ id: 'pl1', description: 'Grader', createdAt: '' }],
    });
    expect(crewDescription(diary)).toContain('1 machine');
  });

  it('shows both workers and machines', () => {
    const diary = makeDiary({
      personnel: [{ id: 'p1', name: 'Jay', createdAt: '' }],
      plant: [
        { id: 'pl1', description: 'Grader', createdAt: '' },
        { id: 'pl2', description: 'Roller', createdAt: '' },
      ],
    });
    const result = crewDescription(diary);
    expect(result).toContain('1 worker');
    expect(result).toContain('2 machines');
  });
});

// ── workDescription ────────────────────────────────────────────────────────────

describe('workDescription', () => {
  it('returns nothing-logged when no diary', () => {
    expect(workDescription(null)).toContain('Nothing logged');
  });

  it('returns nothing-logged for empty diary', () => {
    expect(workDescription(makeDiary())).toContain('Nothing logged');
  });

  it('counts activities', () => {
    const diary = makeDiary({
      activities: [
        { id: 'a1', description: 'Fill', createdAt: '' },
        { id: 'a2', description: 'Compact', createdAt: '' },
      ],
    });
    expect(workDescription(diary)).toContain('2 activities');
  });

  it('counts delays', () => {
    const diary = makeDiary({
      delays: [{ id: 'd1', delayType: 'Weather', description: 'Rain', createdAt: '' }],
    });
    expect(workDescription(diary)).toContain('1 delay');
  });

  it('combines multiple types', () => {
    const diary = makeDiary({
      activities: [{ id: 'a1', description: 'Fill', createdAt: '' }],
      delays: [{ id: 'd1', delayType: 'Weather', description: 'Rain', createdAt: '' }],
    });
    const result = workDescription(diary);
    expect(result).toContain('1 activity');
    expect(result).toContain('1 delay');
  });
});
