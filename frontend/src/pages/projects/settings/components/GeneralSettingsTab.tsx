import { useState, useEffect, useRef } from 'react';
import { Save } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { extractErrorMessage } from '@/lib/errorHandling';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Project, GeneralFormData } from '../types';
import { DEFAULT_FORM_DATA } from '../types';
import {
  parseOptionalNonNegativeDecimalInput,
  parsePositiveIntegerInput,
} from '@/lib/numericInput';

interface GeneralSettingsTabProps {
  projectId: string;
  project: Project;
  canViewContractValue: boolean;
  onProjectUpdate: (project: Project) => void;
}

export function GeneralSettingsTab({
  projectId,
  project,
  canViewContractValue,
  onProjectUpdate,
}: GeneralSettingsTabProps) {
  const [formData, setFormData] = useState<GeneralFormData>({ ...DEFAULT_FORM_DATA });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const savingRef = useRef(false);
  const saveSuccessTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
    };
  }, []);

  // Initialize form data from project
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || '',
        code: project.code || '',
        lotPrefix: project.lotPrefix || 'LOT-',
        lotStartingNumber: String(project.lotStartingNumber || 1),
        ncrPrefix: project.ncrPrefix || 'NCR-',
        ncrStartingNumber: String(project.ncrStartingNumber || 1),
        chainageStart: String(project.chainageStart ?? 0),
        chainageEnd: String(project.chainageEnd ?? 10000),
        workingHoursStart: project.workingHoursStart || '06:00',
        workingHoursEnd: project.workingHoursEnd || '18:00',
      });
    }
  }, [project]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear success message when user starts typing
    if (saveSuccess) setSaveSuccess(false);
  };

  const handleSaveSettings = async () => {
    if (savingRef.current) return;

    setSaveError('');
    setSaveSuccess(false);

    const nextFormData: GeneralFormData = {
      ...formData,
      name: formData.name.trim(),
      code: formData.code.trim(),
      lotPrefix: formData.lotPrefix.trim(),
      ncrPrefix: formData.ncrPrefix.trim(),
    };
    const lotStartingNumber = parsePositiveIntegerInput(nextFormData.lotStartingNumber);
    const ncrStartingNumber = parsePositiveIntegerInput(nextFormData.ncrStartingNumber);
    const chainageStart = parseOptionalNonNegativeDecimalInput(nextFormData.chainageStart);
    const chainageEnd = parseOptionalNonNegativeDecimalInput(nextFormData.chainageEnd);

    // Client-side validation
    if (!nextFormData.name) {
      setSaveError('Project name is required');
      return;
    }

    if (nextFormData.lotPrefix.length > 50) {
      setSaveError('Lot prefix must be 50 characters or less');
      return;
    }

    if (nextFormData.ncrPrefix.length > 50) {
      setSaveError('NCR prefix must be 50 characters or less');
      return;
    }

    if (lotStartingNumber === null) {
      setSaveError('Lot starting number must be a positive integer');
      return;
    }

    if (ncrStartingNumber === null) {
      setSaveError('NCR starting number must be a positive integer');
      return;
    }

    if (chainageStart === null) {
      setSaveError('Chainage start must be a non-negative decimal number');
      return;
    }

    if (chainageEnd === null) {
      setSaveError('Chainage end must be a non-negative decimal number');
      return;
    }

    if (chainageStart >= chainageEnd) {
      setSaveError('Chainage end must be greater than chainage start');
      return;
    }

    if (nextFormData.workingHoursStart >= nextFormData.workingHoursEnd) {
      setSaveError('Working hours end must be later than working hours start');
      return;
    }

    if (!projectId) {
      setSaveError('Project not found');
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const data = await apiFetch<{ project: Project }>(
        `/api/projects/${encodeURIComponent(projectId)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            name: nextFormData.name,
            code: nextFormData.code,
            lotPrefix: nextFormData.lotPrefix,
            lotStartingNumber,
            ncrPrefix: nextFormData.ncrPrefix,
            ncrStartingNumber,
            chainageStart,
            chainageEnd,
            workingHoursStart: nextFormData.workingHoursStart,
            workingHoursEnd: nextFormData.workingHoursEnd,
          }),
        },
      );
      onProjectUpdate(data.project);
      setSaveSuccess(true);
      setFormData(nextFormData);
      // Auto-hide success message after 3 seconds
      if (saveSuccessTimeoutRef.current) {
        clearTimeout(saveSuccessTimeoutRef.current);
      }
      saveSuccessTimeoutRef.current = setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(extractErrorMessage(error, 'Failed to save settings'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      {/* Save Status Messages */}
      {saveError && (
        <div
          role="alert"
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive mb-4"
        >
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div role="status" className="rounded-lg bg-green-100 p-3 text-sm text-green-700 mb-4">
          Settings saved successfully!
        </div>
      )}

      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">General Settings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure project name, number, and basic settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-settings-name" className="mb-1">
              Project Name
            </Label>
            <Input
              id="project-settings-name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Project name"
            />
          </div>
          <div>
            <Label htmlFor="project-settings-code" className="mb-1">
              Project Code
            </Label>
            <Input
              id="project-settings-code"
              type="text"
              name="code"
              value={formData.code}
              onChange={handleInputChange}
              placeholder="PRJ-001"
            />
          </div>
        </div>
        {(project?.startDate || project?.targetCompletion) && (
          <div className="mt-4 pt-4 border-t grid gap-4 sm:grid-cols-2">
            {project?.startDate && (
              <div>
                <Label className="mb-1">Start Date</Label>
                <div className="text-sm text-muted-foreground">
                  {new Date(project.startDate).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
            {project?.targetCompletion && (
              <div>
                <Label className="mb-1">Target Completion</Label>
                <div className="text-sm text-muted-foreground">
                  {new Date(project.targetCompletion).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {canViewContractValue && project?.contractValue && (
          <div className="mt-4 pt-4 border-t">
            <Label className="mb-1">Contract Value</Label>
            <div className="text-sm text-muted-foreground">
              $
              {Number(project.contractValue).toLocaleString('en-AU', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>
        )}
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Lot Numbering</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure lot numbering convention and auto-increment settings.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-settings-lot-prefix" className="mb-1">
              Lot Prefix
            </Label>
            <Input
              id="project-settings-lot-prefix"
              type="text"
              name="lotPrefix"
              value={formData.lotPrefix}
              onChange={handleInputChange}
              placeholder="LOT-"
            />
          </div>
          <div>
            <Label htmlFor="project-settings-lot-starting-number" className="mb-1">
              Lot Starting Number
            </Label>
            <Input
              id="project-settings-lot-starting-number"
              type="number"
              name="lotStartingNumber"
              value={formData.lotStartingNumber}
              onChange={handleInputChange}
              placeholder="1"
              min="1"
              step="1"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">NCR Numbering</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure non-conformance report numbering convention.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-settings-ncr-prefix" className="mb-1">
              NCR Prefix
            </Label>
            <Input
              id="project-settings-ncr-prefix"
              type="text"
              name="ncrPrefix"
              value={formData.ncrPrefix}
              onChange={handleInputChange}
              placeholder="NCR-"
            />
          </div>
          <div>
            <Label htmlFor="project-settings-ncr-starting-number" className="mb-1">
              NCR Starting Number
            </Label>
            <Input
              id="project-settings-ncr-starting-number"
              type="number"
              name="ncrStartingNumber"
              value={formData.ncrStartingNumber}
              onChange={handleInputChange}
              placeholder="1"
              min="1"
              step="1"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Chainage Configuration</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the chainage range for this project. Lot chainages will be constrained to this
          range.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-settings-chainage-start" className="mb-1">
              Chainage Start (m)
            </Label>
            <Input
              id="project-settings-chainage-start"
              type="number"
              name="chainageStart"
              value={formData.chainageStart}
              onChange={handleInputChange}
              placeholder="0"
              min="0"
              step="0.001"
            />
          </div>
          <div>
            <Label htmlFor="project-settings-chainage-end" className="mb-1">
              Chainage End (m)
            </Label>
            <Input
              id="project-settings-chainage-end"
              type="number"
              name="chainageEnd"
              value={formData.chainageEnd}
              onChange={handleInputChange}
              placeholder="10000"
              min="0"
              step="0.001"
            />
          </div>
        </div>
      </div>
      <div className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-2">Working Hours</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Configure the project's working hours for notifications and due date calculations.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="project-settings-working-hours-start" className="mb-1">
              Start Time
            </Label>
            <Input
              id="project-settings-working-hours-start"
              type="time"
              name="workingHoursStart"
              value={formData.workingHoursStart}
              onChange={handleInputChange}
            />
          </div>
          <div>
            <Label htmlFor="project-settings-working-hours-end" className="mb-1">
              End Time
            </Label>
            <Input
              id="project-settings-working-hours-end"
              type="time"
              name="workingHoursEnd"
              value={formData.workingHoursEnd}
              onChange={handleInputChange}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button type="button" onClick={handleSaveSettings} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </>
  );
}
