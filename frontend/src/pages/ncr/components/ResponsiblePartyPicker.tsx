import { NativeSelect } from '@/components/ui/native-select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type {
  ResponsibleSubcontractorOption,
  ResponsibleUserOption,
} from '../hooks/useResponsiblePartyOptions';

export type ResponsibleParty =
  | { type: 'unassigned' }
  | { type: 'user'; userId: string }
  | { type: 'subcontractor'; subcontractorId: string };

const UNASSIGNED_VALUE = '';
const USER_PREFIX = 'user:';
const SUB_PREFIX = 'sub:';

function responsiblePartyToSelectValue(party: ResponsibleParty): string {
  if (party.type === 'user') return `${USER_PREFIX}${party.userId}`;
  if (party.type === 'subcontractor') return `${SUB_PREFIX}${party.subcontractorId}`;
  return UNASSIGNED_VALUE;
}

function selectValueToResponsibleParty(value: string): ResponsibleParty {
  if (value.startsWith(USER_PREFIX)) {
    return { type: 'user', userId: value.slice(USER_PREFIX.length) };
  }
  if (value.startsWith(SUB_PREFIX)) {
    return { type: 'subcontractor', subcontractorId: value.slice(SUB_PREFIX.length) };
  }
  return { type: 'unassigned' };
}

interface ResponsiblePartyPickerProps {
  id: string;
  label?: string;
  value: ResponsibleParty;
  onChange: (party: ResponsibleParty) => void;
  users: ResponsibleUserOption[];
  subcontractors: ResponsibleSubcontractorOption[];
  /**
   * True when the subcontractor list could not be loaded for the current role
   * (e.g. a 403 because the role lacks subcontractor-management access). The
   * picker still works with People + Unassigned; we just show a small note that
   * subcontractors are not available so the empty group is not mistaken for "no
   * subcontractors exist".
   */
  subcontractorsUnavailable?: boolean;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  disabled?: boolean;
}

/**
 * Single dropdown that assigns an NCR to a project user OR a subcontractor
 * company (mutually exclusive) OR leaves it unassigned. The selected value
 * encodes which field the caller should set.
 */
export function ResponsiblePartyPicker({
  id,
  label = 'Responsible Party',
  value,
  onChange,
  users,
  subcontractors,
  subcontractorsUnavailable = false,
  loading,
  error,
  onRetry,
  disabled,
}: ResponsiblePartyPickerProps) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {loading ? (
        <p className="text-sm text-muted-foreground mt-1" role="status">
          Loading people and subcontractors...
        </p>
      ) : error ? (
        <div
          className="mt-1 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <>
          <NativeSelect
            id={id}
            className="mt-1"
            value={responsiblePartyToSelectValue(value)}
            disabled={disabled}
            onChange={(event) => onChange(selectValueToResponsibleParty(event.target.value))}
          >
            <option value={UNASSIGNED_VALUE}>Unassigned</option>
            {users.length > 0 && (
              <optgroup label="People">
                {users.map((user) => (
                  <option key={user.userId} value={`${USER_PREFIX}${user.userId}`}>
                    {user.label}
                  </option>
                ))}
              </optgroup>
            )}
            {subcontractors.length > 0 && (
              <optgroup label="Subcontractors">
                {subcontractors.map((sub) => (
                  <option key={sub.id} value={`${SUB_PREFIX}${sub.id}`}>
                    {sub.label}
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
          <p className="text-xs text-muted-foreground mt-1">
            Assign to a person or a subcontractor company. They will be notified.
          </p>
          {subcontractorsUnavailable && (
            <p className="text-xs text-muted-foreground mt-1">
              Subcontractor companies are not available to assign with your access level. You can
              still assign a person.
            </p>
          )}
        </>
      )}
    </div>
  );
}
