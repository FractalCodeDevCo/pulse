import exifr from "exifr"

export type PhotoExifContext = {
  latitude: number | null
  longitude: number | null
  capturedAt: string | null
}

function toIsoString(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  if (typeof value === "string") {
    const parsed = new Date(value)
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

function toFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function fromDmsArray(value: unknown, ref: unknown): number | null {
  if (!Array.isArray(value) || value.length < 3) return null
  const d = Number(value[0])
  const m = Number(value[1])
  const s = Number(value[2])
  if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(s)) return null
  let decimal = Math.abs(d) + m / 60 + s / 3600
  const direction = typeof ref === "string" ? ref.toUpperCase() : ""
  if (direction === "S" || direction === "W") decimal = -decimal
  return decimal
}

function normalizeLatitude(value: number | null): number | null {
  if (value === null) return null
  if (Math.abs(value) > 90) return null
  return value
}

function normalizeLongitude(value: number | null): number | null {
  if (value === null) return null
  if (Math.abs(value) > 180) return null
  return value
}

export async function readPhotoExif(file: File): Promise<PhotoExifContext | null> {
  try {
    const parsed = (await exifr.parse(file, {
      gps: true,
      tiff: true,
      exif: true,
      xmp: true,
    })) as Record<string, unknown> | null

    const gpsOnly = (await exifr.gps(file).catch(() => null)) as Record<string, unknown> | null
    if (!parsed && !gpsOnly) return null

    const merged = {
      ...(parsed ?? {}),
      ...(gpsOnly ?? {}),
    } as Record<string, unknown>

    const latitude = normalizeLatitude(
      toFiniteNumber(merged.latitude) ??
        toFiniteNumber(merged.lat) ??
        fromDmsArray(merged.GPSLatitude, merged.GPSLatitudeRef),
    )
    const longitude = normalizeLongitude(
      toFiniteNumber(merged.longitude) ??
        toFiniteNumber(merged.lon) ??
        fromDmsArray(merged.GPSLongitude, merged.GPSLongitudeRef),
    )

    const capturedAt =
      toIsoString(merged.DateTimeOriginal) ??
      toIsoString(merged.CreateDate) ??
      toIsoString(merged.ModifyDate) ??
      toIsoString(merged.DateTimeDigitized) ??
      toIsoString(merged.MediaCreateDate) ??
      null

    if (latitude === null && longitude === null && capturedAt === null) return null

    return {
      latitude,
      longitude,
      capturedAt,
    }
  } catch {
    return null
  }
}

export async function readPhotoExifBatch(files: File[]): Promise<Array<PhotoExifContext | null>> {
  const results: Array<PhotoExifContext | null> = []
  for (const file of files) {
    results.push(await readPhotoExif(file))
  }
  return results
}
