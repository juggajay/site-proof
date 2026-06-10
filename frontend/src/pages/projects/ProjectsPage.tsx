import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Modal, ModalHeader, ModalDescription, ModalBody } from '@/components/ui/Modal';
import {
  isOptionalNonNegativeDecimalInput,
  parseOptionalNonNegativeDecimalInput,
} from '@/lib/numericInput';
import { getCompanyRole, hasSubcontractorPortalIdentity } from '@/lib/subcontractorIdentity';
import { ROLE_GROUPS, hasRoleInGroup } from '@/lib/roles';
import { SPECIFICATION_SET_HELPER_TEXT } from './settings/types';

interface Project {
  id: string;
  name: string;
  projectNumber: string;
  status: string;
  startDate?: string;
  targetCompletion?: string;
  createdAt: string;
}

const STATE_OPTIONS = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'NT', label: 'Northern Territory' },
  { value: 'ACT', label: 'Australian Capital Territory' },
];

const SPEC_SET_OPTIONS = [
  { value: 'Austroads', label: 'Austroads (National)' },
  { value: 'TfNSW', label: 'TfNSW (NSW)' },
  { value: 'MRTS', label: 'MRTS (QLD)' },
  { value: 'VicRoads', label: 'VicRoads (VIC)' },
  { value: 'DIT', label: 'DIT (SA)' },
  { value: 'MRWA', label: 'Main Roads WA' },
  { value: 'custom', label: 'Custom' },
];

// Status configuration with colors and descriptions.
// Quiet Authority: benign lifecycle states are MONOCHROME; colour is reserved
// for decisions/exceptions. `on_hold` is a soft exception (warning); only
// `cancelled` is a hard exception (destructive).
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; description: string }> = {
  active: {
    color: 'text-foreground',
    bgColor: 'bg-muted',
    description: 'Project is currently in progress with ongoing work',
  },
  completed: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Project has been completed successfully',
  },
  on_hold: {
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    description: 'Project is temporarily paused',
  },
  pending: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Project is awaiting approval or resources to start',
  },
  cancelled: {
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
    description: 'Project has been cancelled',
  },
  draft: {
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    description: 'Project is in draft status, not yet active',
  },
};

const DEFAULT_STATUS_CONFIG = {
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
  description: 'Project status',
};

const EMPTY_PROJECT_FORM = {
  name: '',
  projectNumber: '',
  client: '',
  state: '',
  specSet: '',
  startDate: '',
  targetCompletion: '',
  contractValue: '',
};

function formatStatusLabel(status: string | null | undefined): string {
  const normalized = status?.trim();
  if (!normalized) return 'Draft';

  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function ProjectsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isSubcontractor = hasSubcontractorPortalIdentity(user);

  const {
    data: projectsData,
    isLoading: loading,
    error: queryError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: Project[] }>('/api/projects'),
    enabled: !!user && !isSubcontractor,
  });

  const projects = projectsData?.projects || [];
  const error = queryError ? extractErrorMessage(queryError, 'Failed to load projects') : null;

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_PROJECT_FORM);
  const scheduleError =
    formData.startDate &&
    formData.targetCompletion &&
    formData.startDate > formData.targetCompletion
      ? 'Target completion must be on or after the start date.'
      : null;
  const contractValueError = !isOptionalNonNegativeDecimalInput(formData.contractValue)
    ? 'Contract value must be a non-negative decimal number.'
    : null;

  const createProjectMutation = useMutation({
    mutationFn: (projectData: typeof formData) => {
      const parsedContractValue = parseOptionalNonNegativeDecimalInput(projectData.contractValue);

      return apiFetch<{ project: Project }>('/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          name: projectData.name.trim(),
          projectNumber: projectData.projectNumber.trim() || null,
          clientName: projectData.client.trim() || null,
          state: projectData.state || null,
          specificationSet: projectData.specSet || null,
          startDate: projectData.startDate || null,
          targetCompletion: projectData.targetCompletion || null,
          contractValue: parsedContractValue,
        }),
      });
    },
    onSuccess: ({ project }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      setFormData(EMPTY_PROJECT_FORM);
      setShowCreateModal(false);
      setCreateError(null);
      navigate(`/projects/${encodeURIComponent(project.id)}`);
    },
    onError: (err) => {
      setCreateError(extractErrorMessage(err, 'Failed to create project'));
    },
  });

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (
      creating ||
      !formData.name.trim() ||
      !formData.projectNumber.trim() ||
      scheduleError ||
      contractValueError
    )
      return;
    createProjectMutation.mutate(formData);
  };

  const creating = createProjectMutation.isPending;
  const canCreateProject = Boolean(
    formData.name.trim() && formData.projectNumber.trim() && !scheduleError && !contractValueError,
  );

  // Self-signup users have no company yet, so the backend rejects project
  // creation. Send them to set up their company first instead of letting them
  // fill in the form and hit a raw 403. Subcontractors join via invites and are
  // redirected to their portal below, so they never see this.
  const needsCompanySetup = !isSubcontractor && !user?.companyId;
  const goToCompanySetup = () => navigate('/onboarding');

  // Mirrors the backend PROJECT_CREATOR_ROLES (owner/admin/project_manager) so
  // we never offer a "New Project"/"Create Project" button to a company member
  // (e.g. an invited foreman) whose POST /api/projects the API would reject.
  // Such members instead get an honest empty state when they have no project
  // membership yet, rather than a dead-end create button or a blank page.
  const canCreateProjects = hasRoleInGroup(getCompanyRole(user), ROLE_GROUPS.ADMIN);
  const companyLabel = user?.companyName?.trim() || 'your company';

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    setCreateError(null);
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setShowCreateModal(false);
    setCreateError(null);
    setFormData(EMPTY_PROJECT_FORM);
  };

  // Subcontractors don't have a head-contractor projects list; send them to
  // their portal. This must run before the loading branch: their projects query
  // is disabled (enabled: false), which keeps isLoading true forever on
  // TanStack Query v4, so gating the redirect behind `loading` would trap them
  // on a perpetual skeleton instead of redirecting.
  if (isSubcontractor) {
    return <Navigate to="/subcontractor-portal" replace />;
  }

  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading projects">
        <span className="sr-only">Loading projects...</span>
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-64 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-10 w-32 rounded-lg bg-muted animate-pulse" />
        </div>
        {/* Projects grid skeleton */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 rounded bg-muted animate-pulse" />
                <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
              </div>
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
              <div className="flex gap-2 pt-2">
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
                <div className="h-8 w-20 rounded bg-muted animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Projects</h1>
        {needsCompanySetup ? (
          <Button onClick={goToCompanySetup}>Set up your company</Button>
        ) : canCreateProjects ? (
          <Button onClick={openCreateModal}>New Project</Button>
        ) : null}
      </div>
      <p className="text-muted-foreground">Manage your civil construction projects.</p>

      {/* Create Project Modal */}
      {showCreateModal && (
        <Modal onClose={closeCreateModal} className="max-w-lg">
          <ModalHeader>Create New Project</ModalHeader>
          <ModalDescription>
            Enter the project details your team will use across lots, quality records, and reports.
          </ModalDescription>
          <ModalBody>
            {createError && (
              <div
                role="alert"
                className="mb-4 p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-sm"
              >
                {createError}
              </div>
            )}
            {(scheduleError || contractValueError) && (
              <div
                role="alert"
                className="mb-4 p-3 bg-warning/10 border border-warning/20 text-warning rounded-lg text-sm"
              >
                {scheduleError || contractValueError}
              </div>
            )}

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <Label htmlFor="project-create-name" className="mb-1">
                  Project Name *
                </Label>
                <Input
                  type="text"
                  id="project-create-name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Highway Upgrade Project"
                />
              </div>

              <div>
                <Label htmlFor="project-create-number" className="mb-1">
                  Project Number *
                </Label>
                <Input
                  type="text"
                  id="project-create-number"
                  name="projectNumber"
                  value={formData.projectNumber}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., PRJ-2024-001"
                />
              </div>

              <div>
                <Label htmlFor="project-create-client" className="mb-1">
                  Client
                </Label>
                <Input
                  type="text"
                  id="project-create-client"
                  name="client"
                  value={formData.client}
                  onChange={handleInputChange}
                  placeholder="e.g., Department of Transport"
                />
              </div>

              <div>
                <Label htmlFor="project-create-contract-value" className="mb-1">
                  Contract Value ($)
                </Label>
                <Input
                  type="number"
                  id="project-create-contract-value"
                  name="contractValue"
                  value={formData.contractValue}
                  onChange={handleInputChange}
                  placeholder="e.g., 5000000"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label htmlFor="project-create-start-date" className="mb-1">
                  Start Date
                </Label>
                <Input
                  type="date"
                  id="project-create-start-date"
                  name="startDate"
                  value={formData.startDate}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="project-create-target-completion" className="mb-1">
                  Target Completion
                </Label>
                <Input
                  type="date"
                  id="project-create-target-completion"
                  name="targetCompletion"
                  value={formData.targetCompletion}
                  onChange={handleInputChange}
                />
              </div>

              <div>
                <Label htmlFor="project-create-state" className="mb-1">
                  State
                </Label>
                <NativeSelect
                  id="project-create-state"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                >
                  <option value="">Select state</option>
                  {STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              <div>
                <Label htmlFor="project-create-spec-set" className="mb-1">
                  Specification Set
                </Label>
                <NativeSelect
                  id="project-create-spec-set"
                  name="specSet"
                  value={formData.specSet}
                  onChange={handleInputChange}
                >
                  <option value="">Select specification set</option>
                  {SPEC_SET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="mt-1 text-xs text-muted-foreground">
                  {SPECIFICATION_SET_HELPER_TEXT}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={closeCreateModal}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating || !canCreateProject}>
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              </div>
            </form>
          </ModalBody>
        </Modal>
      )}

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void refetchProjects()}
            >
              Try again
            </Button>
          </div>
        </div>
      )}

      {!error && needsCompanySetup ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <h3 className="text-lg font-medium">Set up your company to get started</h3>
          <p className="mt-1 text-muted-foreground">
            Create your company profile first. It will own your projects, team, and quality records.
          </p>
          <Button className="mt-4" onClick={goToCompanySetup}>
            Set up your company
          </Button>
        </div>
      ) : !error && projects.length === 0 && canCreateProjects ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="mt-1 text-muted-foreground">Create a new project to get started.</p>
          <Button className="mt-4" onClick={openCreateModal}>
            Create Project
          </Button>
        </div>
      ) : !error && projects.length === 0 ? (
        // Company member (e.g. an invited foreman) who can't create projects and
        // hasn't been added to a project team yet. Without this, they'd land on a
        // blank Projects page with a create button the API rejects, and the app
        // would look broken at first touch. Give honest guidance instead of a void.
        <div className="text-center py-12 bg-card rounded-lg border">
          <h3 className="text-lg font-medium">No projects yet</h3>
          <p className="mt-1 text-muted-foreground">
            You&rsquo;re part of {companyLabel}, but you haven&rsquo;t been added to a project yet.
            Ask your project admin to add you to a project team &mdash; then it will show up here.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void refetchProjects()}
          >
            Refresh
          </Button>
        </div>
      ) : !error ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${encodeURIComponent(project.id)}`}
              data-testid="project-card"
              className="block p-6 bg-card rounded-lg border hover:border-primary hover:shadow-md transition-all"
            >
              <h3 className="text-lg font-semibold">{project.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">{project.projectNumber}</p>
              <div className="mt-4 flex items-center justify-between">
                {(() => {
                  const statusKey = project.status?.toLowerCase() || 'draft';
                  const config = STATUS_CONFIG[statusKey] || DEFAULT_STATUS_CONFIG;
                  const statusLabel = formatStatusLabel(project.status);
                  return (
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color} cursor-help`}
                      title={config.description}
                    >
                      <span className="inline-flex items-center gap-1">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            statusKey === 'on_hold'
                              ? 'bg-warning'
                              : statusKey === 'cancelled'
                                ? 'bg-destructive'
                                : 'bg-muted-foreground'
                          }`}
                        />
                        {statusLabel}
                      </span>
                    </span>
                  );
                })()}
                <span className="text-xs text-muted-foreground">View project →</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
