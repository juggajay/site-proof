/**
 * The three list sections of the NCR trends page (Wave G G5, spec §5).
 *
 * Split out of `NCRAnalyticsPage` so the page reads as a layout and each list
 * carries its own empty state next to the list it describes. Every one of these
 * is presentational — the counts, the caps and the folding all happen
 * server-side, so a number here cannot disagree with a number in a report.
 */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { NcrAnalytics, RecurringChecklistItem } from './ncrAnalyticsTypes';

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function RepeatIssuesSection({ section }: { section: NcrAnalytics['repeatIssues'] }) {
  return (
    <SectionCard title={section.title} description={section.description}>
      {section.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing has recurred yet — no category and root cause pairing appears twice.
        </p>
      ) : (
        <ul className="divide-y">
          {section.data.map((issue) => (
            <li
              key={`${issue.category}-${issue.rootCause}`}
              className="flex items-center justify-between py-2"
            >
              <span className="text-sm">
                {issue.categoryLabel} · {issue.rootCauseLabel}
              </span>
              <Badge variant="secondary">{issue.count} NCRs</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function RepeatOffendersSection({ section }: { section: NcrAnalytics['repeatOffenders'] }) {
  return (
    <SectionCard title={section.title} description={section.description}>
      {section.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No subcontractor carries two or more NCRs on this project.
        </p>
      ) : (
        <ul className="divide-y">
          {section.data.map((offender) => (
            <li
              key={offender.subcontractorId}
              className="flex items-center justify-between gap-4 py-2"
            >
              <div>
                <div className="text-sm font-medium">{offender.subcontractorName}</div>
                <div className="text-xs text-muted-foreground">
                  {offender.categoryCount} categor{offender.categoryCount === 1 ? 'y' : 'ies'}
                </div>
              </div>
              <Badge variant="secondary">{offender.ncrCount} NCRs</Badge>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

export function RecurringItemsSection({
  section,
  onPropose,
}: {
  section: NcrAnalytics['recurringItems'];
  onPropose: (item: RecurringChecklistItem) => void;
}) {
  const coverage = section.coverage;

  return (
    <SectionCard title={section.title} description={section.description}>
      {/* Stated, not implied: the checklist-item link only exists for NCRs
          raised from a failed ITP item, so the section says how much of the
          corpus it can actually see. */}
      <p className="text-xs text-muted-foreground">
        Based on {coverage.linked} of {coverage.total} NCRs — only NCRs raised from a failed ITP
        item carry the link back to a checklist item.
        {coverage.itemsWithoutLineage > 0
          ? ` ${coverage.itemsWithoutLineage} of ${coverage.itemsObserved} items predate template lineage and are counted on their own.`
          : ''}
      </p>

      {section.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No checklist item has failed twice yet.</p>
      ) : (
        <ul className="divide-y">
          {section.data.map((item) => (
            <li
              key={item.rootChecklistItemId}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.description}</div>
                <div className="text-xs text-muted-foreground">
                  {item.templateName ? `${item.templateName} · ` : ''}
                  failed {item.ncrCount} times across {item.subcontractorCount} subcontractor
                  {item.subcontractorCount === 1 ? '' : 's'}
                  {item.activitySlugs.length > 0 ? ` · ${item.activitySlugs.join(', ')}` : ''}
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => onPropose(item)}>
                Propose a template change
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
