import { useState } from 'react';
import { Link } from 'react-router-dom';
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

// Status configuration with colors and descriptions
const STATUS_CONFIG: Record<string, { color: string; bgColor: string; description: string }> = {
  active: {
    color: 'text-green-800 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-900/30',
    description: 'Project is currently in progress with ongoing work',
  },
  completed: {
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    description: 'Project has been completed successfully',
  },
  on_hold: {
    color: 'text-amber-800 dark:text-amber-300',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    description: 'Project is temporarily paused',
  },
  pending: {
    color: 'text-purple-800 dark:text-purple-300',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30',
    description: 'Project is awaiting approval or resources to start',
  },
  cancelled: {
    color: 'text-red-800 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-900/30',
    description: 'Project has been cancelled',
  },
  draft: {
    color: 'text-foreground',
    bgColor: 'bg-muted',
    description: 'Project is in draft status, not yet active',
  },
};

const DEFAULT_STATUS_CONFIG = {
  color: 'text-foreground',
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

  const {
    data: projectsData,
    isLoading: loading,
    error: queryError,
    refetch: refetchProjects,
  } = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => apiFetch<{ projects: Project[] }>('/api/projects'),
    enabled: !!user,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      setFormData(EMPTY_PROJECT_FORM);
      setShowCreateModal(false);
      setCreateError(null);
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
        <Button onClick={openCreateModal}>New Project</Button>
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
                className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm"
              >
                {createError}
              </div>
            )}
            {(scheduleError || contractValueError) && (
              <div
                role="alert"
                className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm"
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
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
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

      {!error && projects.length === 0 ? (
        <div className="text-center py-12 bg-card rounded-lg border">
          <h3 className="text-lg font-medium">No projects found</h3>
          <p className="mt-1 text-muted-foreground">Create a new project to get started.</p>
          <Button className="mt-4" onClick={openCreateModal}>
            Create Project
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
                            statusKey === 'active'
                              ? 'bg-green-500'
                              : statusKey === 'completed'
                                ? 'bg-primary'
                                : statusKey === 'on_hold'
                                  ? 'bg-amber-500'
                                  : statusKey === 'pending'
                                    ? 'bg-purple-500'
                                    : statusKey === 'cancelled'
                                      ? 'bg-red-500'
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
