import { activitiesByFamily, isCanonicalActivitySlug } from '@/lib/activityTaxonomy';

interface ActivityTypeOptionsProps {
  /**
   * The form's current stored value. When it is a legacy/free-text value (not a
   * canonical slug), a disabled option is rendered at the top so the select
   * shows the real value without offering it — nudging a reclassification while
   * still allowing an unchanged save. Retired values (e.g. `Concrete`) are never
   * offered as a selectable option.
   */
  currentValue?: string | null;
}

/**
 * The canonical activity picker's `<option>`/`<optgroup>` children, shared by
 * every activity dropdown (lot create/edit, bulk create, ITP template forms).
 * Render inside a `<select>` or `<NativeSelect>` that owns value/onChange or the
 * rhf `register()` — this component only supplies the grouped options.
 */
export function ActivityTypeOptions({ currentValue }: ActivityTypeOptionsProps) {
  const showLegacy = !!currentValue && !isCanonicalActivitySlug(currentValue);
  return (
    <>
      {showLegacy && (
        <option value={currentValue as string} disabled>
          {currentValue} (legacy — choose the specific activity)
        </option>
      )}
      {activitiesByFamily()
        .filter((group) => group.activities.length > 0)
        .map((group) => (
          <optgroup key={group.slug} label={group.displayName}>
            {group.activities.map((activity) => (
              <option key={activity.slug} value={activity.slug}>
                {activity.displayName}
              </option>
            ))}
          </optgroup>
        ))}
    </>
  );
}
