import { Link } from 'react-router-dom';
import { Check, ChevronRight, FolderKanban, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extractErrorMessage } from '@/lib/errorHandling';
import { useCreateSampleProject } from '@/hooks/useCreateSampleProject';
import { deriveSetupSteps, type SetupCounts } from './setupChecklistState';

interface DashboardSetupChecklistProps {
  /** Company-level counts driving each step's tick. */
  counts: SetupCounts;
  /** The sole project id when the company has exactly one, else null (deep links). */
  soleProjectId: string | null;
}

/**
 * First-run setup checklist shown on the dashboard instead of an all-zero KPI
 * grid while the company is still setting up. Every step's tick and link is
 * derived from company counts by `deriveSetupSteps` — nothing is hardcoded.
 */
export function DashboardSetupChecklist({ counts, soleProjectId }: DashboardSetupChecklistProps) {
  const createSampleProject = useCreateSampleProject();
  const steps = deriveSetupSteps(counts, soleProjectId);

  return (
    <section aria-label="Setup checklist" className="rounded-lg border bg-card">
      <div className="border-b p-4">
        <h2 className="text-sm font-semibold">Getting started</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up your first project through to a conformed lot. Your dashboard fills in as work is
          recorded.
        </p>
      </div>
      <ol className="divide-y">
        {steps.map((step, index) => (
          <li key={step.key}>
            <Link
              to={step.to}
              className="touch-target flex items-center gap-4 p-4 transition-colors hover:bg-muted/50"
            >
              <span
                aria-hidden="true"
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                  step.done
                    ? 'border-success bg-success text-success-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {step.done ? <Check className="h-3.5 w-3.5" /> : index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {step.title}
                  {step.done && <span className="sr-only"> (done)</span>}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {step.description}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ol>
      <div className="border-t p-4">
        {createSampleProject.isError && (
          <p role="alert" className="mb-3 text-sm text-destructive">
            {extractErrorMessage(createSampleProject.error, 'Failed to create the example project')}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => createSampleProject.mutate()}
          disabled={createSampleProject.isPending}
          className="w-full sm:w-auto"
        >
          <Sparkles className="h-4 w-4" />
          {createSampleProject.isPending
            ? 'Setting up example project…'
            : '…or explore an example project'}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          We&rsquo;ll add a clearly-labelled example project with lots, an ITP, hold points, an NCR,
          and test results so you can look around with real content. Archive it whenever you like.
        </p>
      </div>
    </section>
  );
}

/**
 * Zero-project dashboard state for company members who cannot create projects
 * (e.g. site managers or viewers who reach the default dashboard before being
 * added to a project team).
 */
export function DashboardMemberSetupNotice() {
  return (
    <section aria-label="No projects yet" className="rounded-lg border bg-card p-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <FolderKanban className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="text-lg font-semibold">No projects yet</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Your projects will appear here once your team adds you. Ask your project manager or admin to
        add you to a project team.
      </p>
    </section>
  );
}
