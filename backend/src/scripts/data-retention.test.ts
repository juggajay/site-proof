import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('data retention reporting', () => {
  it('does not report read notifications as archived before an archive path exists', () => {
    const source = readFileSync(join(process.cwd(), 'scripts', 'data-retention.ts'), 'utf8');

    expect(source).not.toContain('toArchive += oldNotifications');
    expect(source).not.toContain(
      'Read notifications older than ${RETENTION_POLICIES.readNotifications} days can be archived',
    );
    expect(source).toContain('toRetain += oldNotifications');
    expect(source).toContain(
      'Read notifications older than ${RETENTION_POLICIES.readNotifications} days are retained until notification archiving is implemented',
    );
  });
});
