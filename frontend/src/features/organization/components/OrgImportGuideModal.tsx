import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'

interface OrgImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = `Name,Code,ParentCode,Email,Phone,Address
Khối Công nghệ,KPG-TECH,KPG,tech@keyperson.com,0325614226,Hà Nội
Trung tâm Phát triển,KPG-TECH-DEV,KPG-TECH,dev@keyperson.com,0354744854,Hà Nội
Trung tâm QA,KPG-TECH-QA,KPG-TECH,qa@keyperson.com,0342719583,Hà Nội
Khối Kinh doanh,KPG-SALES,KPG,sales@keyperson.com,0972458591,Hà Nội`

const COLUMNS = [
  { name: 'Name', required: true, desc: 'Tên đầy đủ của đơn vị tổ chức', example: 'Khối Công nghệ' },
  { name: 'Code', required: true, desc: 'Mã đơn vị (duy nhất trong hệ thống)', example: 'KPG-TECH' },
  { name: 'ParentCode', required: true, desc: 'Mã đơn vị cha (bắt buộc để xác định vị trí trong sơ đồ, bỏ trống nếu là đơn vị gốc)', example: 'KPG' },
  { name: 'Email', required: false, desc: 'Email liên hệ của đơn vị', example: 'tech@company.com' },
  { name: 'Phone', required: false, desc: 'Số điện thoại liên hệ', example: '0243123456' },
  { name: 'Address', required: false, desc: 'Địa chỉ trụ sở đơn vị', example: 'Tầng 5, Tòa nhà A' },
]

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_so_do_to_chuc.csv'
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Sơ đồ tổ chức')

  worksheet.columns = [
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'Code', key: 'Code', width: 15 },
    { header: 'ParentCode', key: 'ParentCode', width: 15 },
    { header: 'Email', key: 'Email', width: 25 },
    { header: 'Phone', key: 'Phone', width: 15 },
    { header: 'Address', key: 'Address', width: 30 },
  ]

  const data = [
    ['Khối Công nghệ', 'KPG-TECH', 'KPG', 'tech@keyperson.com', '0325614226', 'Hà Nội'],
    ['Trung tâm Phát triển', 'KPG-TECH-DEV', 'KPG-TECH', 'dev@keyperson.com', '0354744854', 'Hà Nội'],
    ['Trung tâm QA', 'KPG-TECH-QA', 'KPG-TECH', 'qa@keyperson.com', '0342719583', 'Hà Nội'],
    ['Khối Kinh doanh', 'KPG-SALES', 'KPG', 'sales@keyperson.com', '0972458591', 'Hà Nội'],
  ]
  worksheet.addRows(data)

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 30

  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      }
      if (rowNumber > 1) {
        cell.alignment = { vertical: 'middle' }
        cell.font = { size: 11 }
      }
    })
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
  guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
  guideHeader.height = 30

  COLUMNS.forEach(c => {
    const row = guideSheet.addRow([c.name, c.required ? 'CÓ' : 'KHÔNG', c.desc, c.example])
    row.font = { size: 11 }
    row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      }
    })
  })

  guideSheet.addRow([])
  const noteTitleRow = guideSheet.addRow(['LƯU Ý KHI IMPORT SƠ ĐỒ TỔ CHỨC'])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow(['1. ParentCode phải là một Code đã tồn tại trong file hoặc trong hệ thống.'])
  guideSheet.addRow(['2. Nếu một đơn vị không có ParentCode, nó sẽ được hiểu là đơn vị cấp cao nhất (Root).'])
  guideSheet.addRow(['3. UnitTypeName sẽ được sử dụng để hiển thị loại cấp bậc trong sơ đồ.'])
  guideSheet.addRow(['4. Nếu Code đã tồn tại, hệ thống sẽ cập nhật thông tin đơn vị đó thay vì tạo mới.'])

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_so_do_to_chuc.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Chọn định dạng CSV hoặc XLSX để tải về cấu trúc header chuẩn.' },
  { num: '02', title: 'Thiết lập cây', desc: 'Định nghĩa quan hệ Cha-Con thông qua cột ParentCode để tạo sơ đồ.' },
  { num: '03', title: 'Kiểm tra & Import', desc: 'Tải file lên hệ thống để tự động xây dựng cây thư mục tổ chức.' },
]

export default function OrgImportGuideModal({ open, onClose, onSelectFile }: OrgImportGuideModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 px-8 py-6 flex items-center justify-between rounded-t-[28px]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Import Sơ đồ Tổ chức</h2>
              <p className="text-sm font-medium text-slate-500">Xây dựng cấu trúc phòng ban hàng loạt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Các bước thực hiện</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <div key={step.num} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-black">
                    {step.num}
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{step.title}</h4>
                  <p className="text-xs text-slate-500">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 border border-indigo-200/50 dark:border-indigo-900/30 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                  <FileBarChart size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-indigo-100">Template XLSX</p>
                  <p className="text-xs text-slate-500 dark:text-indigo-300/60">Định dạng khuyến nghị</p>
                </div>
              </div>
              <button
                onClick={() => downloadTemplate('xlsx')}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition-all active:scale-95"
              >
                <Download size={16} /> Tải mẫu .XLSX
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400">
                  <FileText size={20} />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-white">Mẫu CSV</p>
                  <p className="text-xs text-slate-500">Đơn giản, gọn nhẹ</p>
                </div>
              </div>
              <button
                onClick={() => downloadTemplate('csv')}
                className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
              >
                <Download size={16} /> Tải mẫu .CSV
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Mô tả các cột</h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="px-4 py-3 text-xs font-black uppercase text-slate-500">Cột</th>
                    <th className="px-4 py-3 text-xs font-black uppercase text-slate-500">Bắt buộc</th>
                    <th className="px-4 py-3 text-xs font-black uppercase text-slate-500">Ví dụ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {COLUMNS.map((col) => (
                    <tr key={col.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">
                        <code className="text-xs font-bold text-indigo-600">{col.name}</code>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {col.required ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-bold">
                            <AlertTriangle size={12} /> Có
                          </span>
                        ) : (
                          <span className="text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/30">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Cột <code>Code</code> của các đơn vị phải là duy nhất. Nếu hệ thống tìm thấy mã trùng, nó sẽ cập nhật thay vì tạo mới.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  Cột <code>ParentCode</code> rất quan trọng để hệ thống tự động sắp xếp các phòng ban vào đúng vị trí trên sơ đồ. Hãy đảm bảo mã đơn vị cha được nhập chính xác.
                </p>
              </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 px-8 py-5 flex items-center justify-end gap-3 rounded-b-[28px]">
          <button onClick={onClose} className="px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 transition-all">
            Đóng
          </button>
          <button
            onClick={() => { onSelectFile(); onClose() }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg active:scale-95"
          >
            <FileSpreadsheet size={16} /> Chọn file & Import
          </button>
        </div>
      </div>
    </div>
  )
}
