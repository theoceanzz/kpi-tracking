/**
 * Tách nền đồng màu (thường là nền trắng của ảnh chụp / ảnh scan) khỏi logo và chữ ký.
 *
 * <p>Logo và chữ ký người dùng tải lên phần lớn là JPG hoặc PNG có nền trắng đặc: đặt lên
 * mẫu nền kem, nền tối hay có ảnh nền thì lộ nguyên một khối chữ nhật. Ở đây xoá nền ngay
 * trên trình duyệt bằng canvas trước khi tải lên — không cần dịch vụ ngoài.
 *
 * <p>Hai cách xoá, theo loại ảnh:
 * - `signature`: xoá MỌI điểm ảnh gần màu nền, kể cả phần nền lọt thỏm trong nét chữ
 *   ("o", "a", vòng con dấu) — chữ ký không có chi tiết nào cùng màu nền cần giữ lại.
 * - `logo`: chỉ loang từ mép ảnh vào. Phần trắng NẰM TRONG logo (chữ trắng trên khối màu)
 *   là một phần của logo; xoá luôn thì logo thủng lỗ khi in lên nền tối.
 */

export type BackgroundRemovalMode = 'signature' | 'logo'

/** Cạnh dài nhất sau khi xử lý. Logo/chữ ký in ra chỉ vài trăm px; ảnh 4000px chỉ làm nặng. */
const MAX_SIDE = 1600

/** Khoảng cách màu (0–441) coi là "chắc chắn là nền". */
const HARD_TOLERANCE = 42
/** Từ HARD tới SOFT: mờ dần, cho viền chữ mềm thay vì răng cưa. */
const SOFT_TOLERANCE = 90

/** Tỉ lệ điểm ở mép phải gần màu nền thì mới coi ảnh "có nền đồng màu" để xoá. */
const MIN_UNIFORM_BORDER = 0.6

export class BackgroundNotRemovableError extends Error {
  constructor(public readonly reason: 'ALREADY_TRANSPARENT' | 'NOT_UNIFORM') {
    super(reason)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Cannot load image: ${src}`))
    img.src = src
  })
}

function distance(data: Uint8ClampedArray, i: number, bg: [number, number, number]): number {
  const dr = data[i]! - bg[0]
  const dg = data[i + 1]! - bg[1]
  const db = data[i + 2]! - bg[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/** Chỉ số (theo điểm ảnh, không phải byte) của mọi điểm nằm trên mép ảnh. */
function borderPixels(width: number, height: number): number[] {
  const out: number[] = []
  for (let x = 0; x < width; x++) {
    out.push(x, (height - 1) * width + x)
  }
  for (let y = 1; y < height - 1; y++) {
    out.push(y * width, y * width + width - 1)
  }
  return out
}

/**
 * Màu nền = màu xuất hiện nhiều nhất ở mép ảnh (lượng tử hoá 16 mức mỗi kênh để gom các
 * điểm "gần trắng" lại với nhau), rồi lấy trung bình các điểm thuộc nhóm đó.
 */
function detectBackground(data: Uint8ClampedArray, border: number[]): [number, number, number] | null {
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>()
  let transparent = 0

  for (const p of border) {
    const i = p * 4
    if (data[i + 3]! < 200) {
      transparent++
      continue
    }
    const key = ((data[i]! >> 4) << 8) | ((data[i + 1]! >> 4) << 4) | (data[i + 2]! >> 4)
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count++
    bucket.r += data[i]!
    bucket.g += data[i + 1]!
    bucket.b += data[i + 2]!
    buckets.set(key, bucket)
  }

  // Mép đã trong suốt phần lớn: ảnh PNG đã tách nền sẵn, không đụng vào.
  if (transparent > border.length * 0.5) {
    throw new BackgroundNotRemovableError('ALREADY_TRANSPARENT')
  }

  let best: { count: number; r: number; g: number; b: number } | null = null
  for (const bucket of buckets.values()) {
    if (!best || bucket.count > best.count) best = bucket
  }
  if (!best) return null
  return [best.r / best.count, best.g / best.count, best.b / best.count]
}

/** Độ trong suốt theo khoảng cách màu: 0 trong vùng HARD, 1 ngoài vùng SOFT, mờ dần ở giữa. */
function alphaFor(dist: number): number {
  if (dist <= HARD_TOLERANCE) return 0
  if (dist >= SOFT_TOLERANCE) return 1
  return (dist - HARD_TOLERANCE) / (SOFT_TOLERANCE - HARD_TOLERANCE)
}

/**
 * Bỏ phần màu nền đã trộn vào điểm ảnh viền ("un-premultiply"), nếu không viền chữ ký
 * mực xanh sẽ còn một quầng trắng mờ khi đặt lên nền tối.
 */
function unmix(data: Uint8ClampedArray, i: number, bg: [number, number, number], alpha: number) {
  if (alpha <= 0 || alpha >= 1) return
  for (let c = 0; c < 3; c++) {
    const value = (data[i + c]! - bg[c]! * (1 - alpha)) / alpha
    data[i + c] = Math.max(0, Math.min(255, Math.round(value)))
  }
}

function processPixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mode: BackgroundRemovalMode
) {
  const border = borderPixels(width, height)
  const bg = detectBackground(data, border)
  if (!bg) throw new BackgroundNotRemovableError('NOT_UNIFORM')

  const uniform = border.filter((p) => distance(data, p * 4, bg) <= SOFT_TOLERANCE).length
  // Ảnh chụp nhiều màu ở mép (ảnh người, phong cảnh) thì không có "nền" nào để xoá.
  if (uniform < border.length * MIN_UNIFORM_BORDER) {
    throw new BackgroundNotRemovableError('NOT_UNIFORM')
  }

  const apply = (p: number) => {
    const i = p * 4
    const alpha = alphaFor(distance(data, i, bg))
    if (alpha >= 1) return
    unmix(data, i, bg, alpha)
    data[i + 3] = Math.round(data[i + 3]! * alpha)
  }

  if (mode === 'signature') {
    for (let p = 0; p < width * height; p++) apply(p)
    return
  }

  // Logo: loang từ mép vào, dừng ở điểm khác hẳn màu nền. Điểm viền (vùng SOFT) được làm
  // mờ nhưng không loang tiếp qua nó — tránh lan vào phần trắng bên trong logo.
  const visited = new Uint8Array(width * height)
  const stack: number[] = []
  for (const p of border) {
    if (distance(data, p * 4, bg) < SOFT_TOLERANCE) {
      visited[p] = 1
      stack.push(p)
    }
  }

  while (stack.length) {
    const p = stack.pop()!
    const isCore = distance(data, p * 4, bg) <= HARD_TOLERANCE
    apply(p)
    if (!isCore) continue

    const x = p % width
    const y = (p - x) / width
    const neighbours = [
      x > 0 ? p - 1 : -1,
      x < width - 1 ? p + 1 : -1,
      y > 0 ? p - width : -1,
      y < height - 1 ? p + width : -1,
    ]
    for (const n of neighbours) {
      if (n < 0 || visited[n]) continue
      if (distance(data, n * 4, bg) < SOFT_TOLERANCE) {
        visited[n] = 1
        stack.push(n)
      }
    }
  }
}

/** Cắt bỏ phần trong suốt thừa quanh nét: chữ ký nhỏ giữa khung trống thì in ra bé tí. */
function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  const { data } = ctx.getImageData(0, 0, width, height)

  let top = height
  let left = width
  let right = -1
  let bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return canvas

  const pad = 4
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  right = Math.min(width - 1, right + pad)
  bottom = Math.min(height - 1, bottom + pad)

  const out = document.createElement('canvas')
  out.width = right - left + 1
  out.height = bottom - top + 1
  out.getContext('2d')!.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

/**
 * Xoá nền một ảnh (tệp vừa chọn hoặc URL đã tải lên), trả về tệp PNG nền trong.
 *
 * @throws BackgroundNotRemovableError khi ảnh đã trong suốt sẵn hoặc không có nền đồng màu
 */
export async function removeImageBackground(
  source: File | string,
  mode: BackgroundRemovalMode
): Promise<File> {
  const objectUrl = typeof source === 'string' ? null : URL.createObjectURL(source)
  try {
    const img = await loadImage(objectUrl ?? (source as string))
    const ratio = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const width = Math.max(1, Math.round(img.naturalWidth * ratio))
    const height = Math.max(1, Math.round(img.naturalHeight * ratio))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, width, height)

    const imageData = ctx.getImageData(0, 0, width, height)
    processPixels(imageData.data, width, height, mode)
    ctx.putImageData(imageData, 0, 0)

    const trimmed = trimTransparent(canvas)
    const blob = await new Promise<Blob>((resolve, reject) =>
      trimmed.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png')
    )

    const baseName =
      typeof source === 'string'
        ? 'image'
        : source.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([blob], `${baseName}-nobg.png`, { type: 'image/png' })
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl)
  }
}
