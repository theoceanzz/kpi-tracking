import type ExcelJSNs from 'exceljs'
import type { ICellData, IRange, IStyleData, IWorkbookData, IWorksheetData } from '@univerjs/presets'

/*
 * Chuyển qua lại giữa tệp bảng tính (.xlsx / .csv) và snapshot của trình bảng tính Univer (nội dung tệp `.kgsheet`).
 * Đọc .xlsx bằng exceljs (có kiểu dáng), .csv bằng SheetJS. Giữ: giá trị, công thức (kèm kết quả đã tính), định dạng số,
 * đậm / nghiêng / gạch, cỡ & màu chữ, màu nền, căn lề, xuống dòng, viền, gộp ô, độ rộng cột, chiều cao hàng, cố định
 * hàng/cột. Không giữ: biểu đồ, ảnh, macro, định dạng có điều kiện, kiểm tra dữ liệu của tệp gốc — tệp gốc vẫn nằm trong
 * tab Phiên bản. Hằng số enum viết số trực tiếp (giá trị cố định của Univer) để khỏi kéo cả lõi Univer vào bundle này.
 */

const STRING = 1
const NUMBER = 2
const BOOLEAN = 3
const WRAP = 3
const H_ALIGN: Record<string, number> = { left: 1, center: 2, right: 3, justify: 4, distributed: 6 }
const V_ALIGN: Record<string, number> = { top: 1, middle: 2, bottom: 3 }
const BORDER: Record<string, number> = {
  thin: 1, hair: 2, dotted: 3, dashed: 4, dashDot: 5, dashDotDot: 6, double: 7, medium: 8, mediumDashed: 9,
  mediumDashDot: 10, mediumDashDotDot: 11, slantDashDot: 12, thick: 13,
}
/** Dấu BOM: CSV mở bằng Excel mới nhận đúng UTF-8 (tiếng Việt). */
const BOM = String.fromCharCode(0xfeff)
const BOM_RE = new RegExp(`^${BOM}`)
const MIN_ROWS = 1000
const MIN_COLS = 26
/** Độ rộng cột Excel (số ký tự) ↔ px, chiều cao hàng (pt) ↔ px. */
const charsToPx = (w: number) => Math.round(w * 7 + 5)
const pxToChars = (px: number) => Math.max(1, (px - 5) / 7)

function emptyWorkbook(name: string): IWorkbookData {
  return { id: crypto.randomUUID(), name, appVersion: '', locale: 'viVN' as IWorkbookData['locale'], styles: {}, sheetOrder: [], sheets: {} }
}

function sheet(id: string, name: string, rows: number, cols: number): Partial<IWorksheetData> {
  return { id, name, rowCount: Math.max(MIN_ROWS, rows + 100), columnCount: Math.max(MIN_COLS, cols + 5), cellData: {}, mergeData: [] }
}

const argbToHex = (argb?: string) => (argb && /^[0-9a-f]{8}$/i.test(argb) ? `#${argb.slice(2)}` : argb && /^[0-9a-f]{6}$/i.test(argb) ? `#${argb}` : undefined)
const hexToArgb = (hex?: string | null | void) => (hex && /^#[0-9a-f]{6}$/i.test(hex) ? `FF${hex.slice(1).toUpperCase()}` : undefined)

/** "B3" → {r: 2, c: 1} */
function decodeAddress(a: string): { r: number; c: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/i.exec(a.trim())
  if (!m) return { r: 0, c: 0 }
  let c = 0
  for (const ch of (m[1] ?? '').toUpperCase()) c = c * 26 + (ch.charCodeAt(0) - 64)
  return { r: Number(m[2]) - 1, c: c - 1 }
}

/** Ngày JS → số ngày kiểu Excel (hệ 1900). */
const excelSerial = (d: Date) => (d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000

function styleFromExcel(s: Partial<ExcelJSNs.Style> | undefined): IStyleData | null {
  if (!s) return null
  const out: IStyleData = {}
  const f = s.font
  if (f) {
    if (f.bold) out.bl = 1
    if (f.italic) out.it = 1
    if (f.underline) out.ul = { s: 1 }
    if (f.strike) out.st = { s: 1 }
    if (f.size) out.fs = f.size
    if (f.name) out.ff = f.name
    const cl = argbToHex(f.color?.argb)
    if (cl) out.cl = { rgb: cl }
  }
  const fill = s.fill
  if (fill && fill.type === 'pattern' && fill.pattern === 'solid') {
    const bg = argbToHex((fill.fgColor as { argb?: string } | undefined)?.argb)
    if (bg) out.bg = { rgb: bg }
  }
  const a = s.alignment
  if (a) {
    if (a.horizontal && H_ALIGN[a.horizontal]) out.ht = H_ALIGN[a.horizontal] as IStyleData['ht']
    if (a.vertical && V_ALIGN[a.vertical]) out.vt = V_ALIGN[a.vertical] as IStyleData['vt']
    if (a.wrapText) out.tb = WRAP as IStyleData['tb']
  }
  if (s.numFmt && s.numFmt !== 'General') out.n = { pattern: s.numFmt }
  const b = s.border
  if (b) {
    const side = (x?: Partial<ExcelJSNs.Border>) => x?.style && BORDER[x.style]
      ? { s: BORDER[x.style], cl: { rgb: argbToHex(x.color?.argb) ?? '#000000' } } : undefined
    const bd = { t: side(b.top), r: side(b.right), b: side(b.bottom), l: side(b.left) }
    if (bd.t || bd.r || bd.b || bd.l) out.bd = bd as IStyleData['bd']
  }
  return Object.keys(out).length ? out : null
}

/** Gom kiểu trùng nhau thành một mục trong bảng `styles` của workbook (snapshot gọn hơn nhiều). */
function styleRegistry(wb: IWorkbookData) {
  const ids = new Map<string, string>()
  return (style: IStyleData | null): string | undefined => {
    if (!style) return undefined
    const key = JSON.stringify(style)
    let id = ids.get(key)
    if (!id) {
      id = `s${ids.size + 1}`
      ids.set(key, id)
      wb.styles[id] = style
    }
    return id
  }
}

/** Tệp .xlsx → snapshot Univer. */
export async function xlsxToWorkbook(buffer: ArrayBuffer, name: string): Promise<IWorkbookData> {
  const ExcelJS = (await import('exceljs')).default
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(buffer)
  const wb = emptyWorkbook(name)
  const styleId = styleRegistry(wb)

  book.worksheets.forEach((ws, index) => {
    const id = `sheet-${index + 1}`
    const data = sheet(id, ws.name, ws.rowCount, ws.columnCount)
    const cells: Record<number, Record<number, ICellData>> = {}

    ws.eachRow({ includeEmpty: false }, (row, r) => {
      if (row.height) (data.rowData ??= {})[r - 1] = { h: Math.round(row.height * 4 / 3) }
      row.eachCell({ includeEmpty: false }, (cell, c) => {
        const out: ICellData = {}
        const v = cell.value
        if (v instanceof Date) {
          out.v = excelSerial(v)
          out.t = NUMBER
        } else if (typeof v === 'number') {
          out.v = v
          out.t = NUMBER
        } else if (typeof v === 'string') {
          out.v = v
          out.t = STRING
        } else if (typeof v === 'boolean') {
          out.v = v
          out.t = BOOLEAN
        } else if (v && typeof v === 'object') {
          if ('formula' in v || 'sharedFormula' in v) {
            const formula = cell.formula
            if (formula) out.f = `=${formula}`
            const res = (v as ExcelJSNs.CellFormulaValue).result
            if (typeof res === 'number' || typeof res === 'string' || typeof res === 'boolean') {
              out.v = res
              out.t = typeof res === 'number' ? NUMBER : typeof res === 'boolean' ? BOOLEAN : STRING
            } else if (res instanceof Date) {
              out.v = excelSerial(res)
              out.t = NUMBER
            }
          } else if ('richText' in v) {
            out.v = v.richText.map(p => p.text).join('')
            out.t = STRING
          } else if ('hyperlink' in v) {
            out.v = typeof v.text === 'string' ? v.text : String(v.hyperlink)
            out.t = STRING
          } else if ('error' in v) {
            out.v = v.error
            out.t = STRING
          }
        }
        let style = styleFromExcel(cell.style)
        // Ngày không có định dạng số riêng: cho một định dạng ngày để khỏi hiện số sê-ri.
        if (v instanceof Date && !style?.n) style = { ...(style ?? {}), n: { pattern: 'dd/mm/yyyy' } }
        const s = styleId(style)
        if (s) out.s = s
        if (out.v !== undefined || out.f || out.s) (cells[r - 1] ??= {})[c - 1] = out
      })
    })
    data.cellData = cells

    const merges: IRange[] = []
    for (const m of (ws.model as { merges?: string[] }).merges ?? []) {
      const [a = '', b] = m.split(':')
      const s = decodeAddress(a)
      const e = decodeAddress(b ?? a)
      merges.push({ startRow: s.r, startColumn: s.c, endRow: e.r, endColumn: e.c })
    }
    data.mergeData = merges

    ws.columns?.forEach((col, i) => {
      if (col?.width) (data.columnData ??= {})[i] = { w: charsToPx(col.width) }
    })
    const view = ws.views?.[0] as { state?: string; xSplit?: number; ySplit?: number } | undefined
    if (view?.state === 'frozen' && (view.xSplit || view.ySplit)) {
      data.freeze = { xSplit: view.xSplit ?? 0, ySplit: view.ySplit ?? 0, startRow: view.ySplit ?? 0, startColumn: view.xSplit ?? 0 }
    }
    if (ws.state === 'hidden' || ws.state === 'veryHidden') data.hidden = 1
    wb.sheetOrder.push(id)
    wb.sheets[id] = data
  })
  if (wb.sheetOrder.length === 0) {
    wb.sheetOrder.push('sheet-1')
    wb.sheets['sheet-1'] = sheet('sheet-1', 'Sheet1', 0, 0)
  }
  return wb
}

/**
 * Một ô CSV: chỉ nhận là số khi viết đúng kiểu số chuẩn ("12", "-3.5") — "1,5", "0012", mã số dài giữ nguyên là chữ để
 * không đổi nghĩa hay mất số 0 đầu.
 */
function csvCell(v: unknown): ICellData {
  if (typeof v === 'number') return { v, t: NUMBER }
  const s = String(v)
  if (/^-?(0|[1-9]\d{0,14})(\.\d+)?$/.test(s)) return { v: Number(s), t: NUMBER }
  return { v: s, t: STRING }
}

/** Tệp .csv → snapshot Univer (một trang tính, nhận số tự động). */
export async function csvToWorkbook(text: string, name: string): Promise<IWorkbookData> {
  const XLSX = await import('xlsx')
  // raw: giữ nguyên chữ — tự đoán số của SheetJS đọc "1,5" (thập phân kiểu Việt) thành 15.
  const book = XLSX.read(text.replace(BOM_RE, ''), { type: 'string', raw: true })
  const first = book.SheetNames[0]
  const rows = first ? XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[first]!, { header: 1, raw: true, defval: null }) : []
  const wb = emptyWorkbook(name)
  const cols = rows.reduce((m, r) => Math.max(m, r.length), 0)
  const data = sheet('sheet-1', name.slice(0, 31) || 'Sheet1', rows.length, cols)
  const cells: Record<number, Record<number, ICellData>> = {}
  rows.forEach((r, ri) => r.forEach((v, ci) => {
    if (v === null || v === '') return
    ;(cells[ri] ??= {})[ci] = csvCell(v)
  }))
  data.cellData = cells
  wb.sheetOrder.push('sheet-1')
  wb.sheets['sheet-1'] = data
  return wb
}

function resolveStyle(wb: IWorkbookData, s: ICellData['s']): IStyleData | null {
  if (!s) return null
  return typeof s === 'string' ? (wb.styles[s] ?? null) : s
}

const H_ALIGN_BACK = Object.fromEntries(Object.entries(H_ALIGN).map(([k, v]) => [v, k]))
const V_ALIGN_BACK = Object.fromEntries(Object.entries(V_ALIGN).map(([k, v]) => [v, k]))
const BORDER_BACK = Object.fromEntries(Object.entries(BORDER).map(([k, v]) => [v, k]))

/** Snapshot Univer → tệp .xlsx (tải về / mở bằng Excel). */
export async function workbookToXlsx(wb: IWorkbookData): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default
  const book = new ExcelJS.Workbook()
  for (const id of wb.sheetOrder) {
    const data = wb.sheets[id]
    if (!data) continue
    const ws = book.addWorksheet((data.name || id).slice(0, 31))
    for (const [r, row] of Object.entries(data.cellData ?? {})) {
      for (const [c, cell] of Object.entries(row as Record<string, ICellData>)) {
        const target = ws.getCell(Number(r) + 1, Number(c) + 1)
        const v = cell.v
        const value = cell.t === BOOLEAN ? Boolean(v) : v
        if (cell.f) {
          target.value = { formula: cell.f.replace(/^=/, ''), result: value ?? undefined } as ExcelJSNs.CellFormulaValue
        } else if (value !== undefined && value !== null) {
          target.value = value as ExcelJSNs.CellValue
        }
        const st = resolveStyle(wb, cell.s)
        if (!st) continue
        const font: Partial<ExcelJSNs.Font> = {}
        if (st.bl) font.bold = true
        if (st.it) font.italic = true
        if (st.ul?.s) font.underline = true
        if (st.st?.s) font.strike = true
        if (st.fs) font.size = st.fs
        if (st.ff) font.name = st.ff
        const cl = hexToArgb(st.cl?.rgb)
        if (cl) font.color = { argb: cl }
        if (Object.keys(font).length) target.font = font
        const bg = hexToArgb(st.bg?.rgb)
        if (bg) target.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
        const al: Partial<ExcelJSNs.Alignment> = {}
        if (st.ht && H_ALIGN_BACK[st.ht]) al.horizontal = H_ALIGN_BACK[st.ht] as ExcelJSNs.Alignment['horizontal']
        if (st.vt && V_ALIGN_BACK[st.vt]) al.vertical = V_ALIGN_BACK[st.vt] as ExcelJSNs.Alignment['vertical']
        if (st.tb === WRAP) al.wrapText = true
        if (Object.keys(al).length) target.alignment = al
        if (st.n?.pattern) target.numFmt = st.n.pattern
        if (st.bd) {
          const side = (x?: { s: number; cl?: { rgb?: string | null | void } | null } | null | void) => x && BORDER_BACK[x.s]
            ? { style: BORDER_BACK[x.s] as ExcelJSNs.BorderStyle, color: { argb: hexToArgb(x.cl?.rgb) ?? 'FF000000' } } : undefined
          target.border = { top: side(st.bd.t), right: side(st.bd.r), bottom: side(st.bd.b), left: side(st.bd.l) }
        }
      }
    }
    for (const m of data.mergeData ?? []) ws.mergeCells(m.startRow + 1, m.startColumn + 1, m.endRow + 1, m.endColumn + 1)
    for (const [c, col] of Object.entries(data.columnData ?? {})) {
      if (col?.w) ws.getColumn(Number(c) + 1).width = pxToChars(col.w)
    }
    for (const [r, row] of Object.entries(data.rowData ?? {})) {
      if (row?.h) ws.getRow(Number(r) + 1).height = row.h * 3 / 4
    }
    if (data.freeze && (data.freeze.xSplit || data.freeze.ySplit)) {
      ws.views = [{ state: 'frozen', xSplit: data.freeze.xSplit, ySplit: data.freeze.ySplit }]
    }
  }
  const buf = await book.xlsx.writeBuffer()
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

/** Trang tính đang mở → CSV (chỉ giá trị; CSV không giữ được công thức hay kiểu dáng). */
export function sheetToCsv(wb: IWorkbookData, sheetId?: string): string {
  const id = sheetId ?? wb.sheetOrder[0]
  const data = id ? wb.sheets[id] : undefined
  const cells = (data?.cellData ?? {}) as Record<string, Record<string, ICellData>>
  const rowKeys = Object.keys(cells).map(Number)
  if (rowKeys.length === 0) return ''
  const maxRow = Math.max(...rowKeys)
  const maxCol = Math.max(0, ...rowKeys.flatMap(r => Object.keys(cells[r] ?? {}).map(Number)))
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines: string[] = []
  for (let r = 0; r <= maxRow; r++) {
    const row = cells[r] ?? {}
    const vals: string[] = []
    for (let c = 0; c <= maxCol; c++) vals.push(esc(row[c]?.v))
    lines.push(vals.join(','))
  }
  return `${BOM}${lines.join('\r\n')}\r\n`
}
