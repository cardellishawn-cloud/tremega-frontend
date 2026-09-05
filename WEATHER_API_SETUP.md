# OpenWeather API Setup

## Getting Your API Key

1. Go to https://openweathermap.org/api
2. Sign up for a free account
3. Navigate to API keys section
4. Copy your API key

## Free Tier Limits

- 1,000 API calls/day
- 60 calls/minute
- Current weather + 5-day forecast

## Environment Variables

Add to your `.env` file:

```env
VITE_OPENWEATHER_API_KEY=your_api_key_here
```

## For Vercel Deployment

Add the environment variable in Vercel dashboard:

1. Go to your project settings
2. Navigate to Environment Variables
3. Add: `VITE_OPENWEATHER_API_KEY` = `your_api_key_here`
4. Redeploy

## Usage

The weather widget will automatically fetch weather when:
- A job is selected
- The job has a location/address

Manual override is available if the API fails or user wants to enter custom weather.
