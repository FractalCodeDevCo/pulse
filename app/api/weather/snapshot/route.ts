import { NextResponse } from "next/server"

import { requireAuth } from "../../../../lib/auth/guard"

export const runtime = "nodejs"

type RequestBody = {
  latitude?: number
  longitude?: number
  capturedAt?: string
}

function weatherCodeLabel(code: number | null): string {
  if (code === null || Number.isNaN(code)) return "Unknown"
  if (code === 0) return "Clear"
  if (code === 1 || code === 2) return "Partly cloudy"
  if (code === 3) return "Overcast"
  if (code === 45 || code === 48) return "Fog"
  if (code >= 51 && code <= 57) return "Drizzle"
  if (code >= 61 && code <= 67) return "Rain"
  if (code >= 71 && code <= 77) return "Snow"
  if (code >= 80 && code <= 82) return "Rain showers"
  if (code >= 85 && code <= 86) return "Snow showers"
  if (code === 95) return "Thunderstorm"
  if (code === 96 || code === 99) return "Thunderstorm with hail"
  return "Other"
}

export async function POST(request: Request) {
  const auth = await requireAuth(request, ["admin", "pm", "installer"])
  if (!auth.ok) return auth.response

  try {
    const body = (await request.json()) as RequestBody
    const latitude = typeof body.latitude === "number" ? body.latitude : Number.NaN
    const longitude = typeof body.longitude === "number" ? body.longitude : Number.NaN
    const capturedAt = typeof body.capturedAt === "string" ? body.capturedAt : null

    if (Number.isNaN(latitude) || Number.isNaN(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return NextResponse.json({ error: "latitude and longitude are required." }, { status: 400 })
    }

    const capturedDate = capturedAt ? new Date(capturedAt) : null
    const useHistorical = Boolean(capturedDate && Number.isFinite(capturedDate.getTime()))

    if (useHistorical) {
      const yyyy = capturedDate!.getUTCFullYear()
      const mm = String(capturedDate!.getUTCMonth() + 1).padStart(2, "0")
      const dd = String(capturedDate!.getUTCDate()).padStart(2, "0")
      const day = `${yyyy}-${mm}-${dd}`

      const archiveUrl = new URL("https://archive-api.open-meteo.com/v1/archive")
      archiveUrl.searchParams.set("latitude", String(latitude))
      archiveUrl.searchParams.set("longitude", String(longitude))
      archiveUrl.searchParams.set("start_date", day)
      archiveUrl.searchParams.set("end_date", day)
      archiveUrl.searchParams.set(
        "hourly",
        "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,weather_code",
      )
      archiveUrl.searchParams.set("temperature_unit", "celsius")
      archiveUrl.searchParams.set("wind_speed_unit", "mph")
      archiveUrl.searchParams.set("timezone", "UTC")

      const archiveRes = await fetch(archiveUrl.toString(), { cache: "no-store" })
      if (archiveRes.ok) {
        const archiveJson = (await archiveRes.json()) as {
          hourly?: {
            time?: string[]
            temperature_2m?: Array<number | null>
            apparent_temperature?: Array<number | null>
            relative_humidity_2m?: Array<number | null>
            wind_speed_10m?: Array<number | null>
            wind_gusts_10m?: Array<number | null>
            precipitation?: Array<number | null>
            cloud_cover?: Array<number | null>
            weather_code?: Array<number | null>
          }
        }

        const hourly = archiveJson.hourly
        const times = Array.isArray(hourly?.time) ? hourly!.time : []
        if (times.length > 0) {
          const targetMs = capturedDate!.getTime()
          let selectedIndex = 0
          let selectedDiff = Number.POSITIVE_INFINITY
          for (let index = 0; index < times.length; index += 1) {
            const ms = new Date(times[index]).getTime()
            if (!Number.isFinite(ms)) continue
            const diff = Math.abs(ms - targetMs)
            if (diff < selectedDiff) {
              selectedDiff = diff
              selectedIndex = index
            }
          }

          const code = hourly?.weather_code?.[selectedIndex]
          const weatherCode = typeof code === "number" ? code : null
          return NextResponse.json({
            observedAt: times[selectedIndex] ?? capturedDate!.toISOString(),
            source: "open-meteo-archive",
            temperatureC:
              typeof hourly?.temperature_2m?.[selectedIndex] === "number" ? hourly!.temperature_2m![selectedIndex] : null,
            apparentTemperatureC:
              typeof hourly?.apparent_temperature?.[selectedIndex] === "number"
                ? hourly!.apparent_temperature![selectedIndex]
                : null,
            humidityPct:
              typeof hourly?.relative_humidity_2m?.[selectedIndex] === "number"
                ? hourly!.relative_humidity_2m![selectedIndex]
                : null,
            windMph: typeof hourly?.wind_speed_10m?.[selectedIndex] === "number" ? hourly!.wind_speed_10m![selectedIndex] : null,
            weatherCode,
            weatherLabel: weatherCodeLabel(weatherCode),
            extra: {
              windGustMph:
                typeof hourly?.wind_gusts_10m?.[selectedIndex] === "number" ? hourly!.wind_gusts_10m![selectedIndex] : null,
              precipitationMm:
                typeof hourly?.precipitation?.[selectedIndex] === "number" ? hourly!.precipitation![selectedIndex] : null,
              cloudCoverPct:
                typeof hourly?.cloud_cover?.[selectedIndex] === "number" ? hourly!.cloud_cover![selectedIndex] : null,
              mode: "historical",
            },
          })
        }
      }
    }

    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast")
    weatherUrl.searchParams.set("latitude", String(latitude))
    weatherUrl.searchParams.set("longitude", String(longitude))
    weatherUrl.searchParams.set(
      "current",
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,precipitation,cloud_cover,is_day,weather_code",
    )
    weatherUrl.searchParams.set("temperature_unit", "celsius")
    weatherUrl.searchParams.set("wind_speed_unit", "mph")
    weatherUrl.searchParams.set("timezone", "auto")

    const weatherRes = await fetch(weatherUrl.toString(), { cache: "no-store" })
    if (!weatherRes.ok) return NextResponse.json({ error: "Unable to fetch weather snapshot." }, { status: 502 })

    const weatherJson = (await weatherRes.json()) as {
      current?: {
        time?: string
        temperature_2m?: number
        apparent_temperature?: number
        relative_humidity_2m?: number
        wind_speed_10m?: number
        wind_gusts_10m?: number
        precipitation?: number
        cloud_cover?: number
        is_day?: number
        weather_code?: number
      }
    }

    const current = weatherJson.current
    if (!current) return NextResponse.json({ error: "Weather snapshot unavailable." }, { status: 502 })

    const weatherCode = typeof current.weather_code === "number" ? current.weather_code : null
    return NextResponse.json({
      observedAt: typeof current.time === "string" ? current.time : new Date().toISOString(),
      source: "open-meteo",
      temperatureC: typeof current.temperature_2m === "number" ? current.temperature_2m : null,
      apparentTemperatureC: typeof current.apparent_temperature === "number" ? current.apparent_temperature : null,
      humidityPct: typeof current.relative_humidity_2m === "number" ? current.relative_humidity_2m : null,
      windMph: typeof current.wind_speed_10m === "number" ? current.wind_speed_10m : null,
      weatherCode,
      weatherLabel: weatherCodeLabel(weatherCode),
      extra: {
        windGustMph: typeof current.wind_gusts_10m === "number" ? current.wind_gusts_10m : null,
        precipitationMm: typeof current.precipitation === "number" ? current.precipitation : null,
        cloudCoverPct: typeof current.cloud_cover === "number" ? current.cloud_cover : null,
        isDay: typeof current.is_day === "number" ? current.is_day : null,
        mode: "snapshot",
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
