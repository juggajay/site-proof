// Wave G G2 — compare two ITP template versions
// (docs/plans/wave-g-execution-spec-2026-07-31.md §2.2(e)).
//
// Renders the SAME `ChecklistDiff` shape the Wave B import review already shows
// (`ImportReviewPanes`), because it is the same diff engine. No new diff
// vocabulary was invented for this surface.
//
// Self-gating, copying `RevisionTimelineModal`: `/compare` 404s while
// ITP_PROVENANCE_ENABLED is unset, and the modal then says so rather than
// rendering an empty diff that reads as "these two versions are identical".
import { useQuery } from '@tanstack/react-query';

import { ApiError, apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/ui/Modal';
import { queryKeys } from '@/lib/queryKeys';

interface ChecklistDiff {
  added: number;
  removed: number;
  changed: number;
  items: { change: 'added' | 'removed' | 'changed'; description: string }[];
}

interface CompareResponse {
  base: Record<string, string | number | boolean | null>;
  against: Record<string, string | number | boolean | null>;
  metadata: {
    field: string;
    base: string | number | boolean | null;
    against: string | number | boolean | null;
  }[];
  checklist: ChecklistDiff | null;
  descriptionPairing: string;
}

interface TemplateCompareModalProps {
  projectId: string;
  baseId: string;
  againstId: string;
  baseLabel: string;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  activityType: 'Activity',
  specificationReference: 'Specification',
  stateSpec: 'Spec set',
  authority: 'Authority',
  specEdition: 'Spec edition',
  specIssuedOn: 'Spec issued',
  effectiveFrom: 'Effective from',
  reviewDueOn: 'Review due',
  changeSummary: 'What changed',
  annexureWarning: 'Annexure caveat',
};

const CHANGE_STYLES: Record<ChecklistDiff['items'][number]['change'], string> = {
  added: 'text-emerald-700 dark:text-emerald-400',
  removed: 'text-destructive',
  changed: 'text-amber-700 dark:text-amber-400',
};

function formatCell(value: string | number | boolean | null): string {
  if (value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Date(value).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return String(value);
}

export function TemplateCompareModal({
  projectId,
  baseId,
  againstId,
  baseLabel,
  onClose,
}: TemplateCompareModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.itpTemplateCompare(projectId, baseId, againstId),
    queryFn: () =>
      apiGet<CompareResponse>(
        `/api/itp/templates/${encodeURIComponent(baseId)}/compare` +
          `?against=${encodeURIComponent(againstId)}&projectId=${encodeURIComponent(projectId)}`,
      ),
    retry: false,
  });

  const provenanceDisabled = error instanceof ApiError && error.status === 404;

  return (
    <Modal onClose={onClose} className="max-w-3xl">
      <ModalHeader>Compare versions — {baseLabel}</ModalHeader>
      <ModalBody>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comparison…</p>
        ) : provenanceDisabled ? (
          <p className="text-sm text-muted-foreground">
            Version comparison is not switched on for this environment yet.
          </p>
        ) : error ? (
          <p className="text-sm text-destructive" role="alert">
            Could not compare these versions.
          </p>
        ) : !data ? null : (
          <div className="space-y-6">
            <section>
              <h4 className="text-sm font-semibold mb-2">Template details</h4>
              {data.metadata.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing differs in the template details.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-1 pr-4 font-medium">Field</th>
                        <th className="py-1 pr-4 font-medium">This version</th>
                        <th className="py-1 font-medium">Other version</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.metadata.map((row) => (
                        <tr key={row.field} className="border-t">
                          <td className="py-1 pr-4">{FIELD_LABELS[row.field] ?? row.field}</td>
                          <td className="py-1 pr-4">{formatCell(row.base)}</td>
                          <td className="py-1 font-medium">{formatCell(row.against)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h4 className="text-sm font-semibold mb-2">Checklist</h4>
              {!data.checklist ? (
                <p className="text-sm text-muted-foreground">
                  The checklist is identical in both versions.
                </p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    {data.checklist.added} added · {data.checklist.removed} removed ·{' '}
                    {data.checklist.changed} changed
                  </p>
                  <ul className="space-y-1 text-sm">
                    {data.checklist.items.map((item, index) => (
                      <li key={`${item.change}-${index}`} className={CHANGE_STYLES[item.change]}>
                        <span className="uppercase text-xs tracking-wide mr-2">{item.change}</span>
                        {item.description}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {/* The inherited limitation, stated rather than hidden: pairing is
                  by description, so a reworded row reads as removed + added. */}
              <p className="text-xs text-muted-foreground mt-3">{data.descriptionPairing}</p>
            </section>
          </div>
        )}
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
