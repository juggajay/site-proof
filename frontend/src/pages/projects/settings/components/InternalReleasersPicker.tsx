import { useCallback, useEffect, useRef, useState } from 'react';

import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { logError } from '@/lib/logger';
import type { ProjectUser } from '../types';

interface InternalReleasersPickerProps {
  projectId: string;
  initialSelectedIds: string[];
  readOnly?: boolean;
  onSaved?: (ids: string[]) => void;
}

function memberLabel(member: ProjectUser): string {
  return member.fullName?.trim() || member.email;
}

export function InternalReleasersPicker({
  projectId,
  initialSelectedIds,
  readOnly = false,
  onSaved,
}: InternalReleasersPickerProps) {
  const [members, setMembers] = useState<ProjectUser[]>([]);
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    setSelectedIds(initialSelectedIds);
  }, [initialSelectedIds]);

  const loadMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([]);
      setError('Project not found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await apiFetch<{ users: ProjectUser[] }>(
        `/api/projects/${encodeURIComponent(projectId)}/users`,
      );
      setMembers((response.users ?? []).filter((member) => member.status === 'active'));
    } catch (loadError) {
      logError('Failed to load internal hold point releasers:', loadError);
      setMembers([]);
      setError(extractErrorMessage(loadError, 'Could not load project members.'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const toggleMember = async (userId: string) => {
    if (readOnly || savingRef.current) return;

    const previous = selectedIds;
    const next = previous.includes(userId)
      ? previous.filter((id) => id !== userId)
      : [...previous, userId];

    savingRef.current = true;
    setSaving(true);
    setSelectedIds(next);
    setError('');
    setStatus('');
    try {
      await apiFetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ hpInternalReleaserIds: next }),
      });
      onSaved?.(next);
      setStatus('Internal hold point releasers saved.');
    } catch (saveError) {
      setSelectedIds(previous);
      logError('Failed to save internal hold point releasers:', saveError);
      setError(extractErrorMessage(saveError, 'Failed to save internal hold point releasers.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border p-4">
      <h2 className="mb-2 text-lg font-semibold">Internal hold point releasers</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        With nobody selected, any role permitted to release hold points may release. When people are
        selected, only those people may record an internal release.
      </p>

      {error && (
        <div role="alert" className="mb-3 rounded bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {status && (
        <div role="status" className="mb-3 rounded bg-primary/10 p-3 text-sm text-primary">
          {status}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading project members…</p>
      ) : members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active project members available.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((member) => {
            const label = memberLabel(member);
            return (
              <li key={member.userId}>
                <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(member.userId)}
                    onChange={() => void toggleMember(member.userId)}
                    disabled={readOnly || saving}
                    aria-label={`Nominated internal releaser: ${label}`}
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {member.email} · {member.role.replace(/_/g, ' ')}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
