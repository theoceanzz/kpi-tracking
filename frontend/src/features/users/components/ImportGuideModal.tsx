import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText } from 'lucide-react'

interface ImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = `Email,FullName,Phone,Role
nguyenvana@company.com,Nguyễn Văn A,0901000001,HEAD
tranthib@company.com,Trần Thị B,0901000002,STAFF
levanc@company.com,Lê Văn C,,STAFF`

function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_nhan_su.csv'
    a.click()
    URL.revokeObjectURL(url)
  }
  // For xlsx we also generate a CSV since building real xlsx in browser needs a lib
  // The backend accepts both formats so CSV template is sufficient
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Nhấn nút bên dưới để tải về file CSV mẫu có sẵn header chuẩn.' },
  { num: '02', title: 'Điền thông tin', desc: 'Mở file bằng Excel hoặc Google Sheets, điền thông tin nhân sự theo từng dòng.' },
  { num: '03', title: 'Lưu & Upload', desc: 'Lưu file ở định dạng .csv hoặc .xlsx, sau đó nhấn "Chọn file & Import" bên dưới.' },
]

const COLUMNS = [
  { name: 'Email', required: true, desc: 'Email đăng nhập, phải là duy nhất trong hệ thống', example: 'abc@company.com' },
  { name: 'FullName', required: true, desc: 'Họ và tên đầy đủ', example: 'Nguyễn Văn A' },
  { name: 'Phone', required: false, desc: 'Số điện thoại (có thể để trống)', example: '0901000001' },
  { name: 'Role', required: false, desc: 'Vai trò: HEAD, DEPUTY, STAFF (mặc định STAFF)', example: 'STAFF' },
]

export default function ImportGuideModal({ open, onClose, onSelectFile }: ImportGuideModalProps) {
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
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Import Nhân sự Hàng loạt</h2>
              <p className="text-sm font-medium text-slate-500">Hỗ trợ định dạng .csv và .xlsx</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-8 py-6 space-y-8">

          {/* Steps */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Quy trình 3 bước</h3>
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
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/10 border border-emerald-200/50 dark:border-emerald-900/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-sm text-slate-900 dark:text-emerald-100">Tải file mẫu CSV</p>
                <p className="text-xs text-slate-500 dark:text-emerald-300/60">Đã bao gồm header chuẩn và 3 dòng dữ liệu ví dụ</p>
              </div>
            </div>
            <button
              onClick={() => downloadTemplate('csv')}
              className="shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <FileText size={16} /> Tải mẫu .CSV
            </button>
          </div>

          {/* Column Specification */}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">Cấu trúc cột dữ liệu</h3>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
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
                      <td className="px-4 py-3">
                        <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">{col.name}</code>
                      </td>
                      <td className="px-4 py-3">
                        {col.required ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600">
                            <AlertTriangle size={12} /> Có
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-slate-400">Không</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 hidden sm:table-cell">{col.desc}</td>
                      <td className="px-4 py-3 text-xs font-mono text-slate-600 dark:text-slate-400">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Important Notes */}
          <div className="space-y-3">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Lưu ý quan trọng</h3>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30">
                <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  Mỗi <strong>Email</strong> phải là duy nhất. Nếu email đã tồn tại trong hệ thống, dòng đó sẽ bị bỏ qua và báo lỗi.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200/50 dark:border-blue-900/30">
                <Info size={16} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
                  Mật khẩu sẽ được <strong>tự động tạo</strong> và gửi qua email cho từng nhân sự. Người dùng có thể đổi mật khẩu sau khi đăng nhập lần đầu.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/30">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  Hỗ trợ cả hai định dạng <strong>.csv</strong> (khuyến nghị) và <strong>.xlsx</strong>. Nếu dùng Excel, lưu file dạng UTF-8 CSV để tránh lỗi font tiếng Việt.
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
            Đóng
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
