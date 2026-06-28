import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import type { Project } from './types';

export function ProjectAdminStatusBanners({
  project,
  canManage,
  readOnly,
  deniedMessage,
  archivedMessage,
}: {
  project: Project | null;
  canManage: boolean;
  readOnly: boolean;
  deniedMessage: string;
  archivedMessage: string;
}) {
  if (!project) return null;

  if (!canManage) {
    return (
      <div
        className="mb-6 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
        role="alert"
      >
        {deniedMessage}
      </div>
    );
  }

  if (!readOnly) return null;

  return (
    <div role="status" className="mb-6 rounded-lg bg-warning/10 p-3 text-sm text-warning">
      {archivedMessage}
    </div>
  );
}

export function ProjectAdminLoadError({
  message,
  onRetry,
}: {
  message: string | null;
  onRetry: () => void;
}) {
  if (!message) return null;

  return (
    <div
      className="mb-6 flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
      role="alert"
    >
      <span>{message}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function ProjectAdminResourceGate({
  loading,
  loadError,
  canManage,
  children,
}: {
  loading: boolean;
  loadError: string | null;
  canManage: boolean;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loadError || !canManage) return null;

  return <>{children}</>;
}
