/**
 * DocketEntrySheets — the labour + plant add-entry bottom sheets for the subbie
 * shell docket surface (/p/docket).
 *
 * Design spec: docs/design-subbie-shell-mock-v1.html #sheetLabour / #sheetPlant.
 * Money logic is NEVER reimplemented here — the live hours + cost preview, the
 * employee/plant approval gate, and the lot-required rule all come from the
 * classic DocketEditPage state hook (useDocketEntrySheetState) and helpers
 * (calculateHours, parseDailyHoursInput) imported from the classic portal.
 *
 * Wrapped in the rebuilt mobile BottomSheet (role=dialog, aria-modal) — we do
 * NOT double-wrap it in another dialog; the sheet provides the title + grab
 * handle + close affordance.
 */
import { Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BottomSheet } from '@/components/foreman/sheets/BottomSheet';
import { formatCurrency } from '@/pages/subcontractor-portal/docketEditDisplay';
import type { Employee, Lot, Plant } from '@/pages/subcontractor-portal/docketEditData';

// Time presets — same start/finish pairs the classic DocketEntrySheet uses.
const TIME_PRESETS = [
  { label: '6–2', start: '06:00', finish: '14:00' },
  { label: '7–3', start: '07:00', finish: '15:00' },
  { label: '7–5', start: '07:00', finish: '17:00' },
  { label: '6–6', start: '06:00', finish: '18:00' },
];

// ── Labour sheet ──────────────────────────────────────────────────────────────

export function LabourSheet({
  open,
  employees,
  selectedEmployee,
  startTime,
  finishTime,
  selectedLotId,
  assignedLots,
  labourHoursError,
  previewHours,
  previewCost,
  saving,
  onSelectEmployee,
  onStartTimeChange,
  onFinishTimeChange,
  onSelectedLotIdChange,
  onClose,
  onAdd,
  onAddAnother,
}: {
  open: boolean;
  /** All roster employees — pending/counter render locked, approved selectable. */
  employees: Employee[];
  selectedEmployee: Employee | null;
  startTime: string;
  finishTime: string;
  selectedLotId: string;
  assignedLots: Lot[];
  labourHoursError: string | null;
  previewHours: number;
  previewCost: number;
  saving: boolean;
  onSelectEmployee: (employee: Employee) => void;
  onStartTimeChange: (value: string) => void;
  onFinishTimeChange: (value: string) => void;
  onSelectedLotIdChange: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
  /** Save this entry but keep the sheet open (times + lot retained). */
  onAddAnother?: () => void;
}) {
  const lotMissing = !selectedLotId;
  const canAdd = Boolean(selectedEmployee) && !lotMissing && !labourHoursError && !saving;

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Add crew hours">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-muted-foreground">Pick who worked, set their times.</p>

        {/* Roster picker — only approved are selectable. */}
        <div className="shell-crewpick">
          {employees.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              No crew on your roster yet. Add crew in My Company.
            </p>
          )}
          {employees.map((emp) => {
            const approved = emp.status === 'approved';
            const selected = selectedEmployee?.id === emp.id;
            return (
              <button
                key={emp.id}
                type="button"
                disabled={!approved}
                onClick={() => approved && onSelectEmployee(emp)}
                aria-pressed={selected}
                className={cn('shell-pickrow', selected && approved && 'on', !approved && 'locked')}
              >
                <span className="grow">
                  <span className="t block truncate">{emp.name}</span>
                  <span className="d block truncate">
                    {approved ? emp.role : 'Rate pending HC approval — can’t be docketed yet'}
                  </span>
                </span>
                {approved ? (
                  <span className="rate">${emp.hourlyRate}/h</span>
                ) : (
                  <span className="shell-badge shell-badge-pend">
                    {emp.status === 'counter' ? 'COUNTER' : 'PENDING'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick time presets */}
        <div>
          <span className="shell-field-label">Quick times</span>
          <div className="shell-presets">
            {TIME_PRESETS.map((p) => {
              const active = startTime === p.start && finishTime === p.finish;
              return (
                <button
                  key={p.label}
                  type="button"
                  className={cn('shell-segbtn', active && 'on')}
                  onClick={() => {
                    onStartTimeChange(p.start);
                    onFinishTimeChange(p.finish);
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Start / finish times */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="shell-field-label" htmlFor="subbie-start-time">
              Start
            </label>
            <input
              id="subbie-start-time"
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="shell-input"
            />
          </div>
          <div>
            <label className="shell-field-label" htmlFor="subbie-finish-time">
              Finish
            </label>
            <input
              id="subbie-finish-time"
              type="time"
              value={finishTime}
              onChange={(e) => onFinishTimeChange(e.target.value)}
              className="shell-input"
            />
          </div>
        </div>
        {labourHoursError && (
          <p className="-mt-1 text-[12.5px] text-destructive">{labourHoursError}</p>
        )}

        {/* Lot allocation — auto-selected when exactly one assigned lot. */}
        <div>
          <span className="shell-field-label">Worked on lot</span>
          {assignedLots.length === 1 ? (
            <div className="shell-pickrow on">
              <span className="grow">
                <span className="t block">{assignedLots[0].lotNumber}</span>
              </span>
              <Check size={18} className="flex-shrink-0 text-success" aria-hidden="true" />
            </div>
          ) : (
            <select
              value={selectedLotId}
              onChange={(e) => onSelectedLotIdChange(e.target.value)}
              className="shell-input"
              aria-label="Allocate to lot"
            >
              <option value="">Select a lot</option>
              {assignedLots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.lotNumber}
                  {lot.activity ? ` — ${lot.activity}` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Live preview */}
        <div className="shell-preview">
          <span className="l">{previewHours} hours</span>
          <span className="v">{formatCurrency(previewCost)}</span>
        </div>

        <button
          type="button"
          className="shell-sheetbtn"
          disabled={!canAdd}
          onClick={onAdd}
          aria-label="Add to docket"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Adding…
            </>
          ) : (
            'Add to docket'
          )}
        </button>

        {onAddAnother && (
          <button
            type="button"
            className="-mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-input text-[14px] font-medium text-foreground active:bg-secondary disabled:opacity-50"
            disabled={!canAdd}
            onClick={onAddAnother}
            aria-label="Save and add another"
          >
            Save &amp; add another
          </button>
        )}
      </div>
    </BottomSheet>
  );
}

// ── Plant sheet ───────────────────────────────────────────────────────────────

export function PlantSheet({
  open,
  plant,
  selectedPlant,
  hoursOperated,
  wetOrDry,
  selectedLotId,
  assignedLots,
  plantHoursError,
  previewHours,
  previewCost,
  saving,
  onSelectPlant,
  onHoursOperatedChange,
  onWetOrDryChange,
  onSelectedLotIdChange,
  onClose,
  onAdd,
  onAddAnother,
}: {
  open: boolean;
  plant: Plant[];
  selectedPlant: Plant | null;
  hoursOperated: string;
  wetOrDry: 'dry' | 'wet';
  selectedLotId: string;
  assignedLots: Lot[];
  plantHoursError: string | null;
  previewHours: number;
  previewCost: number;
  saving: boolean;
  onSelectPlant: (plant: Plant) => void;
  onHoursOperatedChange: (value: string) => void;
  onWetOrDryChange: (value: 'dry' | 'wet') => void;
  onSelectedLotIdChange: (value: string) => void;
  onClose: () => void;
  onAdd: () => void;
  /** Save this entry but keep the sheet open (hours + wet/dry + lot retained). */
  onAddAnother?: () => void;
}) {
  const lotMissing = assignedLots.length > 0 && !selectedLotId;
  const canAdd = Boolean(selectedPlant) && !lotMissing && !plantHoursError && !saving;
  // Wet/dry toggle only when the plant carries a wet rate (classic guard).
  const showWetDry = Boolean(selectedPlant && selectedPlant.wetRate > 0);

  return (
    <BottomSheet isOpen={open} onClose={onClose} title="Add plant hours">
      <div className="flex flex-col gap-5">
        <p className="text-[13px] text-muted-foreground">Pick the machine, log its hours.</p>

        {/* Plant picker — only approved are selectable. */}
        <div className="shell-crewpick">
          {plant.length === 0 && (
            <p className="text-[13px] text-muted-foreground">
              No plant on your register yet. Add plant in My Company.
            </p>
          )}
          {plant.map((item) => {
            const approved = item.status === 'approved';
            const selected = selectedPlant?.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={!approved}
                onClick={() => approved && onSelectPlant(item)}
                aria-pressed={selected}
                className={cn('shell-pickrow', selected && approved && 'on', !approved && 'locked')}
              >
                <span className="grow">
                  <span className="t block truncate">
                    {item.type}
                    {item.description ? ` — ${item.description}` : ''}
                  </span>
                  <span className="d block truncate">
                    {approved
                      ? item.idRego || 'Approved'
                      : 'Rate pending HC approval — can’t be docketed yet'}
                  </span>
                </span>
                {approved ? (
                  <span className="rate">${item.dryRate}/h</span>
                ) : (
                  <span className="shell-badge shell-badge-pend">
                    {item.status === 'counter' ? 'COUNTER' : 'PENDING'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Hours operated */}
        <div>
          <label className="shell-field-label" htmlFor="subbie-plant-hours">
            Hours operated
          </label>
          <input
            id="subbie-plant-hours"
            type="number"
            step="0.5"
            min="0"
            max="24"
            value={hoursOperated}
            onChange={(e) => onHoursOperatedChange(e.target.value)}
            className="shell-input"
          />
          {plantHoursError && (
            <p className="mt-1.5 text-[12.5px] text-destructive">{plantHoursError}</p>
          )}
        </div>

        {/* Wet/dry — only when a wet rate exists */}
        {showWetDry && selectedPlant && (
          <div>
            <span className="shell-field-label">Rate</span>
            <div className="shell-wetdry">
              <button
                type="button"
                className={cn('shell-segbtn', wetOrDry === 'dry' && 'on')}
                onClick={() => onWetOrDryChange('dry')}
              >
                Dry — ${selectedPlant.dryRate}/h
              </button>
              <button
                type="button"
                className={cn('shell-segbtn', wetOrDry === 'wet' && 'on')}
                onClick={() => onWetOrDryChange('wet')}
              >
                Wet — ${selectedPlant.wetRate}/h
              </button>
            </div>
          </div>
        )}

        {/* Lot allocation — auto-selected when exactly one assigned lot. */}
        {assignedLots.length > 0 && (
          <div>
            <span className="shell-field-label">Worked on lot</span>
            {assignedLots.length === 1 ? (
              <div className="shell-pickrow on">
                <span className="grow">
                  <span className="t block">{assignedLots[0].lotNumber}</span>
                </span>
                <Check size={18} className="flex-shrink-0 text-success" aria-hidden="true" />
              </div>
            ) : (
              <select
                value={selectedLotId}
                onChange={(e) => onSelectedLotIdChange(e.target.value)}
                className="shell-input"
                aria-label="Allocate plant to lot"
              >
                <option value="">Select a lot</option>
                {assignedLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.lotNumber}
                    {lot.activity ? ` — ${lot.activity}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Live preview */}
        <div className="shell-preview">
          <span className="l">
            {previewHours} hours {showWetDry ? wetOrDry : ''}
          </span>
          <span className="v">{formatCurrency(previewCost)}</span>
        </div>

        <button
          type="button"
          className="shell-sheetbtn"
          disabled={!canAdd}
          onClick={onAdd}
          aria-label="Add to docket"
        >
          {saving ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Adding…
            </>
          ) : (
            'Add to docket'
          )}
        </button>

        {onAddAnother && (
          <button
            type="button"
            className="-mt-2 flex min-h-11 w-full items-center justify-center rounded-xl border border-input text-[14px] font-medium text-foreground active:bg-secondary disabled:opacity-50"
            disabled={!canAdd}
            onClick={onAddAnother}
            aria-label="Save and add another"
          >
            Save &amp; add another
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
