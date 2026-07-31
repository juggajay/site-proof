// Type surface for `provenance.mjs`, which stays plain ESM because the seeders
// it serves are plain `.js` run by `node` with no build step.

export interface TemplateProvenanceEntry {
  specEdition?: string;
  specIssuedOn?: string;
  effectiveFrom?: string;
  reviewDueOn?: string;
  changeSummary?: string;
  annexureWarning?: boolean;
  /** `filename.js:LINE` of the header comment the values were read from. */
  source: string;
}

export interface ResolvedTemplateProvenance {
  authority: string | null;
  specEdition: string | null;
  specIssuedOn: Date | null;
  effectiveFrom: Date | null;
  reviewDueOn: Date | null;
  changeSummary: string | null;
  annexureWarning: boolean;
}

export declare const AUTHORITY_BY_STATE_SPEC: Record<string, string>;
export declare const TEMPLATE_PROVENANCE: Record<string, TemplateProvenanceEntry>;
export declare function provenanceFor(
  name: string,
  stateSpec: string,
): ResolvedTemplateProvenance;
