import { useState, useEffect } from 'react'
import axios from 'axios'

interface WeatherData {
  temp: number
  condition: string
  description: string
  high: number
  low: number
  wind: number
  humidity: number
  icon: string
  forecast: ForecastDay[]
  lastUpdated: Date
}

interface ForecastDay {
  date: string
  day: string
  high: number
  low: number
  condition: string
  icon: string
}

interface UseWeatherOptions {
  lat?: number
  lng?: number
  address?: string
  enabled?: boolean
}

const OPENWEATHER_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || ''
const BASE_URL = 'https://api.openweathermap.org/data/2.5'

// Map OpenWeather condition codes to our icon types
const mapConditionToIcon = (conditionId: number): string => {
  if (conditionId >= 200 && conditionId < 300) return 'thunderstorm'
  if (conditionId >= 300 && conditionId < 400) return 'drizzle'
  if (conditionId >= 500 && conditionId < 600) return 'rain'
  if (conditionId >= 600 && conditionId < 700) return 'snow'
  if (conditionId >= 700 && conditionId < 800) return 'atmosphere'
  if (conditionId === 800) return 'clear'
  if (conditionId === 801) return 'partly-cloudy'
  if (conditionId >= 802) return 'cloudy'
  return 'clear'
}

export function useWeather({ lat, lng, address, enabled = true }: UseWeatherOptions) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!enabled || !OPENWEATHER_API_KEY) {
      if (!OPENWEATHER_API_KEY) {
        setError('Weather API key not configured')
      }
      return
    }

    const fetchWeather = async () => {
      setLoading(true)
      setError(null)

      try {
        let latitude = lat
        let longitude = lng

        // If address provided but no lat/lng, geocode first
        if (!latitude && !longitude && address) {
          const geoResponse = await axios.get(
            `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(address)}&limit=1&appid=${OPENWEATHER_API_KEY}`
          )
          if (geoResponse.data.length > 0) {
            latitude = geoResponse.data[0].lat
            longitude = geoResponse.data[0].lon
          }
        }

        // Default to a location if nothing provided
        if (!latitude || !longitude) {
          latitude = 40.7128
          longitude = -74.0060 // New York default
        }

        // Fetch current weather
        const currentResponse = await axios.get(
          `${BASE_URL}/weather?lat=${latitude}&lon=${longitude}&units=imperial&appid=${OPENWEATHER_API_KEY}`
        )

        // Fetch 5-day forecast
        const forecastResponse = await axios.get(
          `${BASE_URL}/forecast?lat=${latitude}&lon=${longitude}&units=imperial&appid=${OPENWEATHER_API_KEY}`
        )

        const current = currentResponse.data
        const forecast = forecastResponse.data

        // Process forecast data (get one entry per day)
        const dailyForecasts: ForecastDay[] = []
        const seenDates = new Set<string>()

        forecast.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000)
          const dateStr = date.toISOString().split('T')[0]
          
          if (!seenDates.has(dateStr) && dailyForecasts.length < 5) {
            seenDates.add(dateStr)
            dailyForecasts.push({
              date: dateStr,
              day: date.toLocaleDateString('en-US', { weekday: 'short' }),
              high: Math.round(item.main.temp_max),
              low: Math.round(item.main.temp_min),
              condition: item.weather[0].main,
              icon: mapConditionToIcon(item.weather[0].id),
            })
          }
        })

        setWeather({
          temp: Math.round(current.main.temp),
          condition: current.weather[0].main,
          description: current.weather[0].description,
          high: Math.round(current.main.temp_max),
          low: Math.round(current.main.temp_min),
          wind: Math.round(current.wind.speed),
          humidity: current.main.humidity,
          icon: mapConditionToIcon(current.weather[0].id),
          forecast: dailyForecasts,
          lastUpdated: new Date(),
        })
      } catch (err) {
        console.error('Weather fetch error:', err)
        setError('Unable to fetch weather data')
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()
  }, [lat, lng, address, enabled])

  const refresh = () => {
    if (lat || lng || address) {
      setWeather(null)
      setLoading(true)
      // Trigger re-fetch by updating a dependency
    }
  }

  return { weather, loading, error, refresh }
}
