export type ProcessImageOptions = {
  maxFileSizeBytes?: number
  maxDimension?: number
  quality?: number
}

export const IMAGE_INPUT_ACCEPT = "image/*,.heic,.heif,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tiff,.tif"

const DEFAULT_MAX_FILE_SIZE = 25 * 1024 * 1024
const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.78
const FALLBACK_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"]

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ""))
    reader.onerror = () => reject(new Error("Could not read image"))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Could not decode image"))
    img.src = dataUrl
  })
}

async function compressDataUrl(dataUrl: string, maxDimension: number, quality: number): Promise<string> {
  const image = await loadImage(dataUrl)
  const ratio = Math.min(maxDimension / image.width, maxDimension / image.height, 1)

  const width = Math.round(image.width * ratio)
  const height = Math.round(image.height * ratio)

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas unavailable")

  ctx.drawImage(image, 0, 0, width, height)
  return canvas.toDataURL("image/jpeg", quality)
}

export async function processImageFile(file: File, options: ProcessImageOptions = {}): Promise<string> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? DEFAULT_MAX_FILE_SIZE
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION
  const quality = options.quality ?? DEFAULT_QUALITY

  const lowerName = file.name.toLowerCase()
  const hasImageExtension = FALLBACK_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext))
  const isImageByMime = file.type.startsWith("image/")

  if (!isImageByMime && !hasImageExtension) {
    throw new Error("Only image files are allowed")
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error(`Image too large: ${Math.round(file.size / 1024 / 1024)}MB`) }

  const source = await fileToDataUrl(file)
  try {
    return await compressDataUrl(source, maxDimension, quality)
  } catch {
    // Some devices/codecs (e.g. HEIC/HEIF) may fail canvas decoding.
    // Keep original data URL so upload flow still works instead of failing capture.
    return source
  }
}

export async function processImageFiles(files: File[], options: ProcessImageOptions = {}): Promise<string[]> {
  const results: string[] = []

  for (const file of files) {
    results.push(await processImageFile(file, options))
  }

  return results
}
