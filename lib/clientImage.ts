export type ProcessImageOptions = {
  maxFileSizeBytes?: number
  maxDimension?: number
  quality?: number
}

const DEFAULT_MAX_FILE_SIZE = 8 * 1024 * 1024
const DEFAULT_MAX_DIMENSION = 1600
const DEFAULT_QUALITY = 0.78

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

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed")
  }

  if (file.size > maxFileSizeBytes) {
    throw new Error(`Image too large: ${Math.round(file.size / 1024 / 1024)}MB`) }

  const source = await fileToDataUrl(file)
  return compressDataUrl(source, maxDimension, quality)
}

export async function processImageFiles(files: File[], options: ProcessImageOptions = {}): Promise<string[]> {
  const results: string[] = []

  for (const file of files) {
    results.push(await processImageFile(file, options))
  }

  return results
}
