import { BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import { en, vi } from '@blocknote/core/locales'

/** Chữ giao diện của BlockNote (menu `/`, thanh định dạng, chữ gợi ý) theo ngôn ngữ đang dùng. */
export function blockNoteDictionary(language: string) {
  return language.startsWith('en') ? en : vi
}

/** Nội dung `.kgdoc` → khối ban đầu. Rỗng / hỏng → undefined (BlockNote tự tạo một đoạn trống). */
export function parseBlocks(json: string): PartialBlock[] | undefined {
  try {
    const parsed: unknown = JSON.parse(json)
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as PartialBlock[]) : undefined
  } catch {
    return undefined
  }
}

/** Editor không gắn DOM, chỉ để chuyển định dạng (Markdown / HTML → khối). */
function headless() {
  return BlockNoteEditor.create()
}

export function parseMarkdownToBlocks(markdown: string): PartialBlock[] | undefined {
  if (!markdown.trim()) return undefined
  const blocks = headless().tryParseMarkdownToBlocks(markdown)
  return blocks.length > 0 ? blocks : undefined
}

/**
 * Tệp Word → mảng khối JSON (nội dung của `.kgdoc`), như "Nhập thành tài liệu" của Lark. mammoth đọc .docx ra HTML
 * ngữ nghĩa (tiêu đề, danh sách, bảng, đậm/nghiêng); BlockNote dựng khối từ HTML đó. Ảnh bị bỏ: chúng thành data URL
 * nằm thẳng trong tệp JSON, vài ảnh là vượt trần 10 MB của thư viện. mammoth nạp muộn — chỉ ai bấm chuyển mới tải.
 */
export async function docxToBlocksJson(file: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth')
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: file })
  const withoutImages = html.replace(/<img\b[^>]*>/gi, '')
  return JSON.stringify(headless().tryParseHTMLToBlocks(withoutImages))
}

/** Tải một tệp chữ sinh ngay trên trình duyệt (xuất Markdown / HTML). */
export function saveTextFile(fileName: string, mime: string, text: string) {
  const safe = fileName.replace(/[\\/:*?"<>|]/g, '-')
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }))
  const a = document.createElement('a')
  a.href = url
  a.download = safe
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Bọc HTML của BlockNote thành một trang đủ để Word / trình duyệt mở đúng tiếng Việt. */
export function toHtmlDocument(title: string, body: string): string {
  const esc = title.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc}</title>`
    + '<style>body{font-family:system-ui,sans-serif;max-width:820px;margin:2rem auto;line-height:1.6}'
    + 'table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style>'
    + `</head><body><h1>${esc}</h1>${body}</body></html>`
}
