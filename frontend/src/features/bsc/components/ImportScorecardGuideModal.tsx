import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'

interface ImportScorecardGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = `Period,ScorecardName,Vision,OrgUnits,PerspectiveCode,Weight,Status,ScoringMode,EmptyPolicy
Quý 3/2026,Chiến lược Quý 3,Dẫn đầu thị phần khu vực,,DOANH_THU,40,ACTIVE,SHADOW,RENORMALIZE
Quý 3/2026,,,,HAI_LONG_KH,30,,,
Quý 3/2026,,,,VAN_HANH,20,,,
Quý 3/2026,,,,DAO_TAO,10,,,`

const COLUMNS = [
  { name: 'Period', required: true, desc: 'Tên kỳ KPI (dùng để tìm kỳ & gom nhóm thẻ điểm)', example: 'Quý 3/2026' },
  { name: 'ScorecardName', required: true, desc: 'Tên thẻ điểm (ghi ở dòng đầu của mỗi kỳ)', example: 'Chiến lược Quý 3' },
  { name: 'Vision', required: false, desc: 'Tuyên bố chiến lược', example: 'Dẫn đầu thị phần' },
  { name: 'OrgUnits', required: false, desc: 'Mã phòng ban áp dụng (nhiều mã cách nhau dấu phẩy, ghi ở dòng đầu của mỗi kỳ). Bỏ trống = toàn tổ chức. Có thể chọn ở bảng xem trước.', example: 'IT, MKT' },
  { name: 'PerspectiveCode', required: true, desc: 'Mã hạng mục (phải đã tạo trong tổ chức)', example: 'DOANH_THU' },
  { name: 'Weight', required: true, desc: 'Trọng số % của hạng mục (tổng mỗi kỳ = 100)', example: '40' },
  { name: 'Status', required: false, desc: 'DRAFT / ACTIVE / ARCHIVED (mặc định DRAFT)', example: 'ACTIVE' },
  { name: 'ScoringMode', required: false, desc: 'SHADOW / OFFICIAL (mặc định SHADOW)', example: 'SHADOW' },
  { name: 'EmptyPolicy', required: false, desc: 'RENORMALIZE / ZERO_FILL (mặc định RENORMALIZE)', example: 'RENORMALIZE' },
]

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['﻿' + SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'mau_import_the_diem_bsc.csv'; a.click()
    URL.revokeObjectURL(url)
    return
  }
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Thẻ điểm BSC')
  worksheet.columns = [
    { header: 'Period', key: 'Period', width: 18 },
    { header: 'ScorecardName', key: 'ScorecardName', width: 24 },
    { header: 'Vision', key: 'Vision', width: 30 },
    { header: 'OrgUnits', key: 'OrgUnits', width: 20 },
    { header: 'PerspectiveCode', key: 'PerspectiveCode', width: 20 },
    { header: 'Weight', key: 'Weight', width: 12 },
    { header: 'Status', key: 'Status', width: 12 },
    { header: 'ScoringMode', key: 'ScoringMode', width: 14 },
    { header: 'EmptyPolicy', key: 'EmptyPolicy', width: 16 },
  ]
  worksheet.addRows([
    ['Quý 3/2026', 'Chiến lược Quý 3', 'Dẫn đầu thị phần khu vực', '', 'DOANH_THU', 40, 'ACTIVE', 'SHADOW', 'RENORMALIZE'],
    ['Quý 3/2026', '', '', '', 'HAI_LONG_KH', 30, '', '', ''],
    ['Quý 3/2026', '', '', '', 'VAN_HANH', 20, '', '', ''],
    ['Quý 3/2026', '', '', '', 'DAO_TAO', 10, '', '', ''],
  ])
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 30
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } }
      if (rowNumber > 1) { cell.alignment = { vertical: 'middle' }; cell.font = { size: 11 } }
    })
  })
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'mau_import_the_diem_bsc_pro.xlsx'; a.click()
  URL.revokeObjectURL(url)
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Tải file mẫu có cấu trúc chuẩn.' },
  { num: '02', title: 'Điền thông tin', desc: 'Mỗi kỳ là một nhóm dòng; điền các hạng mục + trọng số (tổng 100%).' },
  { num: '03', title: 'Chọn đơn vị & Import', desc: 'Chọn file, sau đó chọn phòng ban áp dụng ở bảng xem trước (bỏ trống = toàn tổ chức) rồi Import.' },
]

export default function ImportScorecardGuideModal({ open, onClose, onSelectFile }: ImportScorecardGuideModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center"><FileSpreadsheet size={24} className="text-indigo-600" /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Import Thẻ điểm BSC</h2>
              <p className="text-sm font-medium text-slate-500">Hỗ trợ định dạng .xlsx</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"><X size={20} /></button>
        </div>

        <div className="px-8 py-6 space-y-8">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Quy trình 3 bước</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <div key={step.num} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">{step.num}</div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{step.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 border border-indigo-200/50 dark:border-indigo-900/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white"><FileBarChart size={20} /></div>
                <div><p className="font-bold text-sm text-slate-900 dark:text-indigo-100">Template XLSX Pro</p><p className="text-xs text-slate-500 dark:text-indigo-300/60">Khuyên dùng</p></div>
              </div>
              <button onClick={() => downloadTemplate('xlsx')} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"><Download size={16} /> Tải mẫu .XLSX</button>
            </div>
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4 opacity-75 grayscale">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400"><FileText size={20} /></div>
                <div><p className="font-bold text-sm text-slate-900 dark:text-white">Mẫu CSV cơ bản</p><p className="text-xs text-slate-500">Xem cấu trúc</p></div>
              </div>
              <button onClick={() => downloadTemplate('csv')} className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"><Download size={16} /> Tải mẫu .CSV</button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Cấu trúc cột dữ liệu</h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Tên cột</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Bắt buộc</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500 hidden sm:table-cell">Mô tả</th>
                      <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500">Ví dụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {COLUMNS.map((col) => (
                      <tr key={col.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="px-4 py-3"><code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">{col.name}</code></td>
                        <td className="px-4 py-3">{col.required ? <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600"><AlertTriangle size={12} /> Có</span> : <span className="text-xs font-medium text-slate-400">Không</span>}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{col.desc}</td>
                        <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">{col.example}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Lưu ý quan trọng</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30">
                <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">Các dòng cùng một <strong>Period</strong> được gom thành một thẻ điểm; <strong>tổng trọng số mỗi kỳ phải = 100%</strong>. Kỳ đã có thẻ điểm sẽ được <strong>cập nhật</strong>.</p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/30">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed"><strong>PerspectiveCode</strong> phải là mã <strong>hạng mục</strong> đã tạo. Phòng ban áp dụng được chọn ở bảng xem trước sau khi chọn file. Định dạng import: <strong>.xlsx</strong>.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-5 flex items-center justify-end gap-3 rounded-b-[28px]">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Đóng</button>
          <button onClick={() => { onSelectFile(); onClose() }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"><FileSpreadsheet size={16} /> Chọn file & Import</button>
        </div>
      </div>
    </div>
  )
}
