import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('ITP completion schema constraints', () => {
  it('enforces one completion row per ITP instance checklist item', () => {
    const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const model = schema.match(/model ITPCompletion \{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(model).toContain('@@unique([itpInstanceId, checklistItemId])');
  });
});
