import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import { EmployeeKpiStats } from '@/types/stats'

export async function exportPerformanceToExcel(data: EmployeeKpiStats[], title: string = 'BÁO CÁO HIỆU SUẤT NHÂN VIÊN') {
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
  dateCell.value = `Ngày xuất báo cáo: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`
  dateCell.font = { name: 'Arial', size: 10, italic: true }
  dateCell.alignment = { horizontal: 'right' }

  worksheet.addRow([]) // Gap

  // 2. Define Columns
  const headerRow = worksheet.addRow([
    'STT',
    'Mã Nhân viên',
    'Họ và Tên',
    'Chức vụ',
    'Phòng ban',
    'KPI Giao',
    'KPI Đạt',
    'Điểm TB',
    'Xếp loại'
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
    let rank = 'Trung bình'
    let rankColor = 'FF64748B' // Slate-500

    if (avgScore >= 90) { rank = 'Xuất sắc'; rankColor = 'FF10B981'; }
    else if (avgScore >= 80) { rank = 'Tốt'; rankColor = 'FF3B82F6'; }
    else if (avgScore >= 70) { rank = 'Khá'; rankColor = 'FFF59E0B'; }
    else if (avgScore > 0) { rank = 'Trung bình'; rankColor = 'FFEF4444'; }
    else { rank = 'Chưa có'; rankColor = 'FF94A3B8'; }

    const row = worksheet.addRow([
      index + 1,
      emp.userId?.split('-')[0]?.toUpperCase() || 'N/A', // Using part of ID as code if not available
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
