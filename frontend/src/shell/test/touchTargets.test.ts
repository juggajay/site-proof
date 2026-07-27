/**
 * Gloved-hand touch-target guard (external review item 2, 2026-07-27).
 *
 * The foreman + subbie shells are used one-handed on site with gloves on, so
 * every interactive target must clear 48px — WCAG 2.2 AAA (44px) plus headroom.
 * Two mechanisms exist and this file guards both:
 *
 *   1. `.shell-tap48` in src/index.css grows the POINTER surface of a small
 *      control to 48px via an invisible ::after, leaving its visuals alone.
 *   2. A plain `min-h-[48px]` bump where 48px is the intended visual size.
 *
 * The scan below is deliberately blunt: any hard-coded `min-h-[Npx]` under
 * src/shell with N < 48 fails. If a genuinely non-interactive box needs to be
 * shorter, use a plain `h-*` class instead of `min-h-[…]` — do not weaken this
 * test.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const SHELL_DIR = join(process.cwd(), 'src', 'shell');
const INDEX_CSS = join(process.cwd(), 'src', 'index.css');

/**
 * Non-interactive layout boxes, matched on `<file>:<class>`. The one entry is the
 * sticky header's flex ROW (home + inner headers): it reserves 40px of row height
 * around the 40px back button / theme toggle, which carry their own 48px hit area
 * via .shell-tap48. Growing the row would just push the whole shell header down
 * 8px. Add here only for boxes that nothing taps.
 */
const NON_INTERACTIVE = new Set(['components/ShellScreen.tsx:min-h-[40px]']);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) return walk(p);
    return p.endsWith('.tsx') && !p.includes('.test.') ? [p] : [];
  });
}

describe('shell touch targets', () => {
  it('defines the 48px hit-area utility with a hit-testable pseudo-element', () => {
    const css = readFileSync(INDEX_CSS, 'utf8');
    const block = css.slice(css.indexOf('.shell-tap48::after'));
    expect(block).toContain("content: ''");
    expect(block.slice(0, 400)).toContain('min-width: 48px');
    expect(block.slice(0, 400)).toContain('min-height: 48px');
  });

  it('has no min-h-[<48px] anywhere in the shell', () => {
    const offenders: string[] = [];
    for (const file of walk(SHELL_DIR)) {
      const rel = file.slice(SHELL_DIR.length + 1).replace(/\\/g, '/');
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          for (const m of line.matchAll(/min-h-\[(\d+(?:\.\d+)?)px\]/g)) {
            if (Number(m[1]) >= 48) continue;
            if (NON_INTERACTIVE.has(`${rel}:${m[0]}`)) continue;
            offenders.push(`${rel}:${i + 1} → ${m[0]}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });
});
