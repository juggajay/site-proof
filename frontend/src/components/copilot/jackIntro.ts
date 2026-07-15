import type { User } from '@/lib/auth';
import { readLocalStorageItem, writeLocalStorageItem } from '@/lib/storagePreferences';

export const JACK_INTRO_FLAG = 'jack-intro-seen';

/**
 * Scripted (client-side, never the model) first-run introduction. Also the
 * empty-transcript state shown whenever there are no messages.
 */
export function jackIntro(firstName?: string): string {
  const hi = firstName ? `G'day ${firstName}` : "G'day";
  return (
    `${hi} — I'm Jack, your SiteProof copilot. I can read your drawings to set up ` +
    `projects, tell you what needs doing next, and take you straight to the right place. ` +
    `Everything I prepare goes to you for review before it's saved. I'm always down here ` +
    `if you need me.`
  );
}

export const JACK_SUGGESTED_PROMPTS = [
  'What should I do first?',
  "What's waiting for my review?",
  'Read my drawings for me',
];

/** First name for the greeting, from fullName/name; empty when unknown. */
export function firstNameOf(user: Pick<User, 'fullName' | 'name'> | null | undefined): string {
  const full = user?.fullName || user?.name || '';
  return full.trim().split(/\s+/)[0] ?? '';
}

/** Project id from a classic route path (`/projects/:id/...`), or undefined. */
export function projectIdFromPath(pathname: string): string | undefined {
  return pathname.match(/\/projects\/([^/]+)/)?.[1];
}

export function hasSeenIntro(): boolean {
  return readLocalStorageItem(JACK_INTRO_FLAG) != null;
}

export function markIntroSeen() {
  writeLocalStorageItem(JACK_INTRO_FLAG, '1');
}
