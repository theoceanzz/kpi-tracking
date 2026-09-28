import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { EmployeeKpiStats } from '@/types/stats'

export async function exportPerformanceToExcel(data: EmployeeKpiStats[], title: string = i18n.t('common:performanceExport.employeePerformanceReport')) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Performance')

  // 1. Title & Header Info
  worksheet.mergeCells('A1', 'I1')
  const titleCell = worksheet.getCell('A1')
  titleCell.value = title.toUpperCase()
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } } // Indigo-600

  worksheet.mergeCells('A2', 'I2')
  const dateCell = worksheet.getCell('A2')
  dateCell.value = i18n.t('common:performanceExport.reportExportedOn', { value: format(new Date(), 'dd/MM/yyyy HH:mm') })
  dateCell.font = { name: 'Arial', size: 10, italic: true }
  dateCell.alignment = { horizontal: 'right' }

  worksheet.addRow([]) // Gap

  // 2. Define Columns
  const headerRow = worksheet.addRow([
    'STT',
    i18n.t('common:performanceExport.employeeCode'),
    i18n.t('common:performanceExport.fullName'),
    i18n.t('common:performanceExport.position'),
    i18n.t('common:performanceExport.department'),
    i18n.t('common:performanceExport.kpisAssigned'),
    i18n.t('common:performanceExport.kpisMet'),
    i18n.t('common:performanceExport.avgScore'),
    i18n.t('common:performanceExport.rating')
  ])

  // Style Header Row
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate-800
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })

  // 3. Add Data Rows
  data.forEach((emp, index) => {
    const avgScore = emp.averageScore ?? 0
    let rank = i18n.t('common:performanceExport.medium')
    let rankColor = 'FF64748B' // Slate-500

    if (avgScore >= 90) { rank = i18n.t('common:performanceExport.excellent'); rankColor = 'FF10B981'; }
    else if (avgScore >= 80) { rank = i18n.t('common:performanceExport.good'); rankColor = 'FF3B82F6'; }
    else if (avgScore >= 70) { rank = i18n.t('common:performanceExport.fair'); rankColor = 'FFF59E0B'; }
    else if (avgScore > 0) { rank = i18n.t('common:performanceExport.medium'); rankColor = 'FFEF4444'; }
    else { rank = i18n.t('common:performanceExport.no'); rankColor = 'FF94A3B8'; }

    const row = worksheet.addRow([
      index + 1,
      emp.employeeCode || 'N/A',
      emp.fullName,
      emp.role,
      emp.orgUnitName || '---',
      emp.assignedKpi,
      emp.approvedSubmissions,
      avgScore.toFixed(2),
      rank
    ])

    // Style Data Row
    row.eachCell((cell, colNum) => {
      cell.font = { name: 'Arial', size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: colNum === 3 || colNum === 5 ? 'left' : 'center' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      }
      
      // Color coding for rank
      if (colNum === 9) {
        cell.font = { bold: true, color: { argb: rankColor } }
      }
    })
  })

  // 4. Adjust Column Widths
  worksheet.columns = [
    { width: 6 },  // STT
    { width: 15 }, // Mã NV
    { width: 25 }, // Họ Tên
    { width: 15 }, // Chức vụ
    { width: 20 }, // Phòng ban
    { width: 10 }, // KPI Giao
    { width: 10 }, // KPI Đạt
    { width: 10 }, // Điểm TB
    { width: 15 }  // Xếp loại
  ]

  // 5. Generate Buffer & Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Bao_cao_hieu_suat_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}

import { ExportDetailedPerformanceResponse } from '@/types/stats'
import i18n from 'i18next'

export async function exportDetailedPerformanceToExcel(
  data: ExportDetailedPerformanceResponse[], 
  userRoleLevel: number,
  title: string = i18n.t('common:performanceExport.detailedKpiPerformanceReport'),
  enableOkr: boolean = false
) {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Detailed Performance')

  // 1. Title & Header Info
  // We'll calculate columns later, but let's assume a width for now
  const totalCols = 12 + (enableOkr ? 2 : 0) + (userRoleLevel >= 4 || userRoleLevel <= 2 ? 1 : 0) + (userRoleLevel <= 3 ? 1 : 0) + (userRoleLevel <= 2 ? 1 : 0)
  const lastColLetter = String.fromCharCode(64 + totalCols) // A simplistic way to merge cells, might not work well beyond Z

  worksheet.mergeCells('A1', `${lastColLetter}1`)
  const titleCell = worksheet.getCell('A1')
  titleCell.value = title.toUpperCase()
  titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }

  worksheet.mergeCells('A2', `${lastColLetter}2`)
  const dateCell = worksheet.getCell('A2')
  dateCell.value = i18n.t('common:performanceExport.exportedOn', { value: format(new Date(), 'dd/MM/yyyy HH:mm') })
  dateCell.font = { name: 'Arial', size: 10, italic: true }
  dateCell.alignment = { horizontal: 'right' }

  worksheet.addRow([])

  // 2. Define Headers
  const baseHeaders = [
    'STT',
    i18n.t('common:performanceExport.empCode'),
    i18n.t('common:performanceExport.fullName'),
    i18n.t('common:performanceExport.position'),
    i18n.t('common:performanceExport.department')
  ]

  if (enableOkr) {
    baseHeaders.push(i18n.t('common:performanceExport.objective'), i18n.t('common:performanceExport.keyResult'))
  }

  baseHeaders.push(
    i18n.t('common:performanceExport.kpiName'),
    i18n.t('common:performanceExport.weight'),
    i18n.t('common:performanceExport.uom'),
    i18n.t('common:performanceExport.kpis'),
    i18n.t('common:performanceExport.execute'),
    i18n.t('common:performanceExport.completion'),
    i18n.t('common:performanceExport.managerScore')
  )

  // Add hierarchical evaluation columns
  const evalHeaders: string[] = []
  if (userRoleLevel >= 4 || userRoleLevel <= 2) evalHeaders.push(i18n.t('common:performanceExport.teamLeadScore'))
  if (userRoleLevel <= 3) evalHeaders.push(i18n.t('common:performanceExport.departmentHeadScore'))
  if (userRoleLevel <= 2) evalHeaders.push(i18n.t('common:performanceExport.directorScore'))

  const headerRow = worksheet.addRow([...baseHeaders, ...evalHeaders])

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    }
  })

  // 3. Data Rows
  let stt = 1
  data.forEach((emp) => {
    // If user has no KPIs, still show them with empty KPI rows or just summary?
    // User wants "chi tiết từng KPI"
    if (!emp.kpis || emp.kpis.length === 0) {
      const rowValues: any[] = [
        stt++,
        emp.employeeCode || 'N/A',
        emp.fullName,
        emp.role,
        emp.orgUnitName
      ]

      if (enableOkr) {
        rowValues.push('---', '---')
      }

      rowValues.push(
        i18n.t('common:performanceExport.noKpis'),
        0, '-', 0, 0, 0, 0,
        ...(evalHeaders.map(() => '---'))
      )

      worksheet.addRow(rowValues)
      return
    }

    emp.kpis.forEach((kpi, kIdx) => {
      const rowValues: any[] = [
        kIdx === 0 ? stt++ : '', // Only show STT for first KPI row of each employee
        kIdx === 0 ? (emp.employeeCode || 'N/A') : '',
        kIdx === 0 ? emp.fullName : '',
        kIdx === 0 ? emp.role : '',
        kIdx === 0 ? emp.orgUnitName : ''
      ]

      if (enableOkr) {
        rowValues.push(kpi.objectiveName || '---', kpi.keyResultName || '---')
      }

      rowValues.push(
        kpi.kpiName,
        kpi.weight,
        kpi.unit || '-',
        kpi.targetValue,
        kpi.actualValue,
        kpi.completionRate.toFixed(1),
        kpi.managerScore || 0
      )

      // Add evaluation scores (usually repeated for every KPI row of the user since evaluation is per period)
      if (userRoleLevel >= 4 || userRoleLevel <= 2) rowValues.push(emp.teamLeaderScore || 0)
      if (userRoleLevel <= 3) rowValues.push(emp.deptHeadScore || 0)
      if (userRoleLevel <= 2) rowValues.push(emp.directorScore || 0)

      const row = worksheet.addRow(rowValues)

      // Styling
      row.eachCell((cell, colNum) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { 
          vertical: 'middle', 
          horizontal: colNum === 3 || colNum === 5 || colNum === 6 ? 'left' : 'center' 
        }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      })
    })

    // Add a separator line after each employee
    const lastRow = worksheet.lastRow
    if (lastRow) {
      lastRow.border = {
        ...lastRow.border,
        bottom: { style: 'medium' }
      }
    }
  })

  // 4. Adjust Column Widths
  const columns: Partial<ExcelJS.Column>[] = [
    { width: 6 },  // STT
    { width: 12 }, // Mã NV
    { width: 22 }, // Họ Tên
    { width: 15 }, // Chức vụ
    { width: 18 }  // Phòng ban
  ]

  if (enableOkr) {
    columns.push({ width: 30 }, { width: 30 }) // Objective, Key Result
  }

  columns.push(
    { width: 30 }, // Tên KPI
    { width: 10 }, // Trọng số
    { width: 8 },  // ĐVT
    { width: 10 }, // Chỉ tiêu
    { width: 10 }, // Thực hiện
    { width: 10 }, // Hoàn thành
    { width: 12 }  // Quản lý chấm
  )

  if (userRoleLevel >= 4 || userRoleLevel <= 2) columns.push({ width: 15 })
  if (userRoleLevel <= 3) columns.push({ width: 15 })
  if (userRoleLevel <= 2) columns.push({ width: 15 })

  worksheet.columns = columns

  // 5. Generate Buffer & Download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `Bao_cao_chi_tiet_KPI_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
  anchor.click()
  window.URL.revokeObjectURL(url)
}
