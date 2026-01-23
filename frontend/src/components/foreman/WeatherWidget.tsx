// WeatherWidget - Weather display for foreman dashboard
import { Sun, Cloud, CloudRain, CloudSnow, Wind, Thermometer, Droplets } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeatherData {
  conditions: string | null
  temperatureMin: number | null
  temperatureMax: number | null
  rainfallMm: number | null
}

interface WeatherWidgetProps {
  weather: WeatherData
  loading?: boolean
  className?: string
}

function getWeatherIcon(conditions: string | null) {
  if (!conditions) return <Sun className="h-10 w-10 text-yellow-500" />

  const lower = conditions.toLowerCase()
  if (lower.includes('rain') || lower.includes('shower')) {
    return <CloudRain className="h-10 w-10 text-blue-500" />
  }
  if (lower.includes('snow')) {
    return <CloudSnow className="h-10 w-10 text-blue-200" />
  }
  if (lower.includes('wind')) {
    return <Wind className="h-10 w-10 text-gray-500" />
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className="h-10 w-10 text-gray-400" />
  }
  return <Sun className="h-10 w-10 text-yellow-500" />
}

function getGradient(conditions: string | null) {
  if (!conditions) return 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'

  const lower = conditions.toLowerCase()
  if (lower.includes('rain') || lower.includes('shower')) {
    return 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return 'from-gray-50 to-gray-100 dark:from-gray-900/20 dark:to-gray-800/20'
  }
  return 'from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20'
}

export function WeatherWidget({ weather, loading, className }: WeatherWidgetProps) {
  if (loading) {
    return (
      <div className={cn('rounded-lg border p-6 animate-pulse', className)}>
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-full" />
          <div className="space-y-2">
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border p-4 bg-gradient-to-r',
        getGradient(weather.conditions),
        className
      )}
    >
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
              <Thermometer className="h-5 w-5 text-red-500" />
              <span className="text-lg font-medium">
                {weather.temperatureMin}° - {weather.temperatureMax}°C
              </span>
            </div>
          )}
          {weather.rainfallMm !== null && weather.rainfallMm > 0 && (
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              <span className="text-lg font-medium">{weather.rainfallMm}mm</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
