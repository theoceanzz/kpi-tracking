import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = `Email,FullName,EmployeeCode,Phone,Role,Password,OrgUnitCode
hai@keyperson.com,Hải,KP001,0972867825,STAFF,Haikp123@,
nghia@keyperson.com,Nghĩa,KP002,0325614226,STAFF,Nghiakp123@,
xuan@keyperson.com,Xuân,KP003,0354744854,STAFF,Xuankp123@,HN01
khoa@keyperson.com,Khoa,KP004,0342719583,STAFF,Khoakp123@,
duc@keyperson.com,Đức,KP005,0972458591,STAFF,Duckp123@,HCM01
phuonganh@keyperson.com,Phương Anh,KP006,0968078673,STAFF,Phuonganhkp123@,`

const COLUMNS = [
  { name: 'Email', required: true, desc: 'Email đăng nhập, phải là duy nhất trong hệ thống', example: 'abc@company.com' },
  { name: 'FullName', required: true, desc: 'Họ và tên đầy đủ', example: 'Nguyễn Văn A' },
  { name: 'EmployeeCode', required: false, desc: 'Mã số nhân viên', example: 'NV001' },
  { name: 'Phone', required: false, desc: 'Số điện thoại (có thể để trống)', example: '0901000001' },
  { name: 'Role', required: false, desc: 'Vai trò: DIRECTOR, HEAD, DEPUTY, LEADER, STAFF (mặc định STAFF)', example: 'STAFF' },
  { name: 'Password', required: false, desc: 'Mật khẩu đăng nhập (nếu trống sẽ tự động tạo)', example: '123456aA' },
  { name: 'OrgUnitCode', required: false, desc: 'Mã đơn vị để gán nhân sự (vd: HN01). Nếu trống sẽ chỉ gán vào công ty.', example: 'HN01' },
]

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_nhan_su.csv'
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  // Professional XLSX using ExcelJS
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Danh sách nhân sự')

  // Define columns
  worksheet.columns = [
    { header: 'Email', key: 'Email', width: 30 },
    { header: 'FullName', key: 'FullName', width: 25 },
    { header: 'EmployeeCode', key: 'EmployeeCode', width: 15 },
    { header: 'Phone', key: 'Phone', width: 15 },
    { header: 'Role', key: 'Role', width: 15 },
    { header: 'Password', key: 'Password', width: 20 },
    { header: 'OrgUnitCode', key: 'OrgUnitCode', width: 20 },
  ]

  // Add data rows
  const data = [
    ['hai@keyperson.com', 'Hải', 'KP001', '0972867825', 'STAFF', 'Haikp123@', ''],
    ['nghia@keyperson.com', 'Nghĩa', 'KP002', '0325614226', 'STAFF', 'Nghiakp123@', ''],
    ['xuan@keyperson.com', 'Xuân', 'KP003', '0354744854', 'STAFF', 'Xuankp123@', 'HN01'],
    ['khoa@keyperson.com', 'Khoa', 'KP004', '0342719583', 'STAFF', 'Khoakp123@', ''],
    ['duc@keyperson.com', 'Đức', 'KP005', '0972458591', 'STAFF', 'Duckp123@', 'HCM01'],
    ['phuonganh@keyperson.com', 'Phương Anh', 'KP006', '0968078673', 'STAFF', 'Phuonganhkp123@', ''],
  ]
  worksheet.addRows(data)

  // Style the header row
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' } // Slate 800
  }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' }
  headerRow.height = 30

  // Style data rows
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

  // Add Guide Sheet
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
  const noteTitleRow = guideSheet.addRow(['LƯU Ý CHUNG CHO IMPORT EXCEL & CSV'])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow(['1. File mẫu này hỗ trợ import cả định dạng .xlsx và .csv.'])
  guideSheet.addRow(['2. Nếu import bằng CSV, bạn vui lòng xuất dữ liệu từ tab "Danh sách nhân sự" ra file .csv (UTF-8).'])
  guideSheet.addRow(['3. Email là duy nhất, không được trùng với tài khoản đã có trên hệ thống.'])
  guideSheet.addRow(['4. Password có thể để trống. Hệ thống sẽ tự tạo mật khẩu mạnh và gửi email cho người dùng.'])
  guideSheet.addRow(['5. OrgUnitCode là mã phòng ban. Nếu trống, nhân sự sẽ thuộc cấp toàn công ty.'])

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_nhan_su_pro.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Nhấn nút bên dưới để tải về file CSV mẫu có sẵn header chuẩn.' },
  { num: '02', title: 'Điền thông tin', desc: 'Mở file bằng Excel hoặc Google Sheets, điền thông tin nhân sự theo từng dòng.' },
  { num: '03', title: 'Lưu & Upload', desc: 'Lưu file ở định dạng .csv hoặc .xlsx, sau đó nhấn "Chọn file & Import" bên dưới.' },
]



export default function ImportGuideModal({ open, onClose, onSelectFile }: ImportGuideModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Import Nhân sự Hàng loạt"
      description="Hỗ trợ định dạng .csv và .xlsx"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>Đóng</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> Chọn file & Import</Button>}
        />
      }
    >
      <div className="space-y-6">
        {/* Steps */}
        <div>
          <h3 className="text-eyebrow mb-3">Quy trình 3 bước</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step) => (
              <div key={step.num} className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-2">
                <div className="w-8 h-8 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center text-xs font-semibold">
                  {step.num}
                </div>
                <h4 className="font-medium text-sm text-[var(--color-foreground)]">{step.title}</h4>
                <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Download Template */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* XLSX Pro */}
          <div className="p-5 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)]">
                <FileBarChart size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">Template XLSX Pro</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Có màu sắc, định dạng chuẩn</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}>
              <Download aria-hidden="true" /> Tải mẫu .XLSX
            </Button>
          </div>

          {/* CSV Simple */}
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">Mẫu CSV cơ bản</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Tương thích mọi thiết bị</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}>
              <Download aria-hidden="true" /> Tải mẫu .CSV
            </Button>
          </div>
        </div>

        {/* Column Specification */}
        <div>
          <h3 className="text-eyebrow mb-3">Cấu trúc cột dữ liệu</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">Tên cột</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">Bắt buộc</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)] hidden sm:table-cell">Mô tả</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">Ví dụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {COLUMNS.map((col) => (
                  <tr key={col.name} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <code className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-xs font-medium text-[var(--color-foreground)]">{col.name}</code>
                    </td>
                    <td className="px-4 py-3">
                      {col.required ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)]">
                          <AlertTriangle size={12} /> Có
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">Không</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)] hidden sm:table-cell">{col.desc}</td>
                    <td className="px-4 py-3 text-xs font-mono text-[var(--color-muted-foreground)]">{col.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Important Notes */}
        <div className="space-y-3">
          <h3 className="text-eyebrow">Lưu ý quan trọng</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Info size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)] leading-relaxed">
                Mỗi <strong>Email</strong> phải là duy nhất. Nếu email đã tồn tại trong hệ thống, dòng đó sẽ bị bỏ qua và báo lỗi.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
              <Info size={16} className="text-[var(--color-info)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-info)] leading-relaxed">
                Bạn có thể <strong>tự đặt mật khẩu</strong> trong file import. Nếu để trống, hệ thống sẽ tự động tạo ngẫu nhiên và gửi qua email cho nhân sự.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">
                Hỗ trợ cả hai định dạng <strong>.csv</strong> (khuyến nghị) và <strong>.xlsx</strong>. Nếu dùng Excel, lưu file dạng UTF-8 CSV để tránh lỗi font tiếng Việt.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
