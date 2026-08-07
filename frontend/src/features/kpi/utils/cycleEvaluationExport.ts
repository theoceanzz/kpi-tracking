import ExcelJS from 'exceljs'
import { format, parseISO } from 'date-fns'
import type { CycleUnitEvaluation, CycleUserEvaluation, CycleEvaluationMode } from '@/types/kpi'

const MODE_LABEL: Record<CycleEvaluationMode, string> = {
  QUANTITATIVE: 'Định lượng',
  QUALITATIVE: 'Định tính',
  BOTH: 'Cả hai',
}

const sanitize = (s: string) => (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_').slice(0, 60)

/** Tải workbook về máy dưới tên file cho trước. */
async function download(wb: ExcelJS.Workbook, fileName: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  window.URL.revokeObjectURL(url)
}

/**
 * Xuất bản đánh giá kỳ của MỘT phòng ban ra Excel (theo đơn vị + kỳ đang chọn).
 * Ở chế độ Định tính, điểm hiển thị dạng mức 0-5 (giống trên màn hình).
 */
export async function exportCycleEvaluationToExcel(
  summary: CycleUnitEvaluation,
  opts: { maxScore: number; getScoreLabel: (n: number) => string },
) {
  const { maxScore, getScoreLabel } = opts
  const isQual = summary.mode === 'QUALITATIVE'
  const showDim = summary.mode !== 'QUANTITATIVE' // có cột định tính + xếp loại

  // Ở chế độ Định tính, số lưu trên thang điểm → hiện lại mức gốc 0-5.
  const side = (v: number | null): string => {
    if (v == null) return '—'
    if (!isQual) return String(v)
    return `${Math.round((v / maxScore) * 5 * 100) / 100}/5`
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Đánh giá kỳ')

  const lastCol = showDim ? 6 : 4 // STT + Nhân viên + Đơn vị + 3 điểm (+ 2 cột định tính)
  const colLetter = String.fromCharCode(64 + lastCol) // A=65

  // 1. Tiêu đề
  ws.mergeCells(`A1:${colLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = `ĐÁNH GIÁ KỲ — ${(summary.cycleName || '').toUpperCase()}`
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } } // Emerald-600
  ws.getRow(1).height = 26

  // 2. Thông tin tổng hợp phòng ban
  const info: [string, string][] = [
    ['Phòng ban', summary.orgUnitName || '—'],
    ['Chế độ đánh giá', MODE_LABEL[summary.mode]],
    ['Số thành viên', String(summary.memberCount)],
    [isQual ? 'Mức chốt (TB phòng)' : 'Điểm chốt (TB phòng)', side(summary.managerScore)],
    [isQual ? 'Mức tự đánh giá (TB)' : 'Điểm tự đánh giá (TB)', side(summary.selfScore)],
  ]
  if (showDim) {
    info.push(['TB định tính', summary.qualScore != null ? `${summary.qualScore}/5` : '—'])
    info.push(['TB xếp loại ma trận', summary.matrixRating != null ? `${summary.matrixRating}/5` : '—'])
  }
  info.push(['Trạng thái', summary.status === 'FINALIZED' ? 'Đã chốt' : 'Bản nháp'])
  if (summary.status === 'FINALIZED') {
    info.push(['Người chốt', summary.finalizedByName || '—'])
    info.push(['Thời điểm chốt', summary.finalizedAt ? format(parseISO(summary.finalizedAt), 'dd/MM/yyyy HH:mm') : '—'])
  }
  if (summary.comment) info.push(['Nhận xét', summary.comment])
  info.push(['Ngày xuất', format(new Date(), 'dd/MM/yyyy HH:mm')])

  info.forEach(([label, value]) => {
    const row = ws.addRow([label])
    row.getCell(1).value = label
    row.getCell(3).value = value
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } }
    row.getCell(3).font = { name: 'Arial', size: 10 }
    // Nhãn trải A:B (đủ rộng), giá trị trải C..cột cuối.
    ws.mergeCells(`A${row.number}:B${row.number}`)
    ws.mergeCells(`C${row.number}:${colLetter}${row.number}`)
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  })

  ws.addRow([])

  // 3. Bảng thành viên
  const headers = ['STT', 'Nhân viên', 'Đơn vị',
    isQual ? 'Mức tự đánh giá' : 'Nhân viên tự đánh giá',
    isQual ? 'Mức QLTT' : 'Cán bộ QLTT đánh giá',
    isQual ? 'Mức chốt kỳ' : 'Điểm chốt kỳ']
  if (showDim) headers.push('Định tính', 'Xếp loại')

  const headerRow = ws.addRow(headers)
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
  })

  summary.members.forEach((m, i) => {
    const cells: (string | number)[] = [
      i + 1,
      m.userName,
      m.orgUnitName || '—',
      side(m.selfScore),
      side(m.managerScore),
      side(m.finalScore),
    ]
    if (showDim) {
      cells.push(m.qualScore != null ? `${m.qualScore}/5` : '—')
      cells.push(m.matrixRating != null ? `${m.matrixRating}/5` : '—')
    }
    const row = ws.addRow(cells)
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: colNum === 2 || colNum === 3 ? 'left' : 'center' }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })
    // Cột điểm chốt (6) tô đậm + nhãn xếp loại khi ở thang điểm.
    const finalCell = row.getCell(6)
    finalCell.font = { name: 'Arial', size: 10, bold: true }
    if (!isQual && m.finalScore != null) {
      finalCell.value = `${m.finalScore} (${getScoreLabel(m.finalScore)})`
    }
  })

  // 4. Độ rộng cột
  const widths = [6, 26, 20, 20, 20, 22]
  if (showDim) widths.push(12, 12)
  ws.columns = widths.map((w) => ({ width: w }))

  // 5. Tải file
  await download(wb, `Danh_gia_ky_${sanitize(summary.orgUnitName || '')}_${sanitize(summary.cycleName || '')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
}

/**
 * Xuất chi tiết đánh giá kỳ của MỘT nhân viên: tổng hợp + điểm từng đợt trong kỳ.
 * Khác bản xuất phòng ban ở chỗ đi sâu vào `periodBreakdown` — cho thấy điểm kỳ
 * được lấy trung bình từ những đợt nào.
 */
export async function exportCycleMemberDetailToExcel(
  member: CycleUserEvaluation,
  summary: Pick<CycleUnitEvaluation, 'cycleName' | 'orgUnitName'>,
  opts: { maxScore: number; getScoreLabel: (n: number) => string },
) {
  const { maxScore, getScoreLabel } = opts
  const isQual = member.mode === 'QUALITATIVE'
  // Chỉ chế độ "Cả hai" mới tách được 2 trục định lượng/định tính theo từng đợt.
  const showDim = member.mode === 'BOTH'

  const side = (v: number | null): string => {
    if (v == null) return '—'
    if (!isQual) return String(v)
    return `${Math.round((v / maxScore) * 5 * 100) / 100}/5`
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Chi tiết cá nhân')

  const lastCol = showDim ? 7 : 4 // Đợt + (Định lượng, Định tính, Xếp loại) + %HT + Tự ĐG + QLTT
  const colLetter = String.fromCharCode(64 + lastCol)

  // 1. Tiêu đề
  ws.mergeCells(`A1:${colLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = `CHI TIẾT ĐÁNH GIÁ KỲ — ${(member.userName || '').toUpperCase()}`
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
  ws.getRow(1).height = 26

  // 2. Thông tin tổng hợp của cá nhân
  const info: [string, string][] = [
    ['Nhân viên', member.userName || '—'],
    ['Đơn vị', member.orgUnitName || summary.orgUnitName || '—'],
    ['Kỳ đánh giá', summary.cycleName || '—'],
    ['Chế độ đánh giá', MODE_LABEL[member.mode]],
    [isQual ? 'Mức tự đánh giá' : 'Nhân viên tự đánh giá', side(member.selfScore)],
    [isQual ? 'Mức QLTT' : 'Cán bộ QLTT đánh giá', side(member.managerScore)],
    [
      isQual ? 'Mức chốt kỳ' : 'Điểm chốt kỳ',
      member.finalScore != null && !isQual
        ? `${member.finalScore} (${getScoreLabel(member.finalScore)})${member.finalScoreOverridden ? ' — đã chỉnh tay' : ''}`
        : `${side(member.finalScore)}${member.finalScoreOverridden ? ' — đã chỉnh tay' : ''}`,
    ],
  ]
  if (member.mode !== 'QUANTITATIVE') {
    info.push(['Mức định tính', member.qualScore != null ? `${member.qualScore}/5` : '—'])
    info.push(['Xếp loại ma trận', member.matrixRating != null ? `${member.matrixRating}/5` : '—'])
  }
  if (member.avgCompletionPercent != null) {
    info.push(['TB % hoàn thành định lượng', `${Math.round(member.avgCompletionPercent)}%`])
  }
  info.push(['Trạng thái', member.locked ? `Đã khoá (chốt ở "${member.lockedByUnitName || '—'}")` : 'Chưa khoá'])
  if (member.evaluatedByName) info.push(['Người chấm điểm kỳ', member.evaluatedByName])
  if (member.evaluatedAt) info.push(['Thời điểm chấm', format(parseISO(member.evaluatedAt), 'dd/MM/yyyy HH:mm')])
  if (member.comment) info.push(['Nhận xét', member.comment])
  info.push(['Ngày xuất', format(new Date(), 'dd/MM/yyyy HH:mm')])

  info.forEach(([label, value]) => {
    const row = ws.addRow([label])
    row.getCell(1).value = label
    row.getCell(3).value = value
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF475569' } }
    row.getCell(3).font = { name: 'Arial', size: 10 }
    ws.mergeCells(`A${row.number}:B${row.number}`)
    ws.mergeCells(`C${row.number}:${colLetter}${row.number}`)
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
  })

  ws.addRow([])

  // 3. Bảng điểm từng đợt trong kỳ
  const sectionRow = ws.addRow(['CHI TIẾT ĐIỂM TỪNG ĐỢT TRONG KỲ'])
  ws.mergeCells(`A${sectionRow.number}:${colLetter}${sectionRow.number}`)
  sectionRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF059669' } }

  if (!member.periodBreakdown?.length) {
    ws.addRow(['Kỳ này chưa có đợt nào được gán.']).getCell(1).font = { name: 'Arial', size: 10, italic: true }
  } else {
    const headers = ['Đợt']
    if (showDim) headers.push('Định lượng', 'Định tính', 'Xếp loại')
    headers.push('% hoàn thành', isQual ? 'Mức tự đánh giá' : 'Tự đánh giá', isQual ? 'Mức QLTT' : 'QLTT đánh giá')

    const headerRow = ws.addRow(headers)
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })

    member.periodBreakdown.forEach((p) => {
      const cells: (string | number)[] = [p.periodName]
      if (showDim) {
        cells.push(p.quantScore ?? '—')
        cells.push(p.qualScore != null ? `${p.qualScore}/5` : '—')
        cells.push(p.matrixRating != null ? `${p.matrixRating}/5` : '—')
      }
      cells.push(p.completionPercent != null ? `${Math.round(p.completionPercent)}%` : '—')
      cells.push(side(p.selfScore))
      cells.push(side(p.managerScore))

      const row = ws.addRow(cells)
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'left' : 'center' }
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
      })
    })
  }

  // 4. Độ rộng cột
  const widths = showDim ? [30, 14, 14, 12, 14, 18, 18] : [30, 14, 18, 18]
  ws.columns = widths.map((w) => ({ width: w }))

  // 5. Tải file
  await download(wb, `Chi_tiet_danh_gia_ky_${sanitize(member.userName || '')}_${sanitize(summary.cycleName || '')}_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`)
}
