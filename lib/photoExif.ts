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
      pick: [
        "latitude",
        "longitude",
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "GPSDateStamp",
        "GPSTimeStamp",
      ],
    })) as Record<string, unknown> | null

    if (!parsed) return null

    const latitude = normalizeLatitude(toFiniteNumber(parsed.latitude))
    const longitude = normalizeLongitude(toFiniteNumber(parsed.longitude))

    const capturedAt =
      toIsoString(parsed.DateTimeOriginal) ??
      toIsoString(parsed.CreateDate) ??
      toIsoString(parsed.ModifyDate) ??
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
