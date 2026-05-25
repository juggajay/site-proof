import { ArrowLeft, Briefcase, FolderKanban, LayoutDashboard, SearchX } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

export function NotFoundPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const projectId = location.pathname.match(/^\/projects\/([^/]+)/)?.[1];
  const isSubcontractorPath = location.pathname.startsWith('/subcontractor-portal');
  const isAuthenticated = Boolean(user);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <main className="w-full max-w-2xl rounded-lg border bg-background p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SearchX className="h-6 w-6" aria-hidden="true" />
        </div>

        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">404</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
          Page not found
        </h1>
        <p className="mt-3 max-w-xl text-muted-foreground">
          This link may be old, mistyped, or no longer available. Use one of the safe paths below to
          get back to your workspace.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {projectId ? (
            <Link
              to={`/projects/${projectId}`}
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Open project dashboard
            </Link>
          ) : null}

          {isSubcontractorPath ? (
            <Link
              to="/subcontractor-portal"
              className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
            >
              <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Back to subcontractor portal
            </Link>
          ) : null}

          {isAuthenticated ? (
            <>
              <Link
                to="/projects"
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <FolderKanban className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                View projects
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Back to dashboard
              </Link>
            </>
          ) : (
            <>
              <Link
                to={`/login?redirect=${encodeURIComponent(location.pathname)}`}
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Sign in
              </Link>
              <Link
                to="/landing"
                className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-card-foreground transition-colors hover:bg-muted"
              >
                <Briefcase className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                View SiteProof
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Go back
        </button>
      </main>
    </div>
  );
}
