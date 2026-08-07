import { useState } from 'react'
import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBox, BarChart3, SlidersHorizontal } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { cn } from '@/lib/utils'
import type { KpiType } from '@/types/kpi'

// Columns that only apply to quantitative KPIs (dropped for qualitative import).
const QUANTITATIVE_ONLY_COLUMNS = ['TargetValue', 'MinimumValue', 'IsReverseKpi', 'Unit']

interface KpiImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: (kpiType: KpiType) => void
}

const SAMPLE_DATA = [
  {
    Name: 'Doanh số bán hàng',
    Description: 'Tổng doanh số trong tháng',
    Weight: 40,
    TargetValue: 100000000,
    MinimumValue: 80000000,
    IsReverseKpi: false,
    IsBonusKpi: false,
    Deadline: '',
    Unit: 'VND',
    EmployeeCode: 'NV001',
    OrgUnitCode: 'MKT001',
    ObjectiveCode: 'OBJ001',
    KeyResultCode: 'KR001',
    Perspective: 'DOANH_THU',
  },
  {
    Name: 'Tỉ lệ lỗi sản phẩm',
    Description: 'Tỉ lệ lỗi càng thấp càng tốt',
    Weight: 30,
    TargetValue: 2,
    MinimumValue: 5,
    IsReverseKpi: true,
    IsBonusKpi: false,
    Deadline: '25/10/2026 17:00',
    Unit: '%',
    EmployeeCode: 'NV002, NV003',
    OrgUnitCode: 'KD002',
    ObjectiveCode: '',
    KeyResultCode: '',
    Perspective: 'INTERNAL_PROCESS',
  },
  {
    Name: 'Sáng kiến cải tiến quy trình',
    Description: 'KPI tùy chọn, không tính vào 100% trọng số',
    Weight: 10,
    TargetValue: 1,
    MinimumValue: 1,
    IsReverseKpi: false,
    IsBonusKpi: true,
    Deadline: '',
    Unit: 'sáng kiến',
    EmployeeCode: 'NV001',
    OrgUnitCode: 'MKT001',
    ObjectiveCode: '',
    KeyResultCode: '',
    Perspective: 'LEARNING_GROWTH',
  }
]

const BASE_COLUMNS = [
  { name: 'Name', required: true, desc: 'Tên chỉ tiêu KPI', example: 'Doanh số tháng 10' },
  { name: 'Description', required: false, desc: 'Mô tả chi tiết', example: 'Tính trên giá trị hợp đồng' },
  { name: 'Weight', required: true, desc: 'Trọng số (Ví dụ: 30 cho 30%)', example: '30' },
  { name: 'TargetValue', required: true, desc: 'Giá trị mục tiêu cần đạt', example: '500000000' },
  { name: 'MinimumValue', required: false, desc: 'Giá trị tối thiểu', example: '400000000' },
  { name: 'IsReverseKpi', required: false, desc: 'KPI Ngược — giá trị càng thấp càng tốt (true/false)', example: 'true' },
  { name: 'IsBonusKpi', required: false, desc: 'KPI Thưởng — tùy chọn, không tính vào 100% trọng số, hoàn thành thì cộng thêm điểm (true/false)', example: 'true' },
  { name: 'Deadline', required: false, desc: 'Hạn chót riêng cho KPI này, sớm hơn ngày kết thúc đợt. Định dạng dd/MM/yyyy hoặc dd/MM/yyyy HH:mm. Để trống = mặc định theo ngày kết thúc đợt', example: '25/10/2026 17:00' },
  { name: 'Unit', required: true, desc: 'Đơn vị tính', example: 'VND' },
  { name: 'Frequency', required: false, desc: 'Tần suất (Chọn nhanh trong giao diện Xem trước)', example: 'MONTHLY' },
  { name: 'EmployeeCode', required: false, desc: 'Mã nhân viên (Chọn/Nhập trong giao diện Xem trước)', example: 'NV001' },
  { name: 'Period', required: false, desc: 'Đợt KPI (Chọn nhanh trong giao diện Xem trước)', example: 'Tháng 10/2026' },
  { name: 'OrgUnitCode', required: false, desc: 'Mã đơn vị (Hệ thống sẽ tự động tìm tên phòng ban tương ứng)', example: 'MKT01' },
]

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Nhấn nút bên dưới để tải về file CSV mẫu có sẵn header chuẩn cho KPI.' },
  { num: '02', title: 'Điền thông tin', desc: 'Mở file bằng Excel, điền thông tin chỉ tiêu và Mã nhân viên (Employee Code) được giao.' },
  { num: '03', title: 'Lưu & Upload', desc: 'Lưu file ở định dạng .csv hoặc .xlsx, sau đó nhấn "Chọn file & Import" bên dưới.' },
]



export default function KpiImportGuideModal({ open, onClose, onSelectFile }: KpiImportGuideModalProps) {
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const enableOkr = org?.enableOkr || false
  const enableQualitative = org?.enableQualitative || false
  const enableBsc = org?.enableBsc || false

  const [importType, setImportType] = useState<KpiType>('QUANTITATIVE')
  const isQualitative = enableQualitative && importType === 'QUALITATIVE'

  const COLUMNS = [
    ...BASE_COLUMNS.filter(c => !isQualitative || !QUANTITATIVE_ONLY_COLUMNS.includes(c.name)),
    ...(enableOkr ? [
      { name: 'ObjectiveCode', required: false, desc: 'Mã Mục tiêu (OKR)', example: 'OBJ001' },
      { name: 'KeyResultCode', required: false, desc: 'Mã KR (OKR)', example: 'KR001' },
    ] : []),
    ...(enableBsc ? [
      { name: 'Perspective', required: false, desc: 'Hạng mục BSC — nhập mã hoặc tên hạng mục (VD: DOANH_THU). Hạng mục PHẢI có trong thẻ điểm của đơn vị + đợt của dòng đó.', example: 'DOANH_THU' },
    ] : [])
  ]

  const getSampleData = () => {
    return SAMPLE_DATA.map(row => {
      const newRow: Record<string, any> = { ...row }
      if (!enableOkr) {
        delete newRow.ObjectiveCode
        delete newRow.KeyResultCode
      }
      if (!enableBsc) {
        delete newRow.Perspective
      }
      if (isQualitative) {
        QUANTITATIVE_ONLY_COLUMNS.forEach(k => delete newRow[k])
      }
      return newRow
    })
  }

  function downloadCsvTemplate() {
    const data = getSampleData()
    if (data.length === 0) return
    const headers = Object.keys(data[0] || {}).join(',')
    const rows = data.map(row => 
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

    const baseColumns = [
      { header: 'Name', key: 'Name', width: 30 },
      { header: 'Description', key: 'Description', width: 40 },
      { header: 'Weight', key: 'Weight', width: 12 },
      { header: 'TargetValue', key: 'TargetValue', width: 18 },
      { header: 'MinimumValue', key: 'MinimumValue', width: 18 },
      { header: 'IsReverseKpi', key: 'IsReverseKpi', width: 15 },
      { header: 'IsBonusKpi', key: 'IsBonusKpi', width: 15 },
      { header: 'Deadline', key: 'Deadline', width: 18 },
      { header: 'Unit', key: 'Unit', width: 12 },
      { header: 'EmployeeCode', key: 'EmployeeCode', width: 25 },
      { header: 'OrgUnitCode', key: 'OrgUnitCode', width: 15 },
    ].filter(c => !isQualitative || !QUANTITATIVE_ONLY_COLUMNS.includes(c.key))

    worksheet.columns = [
      ...baseColumns,
      ...(enableOkr ? [
        { header: 'ObjectiveCode', key: 'ObjectiveCode', width: 20 },
        { header: 'KeyResultCode', key: 'KeyResultCode', width: 20 },
      ] : []),
      ...(enableBsc ? [
        { header: 'Perspective', key: 'Perspective', width: 20 },
      ] : []),
    ]

    worksheet.addRows(getSampleData())

    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })
    headerRow.height = 25

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10 }
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          }
        })
      }
    })

    const guideSheet = workbook.addWorksheet('Hướng dẫn chi tiết')
    guideSheet.columns = [
      { header: 'Tên cột', key: 'name', width: 20 },
      { header: 'Bắt buộc', key: 'req', width: 15 },
      { header: 'Mô tả', key: 'desc', width: 50 },
      { header: 'Ví dụ', key: 'ex', width: 25 },
    ]
    const guideHeader = guideSheet.getRow(1)
    guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
    guideHeader.height = 30

    COLUMNS.forEach(c => {
      const row = guideSheet.addRow([c.name, c.required ? 'CÓ' : 'KHÔNG', c.desc, c.example])
      row.font = { size: 11 }
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
      })
    })

    guideSheet.addRow([])
    const noteTitleRow = guideSheet.addRow(['LƯU Ý CHUNG CHO IMPORT EXCEL & CSV'])
    noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    guideSheet.addRow(['1. File mẫu này hỗ trợ import cả định dạng .xlsx và .csv.'])
    guideSheet.addRow(['2. Nếu import bằng CSV, bạn vui lòng xuất dữ liệu từ tab "KPI Template" ra file .csv (UTF-8).'])
    guideSheet.addRow(['3. EmployeeCode: Mã nhân viên (tùy chọn, bạn có thể tự map trên giao diện).'])
    guideSheet.addRow(['4. Trọng số (Weight): Là số từ 1-100, tổng trọng số của một nhân sự nên là 100%.'])
    guideSheet.addRow(['5. OrgUnitCode: Mã phòng ban. Hệ thống sẽ gán KPI cho phòng ban đó.'])
    guideSheet.addRow(['6. IsReverseKpi: Đánh dấu KPI Ngược (giá trị càng thấp càng tốt). Nhập true/false hoặc 1/0 hoặc có/không. Để trống = false.'])
    guideSheet.addRow(['7. IsBonusKpi: Đánh dấu KPI Thưởng (tùy chọn, không tính vào tổng 100% trọng số, hoàn thành thì được cộng thêm điểm). Nhập true/false hoặc 1/0 hoặc có/không. Để trống = false.'])
    guideSheet.addRow(['8. Deadline: Hạn chót riêng cho KPI này (sớm hơn ngày kết thúc đợt). Định dạng dd/MM/yyyy hoặc dd/MM/yyyy HH:mm. Để trống = mặc định theo ngày kết thúc đợt.'])
    guideSheet.addRow(['9. Perspective (Hạng mục BSC): chỉ chọn được hạng mục CÓ trong thẻ điểm của (đơn vị + đợt) ở dòng đó. Nếu hạng mục chưa được thêm vào thẻ điểm của đơn vị này thì KPI sẽ không tính vào điểm BSC — hãy thêm hạng mục vào thẻ điểm trước.'])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_chi_tieu_kpi.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-x-0 top-0 h-screen z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-8 py-6 flex items-center justify-between rounded-t-[28px]">
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

        <div className="px-4 sm:px-8 py-6 space-y-8">

          {/* KPI type tabs (only when qualitative enabled) */}
          {enableQualitative && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/60">
              <button
                type="button"
                onClick={() => setImportType('QUANTITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  !isQualitative ? "bg-indigo-600 text-white shadow-md" : "text-slate-500 hover:bg-white/60 dark:hover:bg-slate-700/50"
                )}
              >
                <BarChart3 size={14} /> KPI Định lượng
              </button>
              <button
                type="button"
                onClick={() => setImportType('QUALITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
                  isQualitative ? "bg-emerald-600 text-white shadow-md" : "text-slate-500 hover:bg-white/60 dark:hover:bg-slate-700/50"
                )}
              >
                <SlidersHorizontal size={14} /> KPI Định tính
              </button>
            </div>
          )}

          {isQualitative && (
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-3">
              <Info size={18} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed font-medium">
                File mẫu định tính <strong>không có</strong> cột Mục tiêu / Tối thiểu / Đơn vị / KPI Ngược.
                KPI định tính được quản lý chấm điểm theo thang định tính khi duyệt.
              </p>
            </div>
          )}

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
                      <th className="px-3 py-3 text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Tên cột</th>
                      <th className="px-3 py-3 text-xs font-black uppercase tracking-wider text-slate-500 whitespace-nowrap">Bắt buộc</th>
                      <th className="px-3 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Mô tả</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {COLUMNS.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="px-3 py-3 align-top">
                          <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{col.name}</code>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {col.required ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500 whitespace-nowrap">
                              <AlertTriangle size={12} /> Có
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Không</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
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
              {enableBsc && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-50 dark:bg-violet-900/10 border border-violet-200/50 dark:border-violet-900/30 md:col-span-2">
                  <Info size={18} className="text-violet-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-violet-800 dark:text-violet-300 leading-relaxed font-medium">
                    <strong>Hạng mục BSC (Perspective)</strong> chỉ chọn được hạng mục <strong>có trong thẻ điểm của đơn vị + đợt</strong> ở dòng đó. Nếu hạng mục chưa có trong thẻ điểm của đơn vị, hãy thêm vào thẻ điểm trước — nếu không KPI sẽ không tính vào điểm BSC.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-4 sm:px-8 py-5 flex items-center justify-end gap-3 rounded-b-[28px]">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Hủy bỏ
          </button>
          <button
            onClick={() => { onSelectFile(isQualitative ? 'QUALITATIVE' : 'QUANTITATIVE'); onClose() }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
          >
            <FileSpreadsheet size={16} /> Chọn file & Import
          </button>
        </div>
      </div>
    </div>
  )
}
