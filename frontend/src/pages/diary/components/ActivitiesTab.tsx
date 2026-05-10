import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '@/lib/api';
import { logError } from '@/lib/logger';
import {
  getOptionalDiaryQuantityError,
  parseOptionalDiaryQuantityInput,
} from '../diaryNumericInput';
import type { DailyDiary, Activity, ActivityFormState, Lot } from '../types';

interface ActivitiesTabProps {
  diary: DailyDiary;
  projectId: string;
  lots: Lot[];
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onDiaryUpdate: (diary: DailyDiary) => void;
}

export const ActivitiesTab = React.memo(function ActivitiesTab({
  diary,
  projectId,
  lots,
  saving,
  setSaving,
  onDiaryUpdate,
}: ActivitiesTabProps) {
  const [activityForm, setActivityForm] = useState<ActivityFormState>({
    description: '',
    lotId: '',
    quantity: '',
    unit: '',
    notes: '',
  });
  const quantityError = getOptionalDiaryQuantityError(activityForm.quantity);

  const addActivity = async () => {
    const description = activityForm.description.trim();
    if (!description || quantityError || saving) return;
    const quantity = parseOptionalDiaryQuantityInput(activityForm.quantity);
    setSaving(true);
    try {
      const activity = await apiFetch<Activity>(
        `/api/diary/${encodeURIComponent(diary.id)}/activities`,
        {
          method: 'POST',
          body: JSON.stringify({
            description,
            lotId: activityForm.lotId || undefined,
            quantity: quantity ?? undefined,
            unit: activityForm.unit.trim() || undefined,
            notes: activityForm.notes.trim() || undefined,
          }),
        },
      );

      onDiaryUpdate({ ...diary, activities: [...diary.activities, activity] });
      setActivityForm({ description: '', lotId: '', quantity: '', unit: '', notes: '' });
    } catch (err) {
      logError('Error adding activity:', err);
    } finally {
      setSaving(false);
    }
  };

  const removeActivity = async (activityId: string) => {
    try {
      await apiFetch(
        `/api/diary/${encodeURIComponent(diary.id)}/activities/${encodeURIComponent(activityId)}`,
        {
          method: 'DELETE',
        },
      );
      onDiaryUpdate({ ...diary, activities: diary.activities.filter((a) => a.id !== activityId) });
    } catch (err) {
      logError('Error removing activity:', err);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Activities</h3>

      {/* Activities List */}
      {diary.activities.length > 0 && (
        <div className="mb-6 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b text-left text-sm text-muted-foreground">
                <th className="pb-2">Description</th>
                <th className="pb-2">Lot</th>
                <th className="pb-2">Quantity</th>
                <th className="pb-2">Unit</th>
                <th className="pb-2">Notes</th>
                {diary.status !== 'submitted' && <th className="pb-2"></th>}
              </tr>
            </thead>
            <tbody>
              {diary.activities.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2 font-medium">{a.description}</td>
                  <td className="py-2">
                    {a.lot ? (
                      <Link
                        to={`/projects/${encodeURIComponent(projectId)}/lots/${encodeURIComponent(a.lot.id)}`}
                        className="text-primary hover:text-primary/80 hover:underline font-medium"
                      >
                        {a.lot.lotNumber}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="py-2">{a.quantity || '-'}</td>
                  <td className="py-2">{a.unit || '-'}</td>
                  <td className="py-2">{a.notes || '-'}</td>
                  {diary.status !== 'submitted' && (
                    <td className="py-2">
                      <button
                        onClick={() => removeActivity(a.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Activity Form */}
      {diary.status !== 'submitted' && (
        <div className="rounded-lg border bg-muted/30 p-4">
          <h4 className="mb-3 font-medium">Add Activity</h4>
          <div className="grid gap-3 md:grid-cols-5">
            <input
              type="text"
              value={activityForm.description}
              onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
              placeholder="Description *"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <select
              value={activityForm.lotId}
              onChange={(e) => setActivityForm({ ...activityForm, lotId: e.target.value })}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">Select Lot...</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={activityForm.quantity}
              onChange={(e) => setActivityForm({ ...activityForm, quantity: e.target.value })}
              placeholder="Quantity"
              className={`rounded-md border bg-background px-3 py-2 ${
                quantityError ? 'border-red-500' : 'border-input'
              }`}
            />
            <input
              type="text"
              value={activityForm.unit}
              onChange={(e) => setActivityForm({ ...activityForm, unit: e.target.value })}
              placeholder="Unit (m3, m2, etc.)"
              className="rounded-md border border-input bg-background px-3 py-2"
            />
            <button
              onClick={addActivity}
              disabled={!activityForm.description || Boolean(quantityError) || saving}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {quantityError && (
            <p className="mt-2 text-sm text-red-600" role="alert" aria-live="assertive">
              {quantityError}
            </p>
          )}
        </div>
      )}
    </div>
  );
});
