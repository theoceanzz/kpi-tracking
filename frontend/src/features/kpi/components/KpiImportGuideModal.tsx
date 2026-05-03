import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBox } from 'lucide-react'
import ExcelJS from 'exceljs'

interface KpiImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_DATA = [
  {
    Name: 'Doanh số bán hàng',
    Description: 'Tổng doanh số trong tháng',
    Weight: 40,
    TargetValue: 100000000,
    MinimumValue: 80000000,
    Unit: 'VND',
    EmployeeCode: 'NV001',
    OrgUnitCode: 'MKT001',
  },
  {
    Name: 'Số cuộc gọi tư vấn',
    Description: 'Số cuộc gọi tối thiểu mỗi ngày',
    Weight: 30,
    TargetValue: 20,
    MinimumValue: 15,
    Unit: 'Cuộc',
    EmployeeCode: 'NV002, NV003',
    OrgUnitCode: 'KD002',
  }
]

function downloadCsvTemplate() {
  const headers = 'Name,Description,Weight,TargetValue,MinimumValue,Unit,EmployeeCode,OrgUnitCode'
  const rows = SAMPLE_DATA.map(row => 
    Object.values(row).map(val => `"${val}"`).join(',')
  ).join('\n')
  const content = headers + '\n' + rows
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_chi_tieu_kpi.csv'
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadXlsxTemplate() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('KPI Template')

  worksheet.columns = [
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'Description', key: 'Description', width: 40 },
    { header: 'Weight', key: 'Weight', width: 12 },
    { header: 'TargetValue', key: 'TargetValue', width: 18 },
    { header: 'MinimumValue', key: 'MinimumValue', width: 18 },
    { header: 'Unit', key: 'Unit', width: 12 },
    { header: 'EmployeeCode', key: 'EmployeeCode', width: 25 },
    { header: 'OrgUnitCode', key: 'OrgUnitCode', width: 15 },
  ]

  // Add data
  worksheet.addRows(SAMPLE_DATA)

  // Style the header
  const headerRow = worksheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // Indigo-600
    }
    cell.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    }
  })
  headerRow.height = 25

  // Style data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1) {
      row.eachCell((cell) => {
        cell.font = { name: 'Arial', size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'left' }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
      })
    }
  })


  // Generate buffer and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_chi_tieu_kpi.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Nhấn nút bên dưới để tải về file CSV mẫu có sẵn header chuẩn cho KPI.' },
  { num: '02', title: 'Điền thông tin', desc: 'Mở file bằng Excel, điền thông tin chỉ tiêu và Mã nhân viên (Employee Code) được giao.' },
  { num: '03', title: 'Lưu & Upload', desc: 'Lưu file ở định dạng .csv hoặc .xlsx, sau đó nhấn "Chọn file & Import" bên dưới.' },
]

const COLUMNS = [
  { name: 'Name', required: true, desc: 'Tên chỉ tiêu KPI', example: 'Doanh số tháng 10' },
  { name: 'Description', required: false, desc: 'Mô tả chi tiết', example: 'Tính trên giá trị hợp đồng' },
  { name: 'Weight', required: true, desc: 'Trọng số (Ví dụ: 30 cho 30%)', example: '30' },
  { name: 'TargetValue', required: true, desc: 'Giá trị mục tiêu cần đạt', example: '500000000' },
  { name: 'MinimumValue', required: false, desc: 'Giá trị tối thiểu', example: '400000000' },
  { name: 'Unit', required: true, desc: 'Đơn vị tính', example: 'VND' },
  { name: 'Frequency', required: false, desc: 'Tần suất (Chọn nhanh trong giao diện Xem trước)', example: 'MONTHLY' },
  { name: 'EmployeeCode', required: false, desc: 'Mã nhân viên (Chọn/Nhập trong giao diện Xem trước)', example: 'NV001' },
  { name: 'Period', required: false, desc: 'Đợt KPI (Chọn nhanh trong giao diện Xem trước)', example: 'Tháng 10/2026' },
  { name: 'OrgUnitCode', required: false, desc: 'Mã đơn vị (Hệ thống sẽ tự động tìm tên phòng ban tương ứng)', example: 'MKT01' },
]

export default function KpiImportGuideModal({ open, onClose, onSelectFile }: KpiImportGuideModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Import Chỉ tiêu Hàng loạt</h2>
              <p className="text-sm font-medium text-slate-500">Giao chỉ tiêu cho nhân sự qua Excel/CSV</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">

          {/* Steps */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Quy trình thực hiện</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <div key={step.num} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">
                    {step.num}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Download Template */}
          <div className="p-6 rounded-[24px] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-indigo-600 shrink-0" />
              <div>
                <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">Tải file mẫu nhập liệu</p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Chọn định dạng phù hợp với công cụ của bạn</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    onClick={downloadXlsxTemplate}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white font-black text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 group"
                >
                    <FileBox size={18} className="group-hover:rotate-12 transition-transform" /> Tải mẫu .XLSX (Excel)
                </button>
                <button
                    onClick={downloadCsvTemplate}
                    className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 group"
                >
                    <FileText size={18} className="group-hover:rotate-12 transition-transform" /> Tải mẫu .CSV (Text)
                </button>
            </div>
          </div>

          {/* Column Specification */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Danh sách các cột</h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Tên cột</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Bắt buộc</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 min-w-[200px]">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {COLUMNS.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3">
                          <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400">{col.name}</code>
                        </td>
                        <td className="px-4 py-3">
                          {col.required ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                              <AlertTriangle size={12} /> Có
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-slate-400 font-bold">Không</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{col.desc}</p>
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Ví dụ: {col.example}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="space-y-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Lưu ý khi nhập liệu</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30">
                <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                  <strong>EmployeeCode</strong> phải chính xác và nhân viên đó phải thuộc đơn vị bạn quản lý.
                </p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
                <CheckCircle2 size={18} className="text-blue-600 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                  Trọng số (Weight) là số nguyên 1-100. Đảm bảo tổng trọng số của nhân viên trong kỳ đạt 100%.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-5 flex items-center justify-end gap-3 rounded-b-[28px]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => { onSelectFile(); onClose() }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <FileSpreadsheet size={16} /> Chọn file & Import
          </button>
        </div>
      </div>
    </div>
  )
}
