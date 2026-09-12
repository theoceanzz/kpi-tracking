import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ImportScorecardGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = `Period,ScorecardName,Vision,OrgUnits,PerspectiveCode,PerspectiveName,FixedPerspective,Unit,Weight,Status,ScoringMode,EmptyPolicy
Quý 3/2026,Chiến lược Quý 3,Dẫn đầu thị phần khu vực,,DOANH_THU,Doanh thu thuần,FINANCIAL,tỷ,40,ACTIVE,SHADOW,RENORMALIZE
Quý 3/2026,,,,HAI_LONG_KH,Hài lòng khách hàng,CUSTOMER,%,30,,,
Quý 3/2026,,,,VAN_HANH,Chuẩn hoá vận hành,INTERNAL_PROCESS,%,20,,,
Quý 3/2026,,,,DAO_TAO,Đào tạo nội bộ,LEARNING_GROWTH,giờ,10,,,`

const COLUMNS = [
  { name: 'Period', required: true, desc: 'Tên kỳ KPI (dùng để tìm kỳ & gom nhóm bộ tiêu chí)', example: 'Quý 3/2026' },
  { name: 'ScorecardName', required: true, desc: 'Tên bộ tiêu chí (ghi ở dòng đầu của mỗi kỳ)', example: 'Chiến lược Quý 3' },
  { name: 'Vision', required: false, desc: 'Tuyên bố chiến lược', example: 'Dẫn đầu thị phần' },
  { name: 'OrgUnits', required: false, desc: 'Mã phòng ban áp dụng (nhiều mã cách nhau dấu phẩy, ghi ở dòng đầu của mỗi kỳ). Bỏ trống = toàn tổ chức. Có thể chọn ở bảng xem trước.', example: 'IT, MKT' },
  { name: 'PerspectiveCode', required: true, desc: 'Mã hạng mục. Chưa có trong tổ chức thì hệ thống TẠO MỚI theo các cột bên dưới', example: 'DOANH_THU' },
  { name: 'PerspectiveName', required: false, desc: 'Tên hạng mục — BẮT BUỘC nếu mã chưa tồn tại; mã đã có thì để trống là giữ nguyên tên cũ', example: 'Doanh thu thuần' },
  { name: 'FixedPerspective', required: false, desc: 'Lĩnh vực BSC: FINANCIAL / CUSTOMER / INTERNAL_PROCESS / LEARNING_GROWTH (mặc định INTERNAL_PROCESS)', example: 'FINANCIAL' },
  { name: 'Unit', required: false, desc: 'Đơn vị tính của hạng mục', example: 'tỷ' },
  { name: 'TargetValue', required: false, desc: 'Mục tiêu mong muốn của hạng mục', example: '100' },
  { name: 'MinimumValue', required: false, desc: 'Kết quả tối thiểu của hạng mục', example: '80' },
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
  const worksheet = workbook.addWorksheet('Bộ tiêu chí BSC')
  worksheet.columns = [
    { header: 'Period', key: 'Period', width: 18 },
    { header: 'ScorecardName', key: 'ScorecardName', width: 24 },
    { header: 'Vision', key: 'Vision', width: 30 },
    { header: 'OrgUnits', key: 'OrgUnits', width: 20 },
    { header: 'PerspectiveCode', key: 'PerspectiveCode', width: 20 },
    { header: 'PerspectiveName', key: 'PerspectiveName', width: 24 },
    { header: 'FixedPerspective', key: 'FixedPerspective', width: 20 },
    { header: 'Unit', key: 'Unit', width: 10 },
    { header: 'Weight', key: 'Weight', width: 12 },
    { header: 'Status', key: 'Status', width: 12 },
    { header: 'ScoringMode', key: 'ScoringMode', width: 14 },
    { header: 'EmptyPolicy', key: 'EmptyPolicy', width: 16 },
  ]
  worksheet.addRows([
    ['Quý 3/2026', 'Chiến lược Quý 3', 'Dẫn đầu thị phần khu vực', '', 'DOANH_THU', 'Doanh thu thuần', 'FINANCIAL', 'tỷ', 40, 'ACTIVE', 'SHADOW', 'RENORMALIZE'],
    ['Quý 3/2026', '', '', '', 'HAI_LONG_KH', 'Hài lòng khách hàng', 'CUSTOMER', '%', 30, '', '', ''],
    ['Quý 3/2026', '', '', '', 'VAN_HANH', 'Chuẩn hoá vận hành', 'INTERNAL_PROCESS', '%', 20, '', '', ''],
    ['Quý 3/2026', '', '', '', 'DAO_TAO', 'Đào tạo nội bộ', 'LEARNING_GROWTH', 'giờ', 10, '', '', ''],
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
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Import Bộ tiêu chí BSC"
      description="Hỗ trợ định dạng .xlsx"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>Đóng</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> Chọn file & Import</Button>}
        />
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-eyebrow mb-3">Quy trình 3 bước</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step) => (
              <div key={step.num} className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-2">
                <div className="w-8 h-8 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center text-xs font-semibold">{step.num}</div>
                <h4 className="font-medium text-sm text-[var(--color-foreground)]">{step.title}</h4>
                <p className="text-xs text-[var(--color-muted-foreground)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)]"><FileBarChart size={20} /></div>
              <div><p className="font-medium text-sm text-[var(--color-foreground)]">Template XLSX Pro</p><p className="text-xs text-[var(--color-muted-foreground)]">Khuyên dùng</p></div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}><Download aria-hidden="true" /> Tải mẫu .XLSX</Button>
          </div>
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4 opacity-75 grayscale">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]"><FileText size={20} /></div>
              <div><p className="font-medium text-sm text-[var(--color-foreground)]">Mẫu CSV cơ bản</p><p className="text-xs text-[var(--color-muted-foreground)]">Xem cấu trúc</p></div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}><Download aria-hidden="true" /> Tải mẫu .CSV</Button>
          </div>
        </div>

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
                      <td className="px-4 py-3"><code className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-xs font-medium text-[var(--color-foreground)]">{col.name}</code></td>
                      <td className="px-4 py-3">{col.required ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)]"><AlertTriangle size={12} /> Có</span> : <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">Không</span>}</td>
                      <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)] hidden sm:table-cell">{col.desc}</td>
                      <td className="px-4 py-3 text-xs font-mono text-[var(--color-muted-foreground)]">{col.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-eyebrow">Lưu ý quan trọng</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Info size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)] leading-relaxed">Các dòng cùng một <strong>Period</strong> được gom thành một bộ tiêu chí; <strong>tổng trọng số mỗi kỳ phải = 100%</strong>. Kỳ đã có bộ tiêu chí sẽ được <strong>cập nhật</strong>.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">Một tệp làm cả hai việc: mã hạng mục <strong>chưa có</strong> thì được tạo mới từ cột <strong>PerspectiveName</strong> + <strong>FixedPerspective</strong>, mã <strong>đã có</strong> thì chỉ gán trọng số. Phòng ban áp dụng chọn ở bảng xem trước. Định dạng import: <strong>.xlsx</strong>.</p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
