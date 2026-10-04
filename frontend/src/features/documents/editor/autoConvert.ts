import { documentApi } from '../api/documentApi'
import type { KbDocument } from '../types'

/** Tệp tự chuyển sang dạng soạn trực tuyến khi tải lên / thay tệp: Word, Markdown (→ tài liệu), Excel, CSV (→ bảng tính). */
export function isAutoConvertible(doc: Pick<KbDocument, 'fileName' | 'legacy'>): boolean {
  const name = doc.fileName?.toLowerCase() ?? ''
  return !doc.legacy && /\.(docx|md|xlsx|csv)$/.test(name)
}

const isSheetFile = (name: string) => /\.(xlsx|csv)$/.test(name)

/** Tên bảng tính trong snapshot: tên tệp bỏ đuôi. */
const baseName = (fileName: string) => fileName.replace(/\.[^.]+$/, '')

/**
 * Chuyển TẠI CHỖ sang dạng soạn trực tuyến (kiểu Google Docs: tải lên là sửa được ngay): .docx / .md → tài liệu khối
 * (BlockNote + mammoth), .xlsx / .csv → bảng tính Univer (exceljs / SheetJS). Đọc và dựng ngay trên trình duyệt (nạp
 * muộn) rồi gửi một lần — tệp gốc vào tab Phiên bản. `content` / `baseHash` truyền khi đã có sẵn khối (trình soạn .md).
 */
export async function convertToOnline(doc: KbDocument, content?: string, baseHash?: string): Promise<KbDocument> {
  const name = doc.fileName?.toLowerCase() ?? ''
  let json = content
  let hash = baseHash ?? doc.contentHash ?? ''
  if (json === undefined && isSheetFile(name)) {
    // Bảng → bảng tính Univer (exceljs / SheetJS nạp muộn).
    const conv = await import('./sheetConvert')
    const bytes = await documentApi.fileBytes(doc.id)
    const wb = name.endsWith('.csv')
      ? await conv.csvToWorkbook(new TextDecoder('utf-8').decode(bytes), baseName(doc.fileName ?? doc.title))
      : await conv.xlsxToWorkbook(bytes, baseName(doc.fileName ?? doc.title))
    return documentApi.convertOnline(doc.id, JSON.stringify(wb), hash)
  }
  const blocks = await import('./blocks')
  if (json === undefined) {
    if (doc.fileName?.toLowerCase().endsWith('.md')) {
      const md = await documentApi.content(doc.id)
      hash = md.contentHash
      json = JSON.stringify(blocks.parseMarkdownToBlocks(md.content) ?? [])
    } else {
      json = await blocks.docxToBlocksJson(await documentApi.fileBytes(doc.id))
    }
  }
  return documentApi.convertOnline(doc.id, json, hash)
}

/**
 * Sau khi tải lên / thay tệp: tự chuyển nếu được. Chuyển hỏng KHÔNG làm hỏng lượt tải lên — tệp đã lưu, chỉ chưa sửa
 * được trên web; trả lại tài liệu như cũ kèm cờ để báo cho người dùng.
 */
export async function autoConvert(doc: KbDocument): Promise<{ doc: KbDocument; convertFailed: boolean }> {
  if (!isAutoConvertible(doc) || !doc.canEdit) return { doc, convertFailed: false }
  try {
    return { doc: await convertToOnline(doc), convertFailed: false }
  } catch (e) {
    console.error('Tự chuyển tài liệu sang dạng soạn trực tuyến thất bại', e)
    return { doc, convertFailed: true }
  }
}
