import { Loader2 } from 'lucide-react';
import { formatStatusLabel } from '@/lib/statusLabels';
import { ShellScreen } from '../../components/ShellScreen';

interface DocketActionStateProps {
  title: string;
  parent: string;
}

export function DocketActionLoading({ title, parent }: DocketActionStateProps) {
  return (
    <ShellScreen variant="inner" title={title} parent={parent} sub={<span>Loading docket</span>}>
      <div className="flex min-h-[220px] items-center justify-center gap-2 text-[14px] font-semibold text-muted-foreground">
        <Loader2 size={18} className="animate-spin" aria-hidden="true" />
        Loading docket…
      </div>
    </ShellScreen>
  );
}

export function DocketActionMissing({ title, parent }: DocketActionStateProps) {
  return (
    <ShellScreen variant="inner" title={title} parent={parent} sub={<span>Not found</span>}>
      <div className="py-16 text-center text-[14px] text-muted-foreground">
        This docket isn’t here anymore.
      </div>
    </ShellScreen>
  );
}

export function DocketActionNotPending({
  title,
  parent,
  status,
}: DocketActionStateProps & { status: string }) {
  return (
    <ShellScreen variant="inner" title={title} parent={parent} sub={<span>Already actioned</span>}>
      <div className="py-16 text-center text-[14px] leading-relaxed text-muted-foreground">
        <p className="font-semibold text-foreground">This docket is no longer pending approval.</p>
        <p className="mt-2">Current status: {formatStatusLabel(status)}.</p>
      </div>
    </ShellScreen>
  );
}
