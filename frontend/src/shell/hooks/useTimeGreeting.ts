/**
 * useTimeGreeting — time-aware greeting for the home header.
 *
 * Rules (spec §4 / mock):
 *   hour < 12  → "Morning, {firstName}"
 *   12 ≤ hour < 17 → "Arvo, {firstName}"
 *   hour ≥ 17  → "Evening, {firstName}"
 *
 * If no name is available the name part is omitted gracefully.
 *
 * The hour parameter is injectable for unit testing (defaults to the current
 * wall-clock hour). Pass a fixed number to freeze time in tests.
 */

export type GreetingPeriod = 'morning' | 'arvo' | 'evening';

/**
 * Pure function — derive the greeting period from an hour (0-23).
 * Exported for unit testing.
 */
export function getGreetingPeriod(hour: number): GreetingPeriod {
  if (hour < 12) return 'morning';
  if (hour < 17) return 'arvo';
  return 'evening';
}

const GREETING_LABELS: Record<GreetingPeriod, string> = {
  morning: 'Morning',
  arvo: 'Arvo',
  evening: 'Evening',
};

/**
 * Builds the greeting string from a full name and an hour.
 * Extracts the first space-separated token as the first name.
 */
export function buildGreeting(fullName: string | null | undefined, hour: number): string {
  const period = getGreetingPeriod(hour);
  const prefix = GREETING_LABELS[period];
  const firstName = fullName?.trim().split(/\s+/)[0];
  return firstName ? `${prefix}, ${firstName}` : prefix;
}

/**
 * React hook — returns the current greeting string.
 * Re-evaluates when the component mounts; does NOT set a timer to recheck
 * mid-session (the shell is opened/closed frequently enough that the greeting
 * will be correct on each open).
 */
export function useTimeGreeting(fullName?: string | null): string {
  const hour = new Date().getHours();
  return buildGreeting(fullName, hour);
}
