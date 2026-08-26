import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { ConductSheet, ConductStatus } from '../api/conductApi'

/**
 * Xuất phiếu hạnh kiểm ra Excel, dựng lại ĐÚNG khuôn phiếu giấy: hai tầng tiêu đề gộp ô,
 * mỗi tiêu chí một dòng kèm các biểu hiện, và hàng chân bảng cộng điểm đã tính trọng số.
 *
 * Nhận `rows`/`totals` từ màn hình chứ không đọc lại `sheet.items`: người dùng bấm xuất
 * ngay sau khi gõ điểm thì file phải khớp với thứ họ đang nhìn, không phải bản đã lưu.
 */

export interface ConductExportRow {
  name: string
  description?: string | null
  weight: number
  selfScore: number | null
  selfEvidence: string
  managerScore: number | null
  managerComment: string
  selfWeighted: number | null
  managerWeighted: number | null
}

const STATUS_LABEL: Record<ConductStatus, string> = {
  DRAFT: 'Chưa chấm',
  SELF_SUBMITTED: 'Đã tự đánh giá',
  REVIEWED: 'Quản lý đã chấm',
}

const NAVY = 'FF1E3A6D'
const sanitize = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60)
const cell = (v: number | null | undefined) => (v == null ? '—' : Number(v.toFixed(2)))

const thin = {
  top: { style: 'thin' as const },
  left: { style: 'thin' as const },
  bottom: { style: 'thin' as const },
  right: { style: 'thin' as const },
}

export async function exportConductSheetToExcel(
  sheet: ConductSheet,
  rows: ConductExportRow[],
  totals: { self: number | null; manager: number | null },
  comment: string,
) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Hạnh kiểm')

  // 1. Tiêu đề
  ws.mergeCells('A1:I1')
  const title = ws.getCell('A1')
  title.value = 'ĐÁNH GIÁ XẾP LOẠI HÀNH VI THEO TRIẾT LÝ GIÁO DỤC'
  title.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws.getRow(1).height = 26

  // 2. Thông tin phiếu
  const info: [string, string][] = [
    ['Người được đánh giá', sheet.userName || '—'],
    [sheet.scope === 'PERIOD' ? 'Đợt đánh giá' : 'Kỳ đánh giá', sheet.targetName || '—'],
    ['Trạng thái', STATUS_LABEL[sheet.status]],
    ['Thang điểm mỗi tiêu chí', String(sheet.maxScore)],
  ]
  if (sheet.evaluatorName) info.push(['Cán bộ quản lý chấm', sheet.evaluatorName])
  if (sheet.locked) {
    info.push(['Khoá', `Đơn vị "${sheet.lockedByUnitName ?? '—'}" đã chốt kỳ — phiếu chỉ để xem`])
  }
  info.push(['Ngày xuất', format(new Date(), 'dd/MM/yyyy HH:mm')])

  info.forEach(([label, value]) => {
    const row = ws.addRow([])
    row.getCell(1).value = label
    row.getCell(3).value = value
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } }
    row.getCell(3).font = { name: 'Arial', size: 10 }
    ws.mergeCells(`A${row.number}:B${row.number}`)
    ws.mergeCells(`C${row.number}:I${row.number}`)
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  })

  ws.addRow([])

  // 3. Tiêu đề bảng — hai tầng gộp ô như phiếu giấy
  const h1 = ws.addRow([
    'STT', 'CÁC TIÊU CHÍ ĐỊNH TÍNH\n(Thái độ, hành vi…)', 'Trọng số',
    'Điểm xếp loại hành vi', '', 'Điểm xếp loại hành vi', '',
    'Điểm xếp loại đã tính đến trọng số', '',
  ])
  const h2 = ws.addRow([
    '', '', '',
    'Do CBNV/giảng viên tự đánh giá', 'Dẫn chứng',
    'Do CBQLTT đánh giá', 'Nhận xét của Cán bộ quản lý',
    'Theo mức đánh giá của CBNV/giảng viên', 'Theo mức đánh giá của CBQLTT',
  ])

  ws.mergeCells(`A${h1.number}:A${h2.number}`)
  ws.mergeCells(`B${h1.number}:B${h2.number}`)
  ws.mergeCells(`C${h1.number}:C${h2.number}`)
  ws.mergeCells(`D${h1.number}:E${h1.number}`)
  ws.mergeCells(`F${h1.number}:G${h1.number}`)
  ws.mergeCells(`H${h1.number}:I${h1.number}`)

  ;[h1, h2].forEach(row => {
    row.height = 38
    for (let c = 1; c <= 9; c++) {
      const cur = row.getCell(c)
      cur.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } }
      cur.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      cur.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cur.border = thin
    }
  })

  // 4. Các dòng tiêu chí
  rows.forEach((r, i) => {
    // Mô tả gộp vào ô tiêu chí, mỗi biểu hiện một dòng có gạch đầu dòng — giống trên màn hình.
    const bullets = (r.description ?? '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => `- ${l}`)
      .join('\n')

    const row = ws.addRow([
      i + 1,
      bullets ? `${r.name}\n${bullets}` : r.name,
      `${r.weight}%`,
      cell(r.selfScore),
      r.selfEvidence || '',
      cell(r.managerScore),
      r.managerComment || '',
      cell(r.selfWeighted),
      cell(r.managerWeighted),
    ])
    row.eachCell((cur, colNum) => {
      cur.font = { name: 'Arial', size: 10 }
      cur.alignment = {
        vertical: 'top',
        horizontal: colNum === 2 || colNum === 5 || colNum === 7 ? 'left' : 'center',
        wrapText: true,
      }
      cur.border = thin
    })
  })

  // 5. Hàng cộng điểm
  // Nhãn đặt ở ô A (ô chủ của vùng gộp A:G) sau khi gộp — giá trị ở các ô bị gộp sẽ bị bỏ.
  const totalRow = ws.addRow(['', '', '', '', '', '', '', cell(totals.self), cell(totals.manager)])
  ws.mergeCells(`A${totalRow.number}:G${totalRow.number}`)
  for (let c = 1; c <= 9; c++) {
    const cur = totalRow.getCell(c)
    cur.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cur.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
    cur.alignment = { vertical: 'middle', horizontal: c <= 7 ? 'right' : 'center' }
    cur.border = thin
  }
  totalRow.getCell(1).value = 'Điểm hành vi đã tính đến trọng số:'
  totalRow.height = 22

  // 6. Nhận xét chung
  if (comment?.trim()) {
    ws.addRow([])
    const noteRow = ws.addRow([])
    noteRow.getCell(1).value = 'Nhận xét chung của cán bộ quản lý'
    noteRow.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } }
    ws.mergeCells(`A${noteRow.number}:I${noteRow.number}`)

    const bodyRow = ws.addRow([])
    bodyRow.getCell(1).value = comment.trim()
    bodyRow.getCell(1).font = { name: 'Arial', size: 10 }
    bodyRow.getCell(1).alignment = { vertical: 'top', horizontal: 'left', wrapText: true }
    ws.mergeCells(`A${bodyRow.number}:I${bodyRow.number}`)
    bodyRow.height = 48
  }

  ws.columns = [
    { width: 6 }, { width: 46 }, { width: 10 },
    { width: 12 }, { width: 32 }, { width: 12 }, { width: 32 },
    { width: 14 }, { width: 14 },
  ]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Hanh_kiem_${sanitize(sheet.userName)}_${sanitize(sheet.targetName ?? '')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}
