import { toPng } from 'html-to-image'
import { CertificateOrientation } from '../../types'

/**
 * Xuất chứng nhận thành ảnh PNG và in ra giấy / PDF.
 *
 * <p>Hai đường ra dùng CÙNG một cây DOM đã dựng ở kích thước in thật, nên ảnh tải về và
 * bản in luôn khớp nhau. Không có đường thứ ba nào tự vẽ lại tờ giấy.
 */

/** Bội số độ phân giải khi chụp ảnh. 2× trên khổ A4 ≈ 190dpi — in ra vẫn nét. */
const PIXEL_RATIO = 2

/** Bỏ dấu tiếng Việt và ký tự lạ để tên tệp mở được trên mọi hệ điều hành. */
export function toFileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'chung-nhan'
  )
}

/** Phần tử đã tự sơn nền hay chưa (màu trong suốt hoàn toàn thì coi như chưa). */
function hasOwnBackground(node: HTMLElement): boolean {
  const color = getComputedStyle(node).backgroundColor
  if (!color || color === 'transparent') return false

  const alpha = color.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/)
  return alpha ? Number(alpha[1]) > 0 : true
}

/** GIF 1×1 trong suốt — thay cho ảnh không tải được, để tờ chứng nhận vẫn chụp được. */
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

/** URL ảnh → data URL đã đọc được (hoặc null = không đọc được). Dùng chung cho cả đợt tải. */
const imageCache = new Map<string, Promise<string | null>>()

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Đọc một ảnh về thành data URL. Thử `fetch` CORS trước; trình duyệt từ chối (ảnh nằm ở
 * máy chủ không trả header CORS, hoặc mạng di động chập chờn) thì thử lại một lần không
 * dùng bộ nhớ đệm — bản đệm của thẻ `<img>` đôi khi là bản KHÔNG kèm header CORS.
 */
function readImageAsDataUrl(src: string): Promise<string | null> {
  const cached = imageCache.get(src)
  if (cached) return cached

  const attempt = async (init: RequestInit) => {
    const response = await fetch(src, { mode: 'cors', credentials: 'omit', ...init })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return blobToDataUrl(await response.blob())
  }

  const promise = attempt({})
    .catch(() => attempt({ cache: 'reload' }))
    .catch((error) => {
      console.warn('[certificate] Không đọc được ảnh, bỏ qua khi chụp:', src, error)
      return null
    })
  imageCache.set(src, promise)
  // Ảnh lỗi không giữ trong bộ đệm: lần bấm sau (mạng đã ổn) phải được thử lại.
  promise.then((value) => {
    if (value === null) imageCache.delete(src)
  })
  return promise
}

/**
 * Thay mọi `<img>` trong tờ chứng nhận bằng data URL TRƯỚC khi chụp.
 *
 * <p>html-to-image tự tải ảnh, nhưng chỉ CẦN MỘT ảnh lỗi (logo không cho tải chéo miền,
 * mạng rớt giữa chừng) là nó ném lỗi và cả tờ chứng nhận không chụp được. Tự đọc trước thì
 * ảnh lỗi chỉ bị thay bằng điểm ảnh trong suốt, phần còn lại vẫn ra ảnh.
 *
 * <p>Vùng in nằm ngoài màn hình nên đổi `src` tạm thời không ai thấy; trả về hàm hoàn tác.
 */
async function inlineImages(node: HTMLElement): Promise<{ restore: () => void; failed: number }> {
  const images = Array.from(node.querySelectorAll('img'))
  const originals = images.map((img) => img.getAttribute('src'))
  let failed = 0

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith('data:')) return
      const dataUrl = (await readImageAsDataUrl(src)) ?? (failed++, TRANSPARENT_PIXEL)
      img.removeAttribute('crossorigin')
      img.src = dataUrl
      if (img.decode) await img.decode().catch(() => undefined)
    })
  )

  return {
    failed,
    restore: () =>
      images.forEach((img, i) => {
        img.setAttribute('crossorigin', 'anonymous')
        const src = originals[i]
        if (src) img.setAttribute('src', src)
      }),
  }
}

export interface CertificateCaptureResult {
  blob: Blob
  /** Số ảnh (logo / chữ ký / nền) không đọc được và đã bị bỏ khỏi ảnh. */
  missingImages: number
}

/**
 * Chụp một tờ chứng nhận thành PNG.
 *
 * <p>Thử lần lượt từ đẹp nhất tới chắc ăn nhất: đủ phông chữ ở 2× → bỏ nhúng phông (trình
 * duyệt di động hay chết vì tệp SVG trung gian nhúng hàng MB phông chữ) → 1×. Chỉ khi
 * cả ba đều hỏng mới báo lỗi cho người dùng.
 */
export async function certificateToPngBlob(node: HTMLElement): Promise<CertificateCaptureResult> {
  const { restore, failed } = await inlineImages(node)

  // Nền trắng CHỈ khi tờ chứng nhận không tự có nền: `backgroundColor` của
  // html-to-image ghi đè thẳng vào style của bản sao gốc, nên truyền vô điều kiện sẽ
  // xoá mất nền của các mẫu tối — chữ trắng nằm trên nền trắng và biến mất khỏi ảnh.
  const base = {
    ...(hasOwnBackground(node) ? {} : { backgroundColor: '#ffffff' }),
    imagePlaceholder: TRANSPARENT_PIXEL,
    // Ảnh nào vẫn lỗi lúc dựng thì bỏ qua thay vì làm hỏng cả lần chụp.
    onImageErrorHandler: () => undefined,
  }
  const attempts = [
    { ...base, pixelRatio: PIXEL_RATIO },
    { ...base, pixelRatio: PIXEL_RATIO, skipFonts: true },
    { ...base, pixelRatio: 1, skipFonts: true },
  ]

  try {
    let lastError: unknown
    for (const options of attempts) {
      try {
        const dataUrl = await toPng(node, options)
        // Ảnh rỗng ("data:,") = canvas vượt giới hạn của trình duyệt, coi như hỏng.
        if (dataUrl.length < 100) throw new Error('Empty capture')
        const response = await fetch(dataUrl)
        return { blob: await response.blob(), missingImages: failed }
      } catch (error) {
        lastError = error
        console.warn('[certificate] Chụp thất bại, thử cách khác:', error)
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Certificate capture failed')
  } finally {
    restore()
  }
}

const withExt = (name: string, ext: string) => (name.endsWith(`.${ext}`) ? name : `${name}.${ext}`)

/** Đưa một blob xuống máy bằng thẻ `<a download>`. */
function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Thu hồi sau một nhịp: gọi ngay lập tức thì Safari huỷ luôn lượt tải đang bắt đầu.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Tải chứng nhận: một người → một tệp PNG, nhiều người → MỘT tệp ZIP chứa mỗi người một PNG.
 *
 * <p>Gộp ZIP vì mỗi lượt tải là một lần trình duyệt can thiệp: Chrome hỏi "cho phép tải nhiều
 * tệp?", và ai bật "hỏi nơi lưu từng tệp" thì phải bấm qua hộp Lưu của Windows cho TỪNG người.
 * Một tệp ZIP = đúng một lần hỏi dù in cho cả phòng.
 *
 * <p>Chụp TUẦN TỰ chứ không `Promise.all`: chụp song song nhiều tờ A4 ở 2× làm trình duyệt dựng
 * cùng lúc mấy canvas cỡ 2246×1588 và tab treo trên máy yếu.
 *
 * @param archiveName tên tệp ZIP (không cần đuôi) khi có nhiều hơn một người
 */
export async function downloadCertificateBatch(
  items: { node: HTMLElement; fileName: string }[],
  archiveName: string,
  onProgress?: (done: number, total: number) => void
): Promise<{ missingImages: number }> {
  let missingImages = 0
  const captured: { name: string; blob: Blob }[] = []
  const usedNames = new Set<string>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue

    const { blob, missingImages: missing } = await certificateToPngBlob(item.node)
    missingImages = Math.max(missingImages, missing)

    // Hai người trùng họ tên thì tệp sau đè mất tệp trước trong ZIP — đánh số cho khác nhau.
    let name = withExt(item.fileName, 'png')
    for (let n = 2; usedNames.has(name); n++) name = withExt(`${item.fileName}-${n}`, 'png')
    usedNames.add(name)
    captured.push({ name, blob })
    onProgress?.(i + 1, items.length)
  }

  if (captured.length === 1) {
    saveBlob(captured[0]!.blob, captured[0]!.name)
  } else if (captured.length > 1) {
    // Nạp lúc cần: chỉ người tải nhiều chứng nhận cùng lúc mới phải tải thêm thư viện nén.
    const { default: JSZip } = await import('jszip')
    const zip = new JSZip()
    // PNG đã nén sẵn — nén thêm chỉ tốn thời gian mà không nhỏ đi.
    captured.forEach(({ name, blob }) => zip.file(name, blob, { compression: 'STORE' }))
    saveBlob(await zip.generateAsync({ type: 'blob' }), withExt(archiveName, 'zip'))
  }
  return { missingImages }
}

const PAGE_STYLE_ID = 'certificate-page-style'
const PRINTING_CLASS = 'certificate-printing'

/**
 * Mở hộp thoại in của trình duyệt cho khu vực chứng nhận đang ẩn.
 *
 * <p>In THẲNG cây DOM chứ không in ảnh PNG: chữ giữ nguyên dạng vector nên nét ở mọi cỡ
 * giấy, và người dùng chọn "Lưu thành PDF" thì ra một tệp PDF chữ chọn được.
 *
 * <p>`@page size` là thuộc tính của cả tài liệu, không đặt được cho riêng một phần tử —
 * nên hướng giấy phải bơm vào bằng một thẻ style tạm ngay trước khi in rồi gỡ đi.
 */
export function printCertificateArea(orientation: CertificateOrientation): void {
  const previous = document.getElementById(PAGE_STYLE_ID)
  previous?.remove()

  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = `@page { size: A4 ${
    orientation === CertificateOrientation.PORTRAIT ? 'portrait' : 'landscape'
  }; margin: 0; }`
  document.head.appendChild(style)

  document.body.classList.add(PRINTING_CLASS)

  const cleanup = () => {
    document.body.classList.remove(PRINTING_CLASS)
    document.getElementById(PAGE_STYLE_ID)?.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  // Một nhịp để trình duyệt kịp áp lại layout theo class vừa thêm; in ngay lập tức thì
  // Safari chụp lại trạng thái CŨ và in ra trang trắng.
  setTimeout(() => {
    window.print()
    // Firefox không phải lúc nào cũng bắn `afterprint`; dọn thêm một lần cho chắc.
    setTimeout(cleanup, 1500)
  }, 60)
}
