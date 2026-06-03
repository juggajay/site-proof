import { Users, Truck, FileText, Trash2, MapPin, AlertCircle, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { Docket, Employee, Plant } from '../docketEditData';
import { formatCurrency, formatDate } from '../docketEditDisplay';

// Extracted from DocketEditPage: the labour/plant/summary tab selector and the
// three rendered tab panels. Data fetching, mutations, and the entry sheet stay
// in the page; this component is prop-driven and presentation-only.
export function DocketEditTabs({
  activeTab,
  onTabChange,
  docket,
  canEdit,
  approvedEmployees,
  approvedPlant,
  myCompanyLink,
  today,
  totalCost,
  notes,
  onNotesChange,
  onNotesBlur,
  onAddLabour,
  onAddPlant,
  onDeleteLabour,
  onDeletePlant,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  docket: Docket | null;
  canEdit: boolean;
  approvedEmployees: Employee[];
  approvedPlant: Plant[];
  myCompanyLink: string;
  today: string;
  totalCost: number;
  notes: string;
  onNotesChange: (value: string) => void;
  onNotesBlur: () => void;
  onAddLabour: (emp?: Employee) => void;
  onAddPlant: (plant?: Plant) => void;
  onDeleteLabour: (entryId: string) => void;
  onDeletePlant: (entryId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-1 p-1 bg-muted rounded-lg">
        <button
          onClick={() => onTabChange('labour')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
            activeTab === 'labour'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Users className="h-4 w-4" />
          Labour
          {docket?.labourEntries.length ? (
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
              {docket.labourEntries.length}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => onTabChange('plant')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
            activeTab === 'plant'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Truck className="h-4 w-4" />
          Plant
          {docket?.plantEntries.length ? (
            <span className="px-1.5 py-0.5 text-xs bg-muted rounded">
              {docket.plantEntries.length}
            </span>
          ) : null}
        </button>
        <button
          onClick={() => onTabChange('summary')}
          className={cn(
            'flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-colors',
            activeTab === 'summary'
              ? 'bg-card text-foreground shadow'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <FileText className="h-4 w-4" />
          Summary
        </button>
      </div>

      {/* Labour Tab */}
      {activeTab === 'labour' && (
        <div className="space-y-4">
          {canEdit && approvedEmployees.length > 0 && (
            <div className="border border-dashed border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-3">Tap an employee to add hours</p>
              <div className="grid grid-cols-2 gap-2">
                {approvedEmployees.map((emp) => {
                  const alreadyAdded = docket?.labourEntries.some((e) => e.employee.id === emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => onAddLabour(emp)}
                      className={cn(
                        'relative p-3 rounded-lg border text-left transition-colors min-h-[60px]',
                        alreadyAdded
                          ? 'bg-primary/5 border-primary'
                          : 'hover:border-primary hover:bg-muted/50 border-border',
                      )}
                    >
                      <p className="font-medium text-sm text-foreground truncate">{emp.name}</p>
                      <p className="text-xs text-muted-foreground">{emp.role}</p>
                      <p className="text-xs text-muted-foreground">${emp.hourlyRate}/hr</p>
                      {alreadyAdded && (
                        <Check className="h-4 w-4 text-primary absolute top-2 right-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {approvedEmployees.length === 0 && (
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-primary">
                No approved employees yet. Add employees in{' '}
                <Link to={myCompanyLink} className="underline">
                  My Company
                </Link>{' '}
                and wait for rate approval.
              </p>
            </div>
          )}

          {/* Labour entries list */}
          {docket?.labourEntries && docket.labourEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Today's Entries</h3>
              {docket.labourEntries.map((entry) => (
                <div key={entry.id} className="border border-border rounded-lg bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{entry.employee.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entry.startTime} - {entry.finishTime}
                      </p>
                      <p className="text-sm text-foreground">
                        {entry.submittedHours}h × ${entry.hourlyRate}/hr ={' '}
                        {formatCurrency(entry.submittedCost)}
                      </p>
                      {entry.lotAllocations.length > 0 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" />
                          {entry.lotAllocations.map((a) => a.lotNumber).join(', ')}
                        </p>
                      )}
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeleteLabour(entry.id)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="text-right p-2">
                <p className="text-sm text-muted-foreground">Labour Subtotal</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(docket.totalLabourSubmitted)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Plant Tab */}
      {activeTab === 'plant' && (
        <div className="space-y-4">
          {canEdit && approvedPlant.length > 0 && (
            <div className="border border-dashed border-border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-3">Tap equipment to add hours</p>
              <div className="grid grid-cols-2 gap-2">
                {approvedPlant.map((plant) => {
                  const alreadyAdded = docket?.plantEntries.some((e) => e.plant.id === plant.id);
                  return (
                    <button
                      key={plant.id}
                      onClick={() => onAddPlant(plant)}
                      className={cn(
                        'relative p-3 rounded-lg border text-left transition-colors min-h-[60px]',
                        alreadyAdded
                          ? 'bg-primary/5 border-primary'
                          : 'hover:border-primary hover:bg-muted/50 border-border',
                      )}
                    >
                      <p className="font-medium text-sm text-foreground truncate">{plant.type}</p>
                      <p className="text-xs text-muted-foreground truncate">{plant.description}</p>
                      <p className="text-xs text-muted-foreground">
                        ${plant.dryRate}
                        {plant.wetRate > 0 ? `/$${plant.wetRate}` : ''}/hr
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {approvedPlant.length === 0 && (
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/30 rounded-lg">
              <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <p className="text-primary">
                No approved plant yet. Add plant in{' '}
                <Link to={myCompanyLink} className="underline">
                  My Company
                </Link>{' '}
                and wait for rate approval.
              </p>
            </div>
          )}

          {/* Plant entries list */}
          {docket?.plantEntries && docket.plantEntries.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium text-sm text-muted-foreground">Today's Entries</h3>
              {docket.plantEntries.map((entry) => (
                <div key={entry.id} className="border border-border rounded-lg bg-card p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-foreground">{entry.plant.type}</p>
                      <p className="text-sm text-muted-foreground">{entry.plant.description}</p>
                      <p className="text-sm text-foreground">
                        {entry.hoursOperated}h × ${entry.hourlyRate}/hr ({entry.wetOrDry}) ={' '}
                        {formatCurrency(entry.submittedCost)}
                      </p>
                    </div>
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDeletePlant(entry.id)}
                        className="text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="text-right p-2">
                <p className="text-sm text-muted-foreground">Plant Subtotal</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatCurrency(docket.totalPlantSubmitted)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary Tab */}
      {activeTab === 'summary' && (
        <div className="space-y-4">
          <div className="border border-border rounded-lg bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Docket Summary</h2>
              <p className="text-sm text-muted-foreground">{formatDate(docket?.date || today)}</p>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Labour ({docket?.labourEntries.length || 0} entries)
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(docket?.totalLabourSubmitted || 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Plant ({docket?.plantEntries.length || 0} entries)
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {formatCurrency(docket?.totalPlantSubmitted || 0)}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(totalCost)}</p>
              </div>

              {canEdit && (
                <div className="pt-4">
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    onBlur={onNotesBlur}
                    placeholder="Add any notes for this docket..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
