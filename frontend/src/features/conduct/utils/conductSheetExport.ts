import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { ConductSheet, ConductStatus } from '../api/conductApi'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
  /** % trên tổng. */
  weight: number
  /** Phiếu chia nhóm (null = không nhóm): tên, % nhóm, thứ tự nhóm và % trong nhóm. */
  groupName?: string | null
  groupWeight?: number | null
  groupPosition?: number | null
  weightInGroup?: number | null
  selfScore: number | null
  selfEvidence: string
  managerScore: number | null
  managerComment: string
  selfWeighted: number | null
  managerWeighted: number | null
}

const STATUS_LABEL = perLanguage((): Record<ConductStatus, string> => ({
  DRAFT: i18n.t('conduct:conductSheetExport.notScored'),
  SELF_SUBMITTED: i18n.t('conduct:conductSheetExport.selfAssessed'),
  REVIEWED: i18n.t('conduct:conductSheetExport.managerScored'),
}))

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
  const ws = wb.addWorksheet(i18n.t('conduct:conductSheetExport.conduct'))

  // 1. Tiêu đề
  ws.mergeCells('A1:I1')
  const title = ws.getCell('A1')
  title.value = i18n.t('conduct:conductSheetExport.conductRatingEvaluationByEducationalPhilosophy')
  title.font = { name: 'Arial', size: 15, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle', horizontal: 'center' }
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
  ws.getRow(1).height = 26

  // 2. Thông tin phiếu
  const info: [string, string][] = [
    [i18n.t('conduct:conductSheetExport.reviewee'), sheet.userName || '—'],
    [sheet.scope === 'PERIOD' ? i18n.t('conduct:conductSheetExport.evaluationPeriods') : i18n.t('conduct:conductSheetExport.evaluationCycles'), sheet.targetName || '—'],
    [i18n.t('conduct:conductSheetExport.status'), STATUS_LABEL()[sheet.status]],
    [i18n.t('conduct:conductSheetExport.scaleForEachCriterion'), String(sheet.maxScore)],
  ]
  if (sheet.evaluatorName) info.push([i18n.t('conduct:conductSheetExport.managersScore'), sheet.evaluatorName])
  if (sheet.locked) {
    info.push([i18n.t('conduct:conductSheetExport.lock'), i18n.t('conduct:conductSheetExport.unitHasFinalizedTheCycleThe', { value: sheet.lockedByUnitName ?? '—' })])
  }
  info.push([i18n.t('conduct:conductSheetExport.exportDate'), format(new Date(), 'dd/MM/yyyy HH:mm')])

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
    i18n.t('conduct:conductSheetExport.rowNo'), i18n.t('conduct:conductSheetExport.qualitativeCriteriaAttitudeBehavior'), i18n.t('conduct:conductSheetExport.weight'),
    i18n.t('conduct:conductSheetExport.conductRatingScore'), '', i18n.t('conduct:conductSheetExport.conductRatingScore'), '',
    i18n.t('conduct:conductSheetExport.weightedRatingScore'), '',
  ])
  const h2 = ws.addRow([
    '', '', '',
    i18n.t('conduct:conductSheetExport.selfAssessedByStaffLecturer'), i18n.t('conduct:conductSheetExport.evidence'),
    i18n.t('conduct:conductSheetExport.assessedByTheDirectManager'), i18n.t('conduct:conductSheetExport.managersComments'),
    i18n.t('conduct:conductSheetExport.byTheStaffLecturersAssessmentLevel'), i18n.t('conduct:conductSheetExport.byTheDirectManagersAssessmentLevel'),
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

  // 4. Các dòng tiêu chí — phiếu chia nhóm thì thêm dòng tiêu đề nhóm và dòng "Tổng nhóm" như phiếu giấy.
  const grouped = rows.some(r => r.groupName != null)
  const groupKey = (r: ConductExportRow) => `${r.groupPosition ?? 0}:${r.groupName ?? ''}`
  const groupKeys = grouped ? [...new Set(rows.map(groupKey))] : []
  const styleRow = (row: ExcelJS.Row, fill: string) => {
    for (let c = 1; c <= 9; c++) {
      const cur = row.getCell(c)
      cur.font = { name: 'Arial', size: 10, bold: true }
      cur.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      cur.alignment = { vertical: 'middle', horizontal: c === 1 || c >= 3 ? 'center' : 'left', wrapText: true }
      cur.border = thin
    }
  }
  const groupScoreOf = (items: ConductExportRow[], side: 'self' | 'manager') => {
    let sum = 0
    let any = false
    for (const r of items) {
      const s = side === 'self' ? r.selfScore : r.managerScore
      if (s == null) continue
      any = true
      sum += (s * (r.weightInGroup ?? r.weight)) / 100
    }
    return any ? Math.round(sum * 100) / 100 : null
  }
  const sumOf = (items: ConductExportRow[], pick: (r: ConductExportRow) => number | null) => {
    const vals = items.map(pick).filter((v): v is number => v != null)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 100) / 100 : null
  }
  let lastGroup: string | null = null

  rows.forEach((r, i) => {
    if (grouped && groupKey(r) !== lastGroup) {
      lastGroup = groupKey(r)
      const head = ws.addRow([groupKeys.indexOf(lastGroup) + 1, `${r.groupName ?? ''} — ${r.groupWeight ?? 0}%`])
      ws.mergeCells(`B${head.number}:I${head.number}`)
      styleRow(head, 'FFDBEAFE')
    }
    const inGroup = grouped ? rows.filter(x => groupKey(x) === groupKey(r)) : []
    // Mô tả gộp vào ô tiêu chí, mỗi biểu hiện một dòng có gạch đầu dòng — giống trên màn hình.
    const bullets = (r.description ?? '')
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => `- ${l}`)
      .join('\n')

    const row = ws.addRow([
      grouped ? `${groupKeys.indexOf(groupKey(r)) + 1}.${inGroup.indexOf(r) + 1}` : i + 1,
      bullets ? `${r.name}\n${bullets}` : r.name,
      `${Number((grouped ? (r.weightInGroup ?? r.weight) : r.weight).toFixed(2))}%`,
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

    // Hết nhóm ⇒ dòng "Tổng nhóm": điểm nhóm trên thang ở hai cột điểm, đóng góp vào tổng ở hai cột cuối.
    const next = rows[i + 1]
    if (grouped && (!next || groupKey(next) !== groupKey(r))) {
      const gi = groupKeys.indexOf(groupKey(r))
      const sub = ws.addRow([
        i18n.t('conduct:conductSheetExport.groupTotal', { name: r.groupName ?? '', letter: String.fromCharCode(97 + gi) }), '',
        '100%', cell(groupScoreOf(inGroup, 'self')), '', cell(groupScoreOf(inGroup, 'manager')), '',
        cell(sumOf(inGroup, x => x.selfWeighted)), cell(sumOf(inGroup, x => x.managerWeighted)),
      ])
      ws.mergeCells(`A${sub.number}:B${sub.number}`)
      styleRow(sub, 'FFFCE7DB')
      sub.getCell(1).alignment = { vertical: 'middle', horizontal: 'right' }
    }
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
  totalRow.getCell(1).value = i18n.t('conduct:conductSheetExport.weightedConductScore')
  totalRow.height = 22

  // 6. Nhận xét chung
  if (comment?.trim()) {
    ws.addRow([])
    const noteRow = ws.addRow([])
    noteRow.getCell(1).value = i18n.t('conduct:conductSheetExport.managersGeneralComments')
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
