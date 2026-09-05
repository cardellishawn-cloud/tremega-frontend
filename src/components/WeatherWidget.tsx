import { motion } from 'framer-motion'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AnimatedWeatherIcon } from './AnimatedWeatherIcon'
import { Wind, Droplets, Thermometer, RefreshCw, Edit2 } from 'lucide-react'
import { useState } from 'react'

interface WeatherWidgetProps {
  weather: {
    temp: number
    condition: string
    description: string
    high: number
    low: number
    wind: number
    humidity: number
    icon: string
    forecast: Array<{
      date: string
      day: string
      high: number
      low: number
      condition: string
      icon: string
    }>
    lastUpdated: Date
  } | null
  loading?: boolean
  error?: string | null
  onRefresh?: () => void
  onManualOverride?: (data: { temp: number; condition: string; high: number; low: number }) => void
}

export function WeatherWidget({ weather, loading, error, onRefresh, onManualOverride }: WeatherWidgetProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [manualTemp, setManualTemp] = useState('')
  const [manualCondition, setManualCondition] = useState('')
  const [manualHigh, setManualHigh] = useState('')
  const [manualLow, setManualLow] = useState('')

  const handleManualSubmit = () => {
    if (onManualOverride && manualTemp) {
      onManualOverride({
        temp: parseInt(manualTemp),
        condition: manualCondition || 'Clear',
        high: parseInt(manualHigh) || parseInt(manualTemp) + 5,
        low: parseInt(manualLow) || parseInt(manualTemp) - 5,
      })
      setIsEditing(false)
    }
  }

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative -mt-16 mx-4 sm:mx-8 lg:mx-auto lg:max-w-5xl z-20"
      >
        <Card className="p-8 shadow-xl">
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-lg text-gray-600">Loading weather...</span>
          </div>
        </Card>
      </motion.div>
    )
  }

  if (error || !weather) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative -mt-16 mx-4 sm:mx-8 lg:mx-auto lg:max-w-5xl z-20"
      >
        <Card className="p-8 shadow-xl">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{error || 'Unable to fetch weather'}</p>
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              <Edit2 className="mr-2 h-4 w-4" />
              Enter Manually
            </Button>
          </div>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative -mt-16 mx-4 sm:mx-8 lg:mx-auto lg:max-w-5xl z-20"
    >
      <Card className="overflow-hidden shadow-xl hover:shadow-2xl transition-shadow duration-300">
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-700">Current Weather</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">
                Updated {weather.lastUpdated.toLocaleTimeString()}
              </span>
              <Button variant="ghost" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                <Edit2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            /* Manual Edit Mode */
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="text-sm text-gray-600">Temperature (°F)</label>
                <input
                  type="number"
                  value={manualTemp}
                  onChange={(e) => setManualTemp(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                  placeholder="72"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Condition</label>
                <select
                  value={manualCondition}
                  onChange={(e) => setManualCondition(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                >
                  <option value="">Select...</option>
                  <option value="Clear">Clear</option>
                  <option value="Partly Cloudy">Partly Cloudy</option>
                  <option value="Cloudy">Cloudy</option>
                  <option value="Rain">Rain</option>
                  <option value="Snow">Snow</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-600">High (°F)</label>
                <input
                  type="number"
                  value={manualHigh}
                  onChange={(e) => setManualHigh(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                  placeholder="78"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">Low (°F)</label>
                <input
                  type="number"
                  value={manualLow}
                  onChange={(e) => setManualLow(e.target.value)}
                  className="w-full mt-1 p-2 border rounded-lg"
                  placeholder="65"
                />
              </div>
              <div className="col-span-2 sm:col-span-4 flex gap-2">
                <Button onClick={handleManualSubmit} className="flex-1">Apply</Button>
                <Button variant="outline" onClick={() => setIsEditing(false)} className="flex-1">Cancel</Button>
              </div>
            </div>
          ) : (
            /* Weather Display */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left: Main Temp & Icon */}
              <div className="flex items-center justify-center lg:justify-start gap-6">
                <motion.div
                  key={weather.icon}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <AnimatedWeatherIcon condition={weather.icon} size={100} />
                </motion.div>
                <div>
                  <motion.div
                    key={weather.temp}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                    className="text-6xl font-bold text-gray-800"
                  >
                    {weather.temp}°
                  </motion.div>
                  <div className="text-lg text-gray-600 capitalize">{weather.description}</div>
                </div>
              </div>

              {/* Center: Details */}
              <div className="flex flex-col justify-center space-y-4">
                <div className="flex items-center gap-3">
                  <Thermometer className="h-5 w-5 text-orange-500" />
                  <span className="text-gray-600">
                    High <span className="font-semibold text-gray-800">{weather.high}°</span>
                    {' / '}
                    Low <span className="font-semibold text-gray-800">{weather.low}°</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Wind className="h-5 w-5 text-blue-500" />
                  <span className="text-gray-600">
                    Wind <span className="font-semibold text-gray-800">{weather.wind} mph</span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Droplets className="h-5 w-5 text-blue-400" />
                  <span className="text-gray-600">
                    Humidity <span className="font-semibold text-gray-800">{weather.humidity}%</span>
                  </span>
                </div>
              </div>

              {/* Right: 5-Day Forecast */}
              <div className="flex flex-col justify-center">
                <h4 className="text-sm font-medium text-gray-500 mb-3">5-Day Forecast</h4>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {weather.forecast.map((day, index) => (
                    <motion.div
                      key={day.date}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05, y: -2 }}
                      className="flex-shrink-0 bg-gray-50 rounded-lg p-3 text-center min-w-[70px] cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="text-xs font-medium text-gray-500">{day.day}</div>
                      <div className="my-2">
                        <AnimatedWeatherIcon condition={day.icon} size={32} />
                      </div>
                      <div className="text-sm">
                        <span className="font-semibold">{day.high}°</span>
                        <span className="text-gray-400"> / {day.low}°</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  )
}

export default WeatherWidget
