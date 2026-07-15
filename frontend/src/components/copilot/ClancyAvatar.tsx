import { cn } from '@/lib/utils';

/**
 * Clancy's mark: a clean "C" monogram on a zinc-900 chip with the CIVOS brand-blue
 * accent. Deliberately dark in both themes — it reads as a persistent brand
 * object, not a themed surface. No emoji, no face.
 */
export function ClancyAvatar({
  className,
  letterClassName,
}: {
  className?: string;
  letterClassName?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center rounded-full bg-zinc-900 text-white ring-1 ring-white/10',
        className,
      )}
      aria-hidden="true"
    >
      <span className={cn('font-semibold leading-none tracking-tight', letterClassName)}>C</span>
      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
    </span>
  );
}
