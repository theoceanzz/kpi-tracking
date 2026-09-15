import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title="Import Sơ đồ Tổ chức"
      description="Xây dựng cấu trúc phòng ban hàng loạt"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>Đóng</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> Chọn file & Import</Button>}
        />
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-eyebrow mb-3">Các bước thực hiện</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS.map((step) => (
              <div key={step.num} className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-2">
                <div className="w-8 h-8 rounded-control bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center text-xs font-semibold">
                  {step.num}
                </div>
                <h4 className="font-medium text-sm text-[var(--color-foreground)]">{step.title}</h4>
                <p className="text-xs text-[var(--color-muted-foreground)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-primary)] flex items-center justify-center text-[var(--color-primary-foreground)]">
                <FileBarChart size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">Template XLSX</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Định dạng khuyến nghị</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}>
              <Download aria-hidden="true" /> Tải mẫu .XLSX
            </Button>
          </div>

          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">Mẫu CSV</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Đơn giản, gọn nhẹ</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}>
              <Download aria-hidden="true" /> Tải mẫu .CSV
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-eyebrow mb-3">Mô tả các cột</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-2.5 text-eyebrow">Cột</th>
                  <th className="px-4 py-2.5 text-eyebrow">Bắt buộc</th>
                  <th className="px-4 py-2.5 text-eyebrow">Ví dụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {COLUMNS.map((col) => (
                  <tr key={col.name} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <code className="text-xs font-medium text-[var(--color-primary)]">{col.name}</code>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {col.required ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-error)] font-semibold">
                          <AlertTriangle size={12} /> Có
                        </span>
                      ) : (
                        <span className="text-[var(--color-subtle-foreground)]">Không</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted-foreground)]">{col.example}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">
                Cột <code>Code</code> của các đơn vị phải là duy nhất. Nếu hệ thống tìm thấy mã trùng, nó sẽ cập nhật thay vì tạo mới.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
              <Info size={16} className="text-[var(--color-info)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-info)] leading-relaxed">
                Cột <code>ParentCode</code> rất quan trọng để hệ thống tự động sắp xếp các phòng ban vào đúng vị trí trên sơ đồ. Hãy đảm bảo mã đơn vị cha được nhập chính xác.
              </p>
            </div>
      </div>
    </Dialog>
  )
}
