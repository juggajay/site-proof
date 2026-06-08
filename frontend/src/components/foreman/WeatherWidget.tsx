// WeatherWidget - Weather display for foreman dashboard
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Droplets } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherData {
  conditions: string | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
  rainfallMm: number | null;
}

interface WeatherWidgetProps {
  weather: WeatherData;
  loading?: boolean;
  className?: string;
}

function getWeatherIcon(conditions: string | null) {
  if (!conditions) return <Sun className="h-10 w-10 text-muted-foreground" />;

  const lower = conditions.toLowerCase();
  if (lower.includes('rain') || lower.includes('shower')) {
    return <CloudRain className="h-10 w-10 text-muted-foreground" />;
  }
  if (lower.includes('snow')) {
    return <CloudSnow className="h-10 w-10 text-muted-foreground" />;
  }
  if (lower.includes('wind')) {
    return <Wind className="h-10 w-10 text-muted-foreground" />;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className="h-10 w-10 text-muted-foreground" />;
  }
  return <Sun className="h-10 w-10 text-muted-foreground" />;
}

export function WeatherWidget({ weather, loading, className }: WeatherWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border p-6 animate-pulse', className)}>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-muted rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-3 w-32 bg-muted rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border bg-card p-4', className)}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          {getWeatherIcon(weather.conditions)}
          <div>
            <h3 className="font-semibold text-lg">Today's Weather</h3>
            <p className="text-muted-foreground">
              {weather.conditions || 'Weather data not available'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {weather.temperatureMin !== null && weather.temperatureMax !== null && (
            <div className="flex items-center gap-2">
              <Thermometer className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-medium font-mono tabular-nums">
                {weather.temperatureMin}° - {weather.temperatureMax}°C
              </span>
            </div>
          )}
          {weather.rainfallMm !== null && weather.rainfallMm > 0 && (
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-muted-foreground" />
              <span className="text-lg font-medium font-mono tabular-nums">
                {weather.rainfallMm}mm
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
