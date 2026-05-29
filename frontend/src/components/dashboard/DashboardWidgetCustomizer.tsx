import { Check, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WIDGET_CONFIG, type WidgetId } from '@/lib/dashboardWidgets';

interface DashboardWidgetCustomizerProps {
  isOpen: boolean;
  isWidgetVisible: (widgetId: WidgetId) => boolean;
  onToggle: () => void;
  onClose: () => void;
  onToggleWidget: (widgetId: WidgetId) => void;
}

export function DashboardWidgetCustomizer({
  isOpen,
  isWidgetVisible,
  onToggle,
  onClose,
  onToggleWidget,
}: DashboardWidgetCustomizerProps) {
  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={onToggle}
        title="Customize widgets"
        className="w-full sm:w-auto"
      >
        <Settings2 className="h-4 w-4" />
        Customize
      </Button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={onClose} />
          <div className="absolute right-0 top-full mt-2 w-64 bg-card border rounded-lg shadow-lg z-20 p-2">
            <div className="px-2 py-1.5 text-sm font-medium border-b mb-2">Dashboard Widgets</div>
            {WIDGET_CONFIG.map((widget) => (
              <button
                key={widget.id}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleWidget(widget.id);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-sm hover:bg-muted rounded"
                type="button"
              >
                <span>{widget.label}</span>
                {isWidgetVisible(widget.id) && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
