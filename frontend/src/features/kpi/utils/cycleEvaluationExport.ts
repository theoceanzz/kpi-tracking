import { behaviorSourceLabel } from '@/lib/performanceMatrix'
import ExcelJS from 'exceljs'
import { format, parseISO } from 'date-fns'
import type { CycleUnitEvaluation, CycleUserEvaluation, CycleEvaluationMode } from '@/types/kpi'
import { SCORING_POOL } from '@/lib/scoring'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const MODE_LABEL = perLanguage((): Record<CycleEvaluationMode, string> => ({
  QUANTITATIVE: i18n.t('kpi:cycleEvaluationExport.quantitative'),
  QUALITATIVE: i18n.t('kpi:cycleEvaluationExport.qualitative'),
  BOTH: i18n.t('kpi:cycleEvaluationExport.both'),
}))

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
  opts: { getScoreLabel: (n: number) => string },
) {
  const { getScoreLabel } = opts
  const isQual = summary.mode === 'QUALITATIVE'
  // Hai cột trục ma trận. Kỳ chạy Định lượng vẫn có trục hành vi khi tổ chức chấm hạnh
  // kiểm, nên điều kiện bám theo CÓ SỐ HAY KHÔNG — y như bảng trên màn hình, không thì
  // file xuất ra thiếu đúng hai cột mà người ta mở file để xem.
  const showDim = summary.mode !== 'QUANTITATIVE'
    || summary.members.some(m => m.behaviorScore != null || m.matrixRating != null)

  // Ở chế độ Định tính, số lưu trên pool chấm → hiện lại mức gốc 0-5.
  const side = (v: number | null): string => {
    if (v == null) return '—'
    if (!isQual) return String(v)
    return `${Math.round((v / SCORING_POOL) * 5 * 100) / 100}/5`
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(i18n.t('kpi:cycleEvaluationExport.cycleEvaluation'))

  const lastCol = showDim ? 8 : 6 // STT + Nhân viên + Đơn vị + 3 điểm (+ 2 cột trục ma trận)
  const colLetter = String.fromCharCode(64 + lastCol) // A=65

  // 1. Tiêu đề
  ws.mergeCells(`A1:${colLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = i18n.t('kpi:cycleEvaluationExport.cycleEvaluation2', { toUpperCase: (summary.cycleName || '').toUpperCase() })
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } } // Emerald-600
  ws.getRow(1).height = 26

  // 2. Thông tin tổng hợp phòng ban
  const info: [string, string][] = [
    [i18n.t('kpi:cycleEvaluationExport.department'), summary.orgUnitName || '—'],
    [i18n.t('kpi:cycleEvaluationExport.evaluationMode'), MODE_LABEL()[summary.mode]],
    [i18n.t('kpi:cycleEvaluationExport.members'), String(summary.memberCount)],
    [isQual ? i18n.t('kpi:cycleEvaluationExport.finalizedLevelDeptAverage') : i18n.t('kpi:cycleEvaluationExport.finalizedScoreDeptAverage'), side(summary.managerScore)],
    [isQual ? i18n.t('kpi:cycleEvaluationExport.selfAssessedLevelAverage') : i18n.t('kpi:cycleEvaluationExport.selfAssessmentScoreAverage'), side(summary.selfScore)],
  ]
  if (showDim) {
    info.push([i18n.t('kpi:cycleEvaluationExport.avgConductScore'), summary.behaviorScore != null ? `${summary.behaviorScore}/5` : '—'])
    info.push([i18n.t('kpi:cycleEvaluationExport.avgMatrixRating'), summary.matrixRating != null ? `${summary.matrixRating}/5` : '—'])
  }
  info.push([i18n.t('kpi:cycleEvaluationExport.status'), summary.status === 'FINALIZED' ? i18n.t('kpi:cycleEvaluationExport.finalized') : i18n.t('kpi:cycleEvaluationExport.draft')])
  if (summary.status === 'FINALIZED') {
    info.push([i18n.t('kpi:cycleEvaluationExport.finalizedBy'), summary.finalizedByName || '—'])
    info.push([i18n.t('kpi:cycleEvaluationExport.finalizedAt'), summary.finalizedAt ? format(parseISO(summary.finalizedAt), 'dd/MM/yyyy HH:mm') : '—'])
  }
  if (summary.comment) info.push([i18n.t('kpi:cycleEvaluationExport.comments'), summary.comment])
  info.push([i18n.t('kpi:cycleEvaluationExport.exportDate'), format(new Date(), 'dd/MM/yyyy HH:mm')])

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
  const headers = [i18n.t('kpi:cycleEvaluationExport.rowNo'), i18n.t('kpi:cycleEvaluationExport.employee'), i18n.t('kpi:cycleEvaluationExport.unit'),
    isQual ? i18n.t('kpi:cycleEvaluationExport.selfAssessedLevel') : i18n.t('kpi:cycleEvaluationExport.employeeSelfAssessment'),
    isQual ? i18n.t('kpi:cycleEvaluationExport.directManagerLevel') : i18n.t('kpi:cycleEvaluationExport.directManagersAssessment'),
    isQual ? i18n.t('kpi:cycleEvaluationExport.cycleFinalizedLevel') : i18n.t('kpi:cycleEvaluationExport.cycleFinalizedScore')]
  if (showDim) headers.push(i18n.t('kpi:cycleEvaluationExport.conductScore'), i18n.t('kpi:cycleEvaluationExport.rating'))

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
      // Nguồn của điểm hành vi đi kèm: đọc file mà không biết số ra từ KPI định tính hay
      // từ hạnh kiểm thì không giải thích được xếp loại cho ai.
      cells.push(m.behaviorScore != null
        ? `${m.behaviorScore}/5${behaviorSourceLabel(m)}`
        : '—')
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
  if (showDim) widths.push(18, 12)
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
  opts: { getScoreLabel: (n: number) => string },
) {
  const { getScoreLabel } = opts
  const isQual = member.mode === 'QUALITATIVE'
  // Chỉ chế độ "Cả hai" mới tách được 2 trục định lượng/định tính theo từng đợt.
  const showDim = member.mode === 'BOTH'

  const side = (v: number | null): string => {
    if (v == null) return '—'
    if (!isQual) return String(v)
    return `${Math.round((v / SCORING_POOL) * 5 * 100) / 100}/5`
  }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(i18n.t('kpi:cycleEvaluationExport.individualDetails'))

  const lastCol = showDim ? 7 : 4 // Đợt + (Định lượng, Định tính, Xếp loại) + %HT + Tự ĐG + QLTT
  const colLetter = String.fromCharCode(64 + lastCol)

  // 1. Tiêu đề
  ws.mergeCells(`A1:${colLetter}1`)
  const titleCell = ws.getCell('A1')
  titleCell.value = i18n.t('kpi:cycleEvaluationExport.cycleEvaluationDetails', { toUpperCase: (member.userName || '').toUpperCase() })
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }
  ws.getRow(1).height = 26

  // 2. Thông tin tổng hợp của cá nhân
  const info: [string, string][] = [
    [i18n.t('kpi:cycleEvaluationExport.employee'), member.userName || '—'],
    [i18n.t('kpi:cycleEvaluationExport.unit'), member.orgUnitName || summary.orgUnitName || '—'],
    [i18n.t('kpi:cycleEvaluationExport.evaluationCycles'), summary.cycleName || '—'],
    [i18n.t('kpi:cycleEvaluationExport.evaluationMode'), MODE_LABEL()[member.mode]],
    [isQual ? i18n.t('kpi:cycleEvaluationExport.selfAssessedLevel') : i18n.t('kpi:cycleEvaluationExport.employeeSelfAssessment'), side(member.selfScore)],
    [isQual ? i18n.t('kpi:cycleEvaluationExport.directManagerLevel') : i18n.t('kpi:cycleEvaluationExport.directManagersAssessment'), side(member.managerScore)],
    [
      isQual ? i18n.t('kpi:cycleEvaluationExport.cycleFinalizedLevel') : i18n.t('kpi:cycleEvaluationExport.cycleFinalizedScore'),
      member.finalScore != null && !isQual
        ? `${member.finalScore} (${getScoreLabel(member.finalScore)})${member.finalScoreOverridden ? i18n.t('kpi:cycleEvaluationExport.manuallyAdjusted') : ''}`
        : `${side(member.finalScore)}${member.finalScoreOverridden ? i18n.t('kpi:cycleEvaluationExport.manuallyAdjusted') : ''}`,
    ],
  ]
  if (member.mode !== 'QUANTITATIVE' || member.behaviorScore != null || member.matrixRating != null) {
    if (member.mode !== 'QUANTITATIVE') {
      info.push([i18n.t('kpi:cycleEvaluationExport.qualitativeLevel'), member.qualScore != null ? `${member.qualScore}/5` : '—'])
    }
    info.push([i18n.t('kpi:cycleEvaluationExport.conductScoreMatrixAxis'), member.behaviorScore != null
      ? `${member.behaviorScore}/5${behaviorSourceLabel(member)}`
      : '—'])
    info.push([i18n.t('kpi:cycleEvaluationExport.matrixRating'), member.matrixRating != null ? `${member.matrixRating}/5` : '—'])
  }
  if (member.avgCompletionPercent != null) {
    info.push([i18n.t('kpi:cycleEvaluationExport.avgQuantitativeCompletion'), `${Math.round(member.avgCompletionPercent)}%`])
  }
  info.push([i18n.t('kpi:cycleEvaluationExport.status'), member.locked ? i18n.t('kpi:cycleEvaluationExport.lockedFinalizedAt', { value: member.lockedByUnitName || '—' }) : i18n.t('kpi:cycleEvaluationExport.notLocked')])
  if (member.evaluatedByName) info.push([i18n.t('kpi:cycleEvaluationExport.cycleScorer'), member.evaluatedByName])
  if (member.evaluatedAt) info.push([i18n.t('kpi:cycleEvaluationExport.scoredAt'), format(parseISO(member.evaluatedAt), 'dd/MM/yyyy HH:mm')])
  if (member.comment) info.push([i18n.t('kpi:cycleEvaluationExport.comments'), member.comment])
  info.push([i18n.t('kpi:cycleEvaluationExport.exportDate'), format(new Date(), 'dd/MM/yyyy HH:mm')])

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
  const sectionRow = ws.addRow([i18n.t('kpi:cycleEvaluationExport.scoreDetailsForEachPeriodIn')])
  ws.mergeCells(`A${sectionRow.number}:${colLetter}${sectionRow.number}`)
  sectionRow.getCell(1).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF059669' } }

  if (!member.periodBreakdown?.length) {
    ws.addRow([i18n.t('kpi:cycleEvaluationExport.noPeriodHasBeenAssignedTo')]).getCell(1).font = { name: 'Arial', size: 10, italic: true }
  } else {
    const headers = [i18n.t('kpi:cycleEvaluationExport.aPeriod')]
    if (showDim) headers.push(i18n.t('kpi:cycleEvaluationExport.quantitative'), i18n.t('kpi:cycleEvaluationExport.qualitative'), i18n.t('kpi:cycleEvaluationExport.rating'))
    headers.push(i18n.t('kpi:cycleEvaluationExport.completion'), isQual ? i18n.t('kpi:cycleEvaluationExport.selfAssessedLevel') : i18n.t('kpi:cycleEvaluationExport.selfAssessment'), isQual ? i18n.t('kpi:cycleEvaluationExport.directManagerLevel') : i18n.t('kpi:cycleEvaluationExport.directManagerAssessment'))

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
