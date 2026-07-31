// Wave G G2 — what a template was written against, on the surfaces that matter
// (docs/plans/wave-g-execution-spec-2026-07-31.md §2.2(a),(b),(f)).
//
// Every field is optional and the component renders nothing when the library
// asserts nothing. That is not a placeholder — most jurisdictions' seeders name
// a specification without naming an edition, and a blank line is the honest
// rendering of "the source document does not say".
//
// The backend strips these fields entirely while ITP_PROVENANCE_ENABLED is off,
// so there is no flag to read here.

export interface TemplateProvenanceFields {
  authority?: string | null;
  specEdition?: string | null;
  specIssuedOn?: string | null;
  effectiveFrom?: string | null;
  specificationReference?: string | null;
  annexureWarning?: boolean;
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function TemplateProvenance({
  authority,
  specEdition,
  specIssuedOn,
  effectiveFrom,
  specificationReference,
  annexureWarning,
}: TemplateProvenanceFields) {
  const issued = formatDate(specIssuedOn);
  const effective = formatDate(effectiveFrom);

  const parts = [
    authority,
    specEdition ? `edition ${specEdition}` : null,
    issued ? `issued ${issued}` : null,
    effective ? `effective ${effective}` : null,
  ].filter(Boolean);

  if (parts.length === 0 && !annexureWarning) return null;

  return (
    <div className="mt-2 space-y-1">
      {parts.length > 0 && <p className="text-xs text-muted-foreground">{parts.join(' · ')}</p>}
      {annexureWarning && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          This template follows {specificationReference || 'the published specification'}
          {specEdition ? ` ${specEdition}` : ''}. Project annexures may add or vary requirements —
          check your contract annexure.
        </p>
      )}
    </div>
  );
}
