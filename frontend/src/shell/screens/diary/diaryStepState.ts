/**
 * diaryStepState.ts — Pure step-state derivation for the diary path.
 *
 * This is the SINGLE SOURCE OF TRUTH for what "done" means for each step.
 * Used by both PathScreen (shows node states) and HomeScreen (hero step-count).
 *
 * Steps:
 *   1. Weather        — diary exists AND weatherConditions is non-empty
 *   2. Crew & Plant   — diary exists AND (personnel.length > 0 OR plant.length > 0)
 *   3. Today's Work   — diary exists AND any activities/delays/deliveries/events
 *   4. Review & Submit — diary is submitted
 */

import type { DailyDiary } from '@/pages/diary/types';

export type StepStatus = 'done' | 'now' | 'locked';

export interface DiaryStepState {
  weather: StepStatus;
  crew: StepStatus;
  work: StepStatus;
  review: StepStatus;
  /** True when all 4 steps are done (diary submitted) */
  allDone: boolean;
  /** Index of the "current" step (0-based) — first non-done step */
  currentStep: number;
  /** How many steps are complete (0-4) */
  stepsComplete: number;
}

/**
 * Derives the 4-node path state from a diary (or null = no diary yet).
 * Pure function — no side effects; safe to call in tests with any shape.
 */
export function deriveDiaryStepState(diary: DailyDiary | null | undefined): DiaryStepState {
  // Step done booleans
  const weatherDone = !!(
    diary &&
    (diary.weatherConditions || diary.temperatureMin != null || diary.temperatureMax != null)
  );
  const crewDone = !!(
    diary &&
    ((diary.personnel?.length ?? 0) > 0 || (diary.plant?.length ?? 0) > 0)
  );
  const workDone = !!(
    diary &&
    (diary.activities?.length ?? 0) +
      (diary.delays?.length ?? 0) +
      (diary.deliveries?.length ?? 0) +
      (diary.events?.length ?? 0) >
      0
  );
  const submitted = diary?.status === 'submitted';

  const stepsComplete =
    (weatherDone ? 1 : 0) + (crewDone ? 1 : 0) + (workDone ? 1 : 0) + (submitted ? 1 : 0);

  // Node status derivation: done → now (first incomplete) → locked (rest)
  let foundCurrent = false;

  function nodeStatus(isDone: boolean, isAccessible: boolean): StepStatus {
    if (isDone) return 'done';
    if (!foundCurrent && isAccessible) {
      foundCurrent = true;
      return 'now';
    }
    return 'locked';
  }

  // When diary is submitted, treat all prior steps as complete regardless of
  // field presence (submitted = all work was done; content may be sparse in tests).
  const weather = submitted ? 'done' : nodeStatus(weatherDone, true);
  const crew = submitted ? 'done' : nodeStatus(crewDone, weatherDone || crewDone);
  const work = submitted ? 'done' : nodeStatus(workDone, crewDone || workDone);
  // Review unlocks only when work exists; once submitted = done
  const review = submitted ? 'done' : nodeStatus(false, workDone);

  // currentStep: 0=weather,1=crew,2=work,3=review
  const currentStep = submitted ? 3 : !weatherDone ? 0 : !crewDone ? 1 : !workDone ? 2 : 3;

  return {
    weather,
    crew,
    work,
    review,
    allDone: submitted,
    currentStep,
    stepsComplete,
  };
}

/** Crew description line — "N workers · M machines" or "Carry from yesterday" hint. */
export function crewDescription(
  diary: DailyDiary | null | undefined,
  hasYesterday = false,
): string {
  if (!diary) return 'Log who worked today — carry from yesterday in one tap.';
  const workers = diary.personnel?.length ?? 0;
  const machines = diary.plant?.length ?? 0;
  if (workers === 0 && machines === 0) {
    return hasYesterday
      ? 'No crew yet — carry from yesterday in one tap.'
      : 'No crew or plant recorded yet.';
  }
  const parts: string[] = [];
  if (workers > 0) parts.push(`${workers} worker${workers !== 1 ? 's' : ''}`);
  if (machines > 0) parts.push(`${machines} machine${machines !== 1 ? 's' : ''}`);
  return parts.join(' · ');
}

/** Work description line — summarises entry counts. */
export function workDescription(diary: DailyDiary | null | undefined): string {
  if (!diary) return 'Nothing logged yet — takes a couple of minutes.';
  const act = diary.activities?.length ?? 0;
  const del = diary.delays?.length ?? 0;
  const div = diary.deliveries?.length ?? 0;
  const ev = diary.events?.length ?? 0;
  const total = act + del + div + ev;
  if (total === 0) return 'Nothing logged yet — takes a couple of minutes.';
  const parts: string[] = [];
  if (act > 0) parts.push(`${act} ${act === 1 ? 'activity' : 'activities'}`);
  if (del > 0) parts.push(`${del} ${del === 1 ? 'delay' : 'delays'}`);
  if (div > 0) parts.push(`${div} ${div === 1 ? 'delivery' : 'deliveries'}`);
  if (ev > 0) parts.push(`${ev} ${ev === 1 ? 'event' : 'events'}`);
  return parts.join(' · ');
}
