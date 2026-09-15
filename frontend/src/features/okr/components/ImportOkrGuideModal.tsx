import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ImportOkrGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

// Cột hạng mục BSC chỉ có mặt khi tổ chức bật enable_bsc. Nằm ở cấp Objective — KPI thuộc
// mục tiêu sẽ kế thừa hạng mục này (trừ khi KPI tự gán trực tiếp).
function buildSampleCsv(enableBsc: boolean): string {
  const header = enableBsc
    ? 'ObjectiveCode,ObjectiveName,ObjectiveDescription,ObjectiveStartDate,ObjectiveEndDate,OrgUnitCode,ObjectivePerspective,KeyResultCode,KeyResultName,KeyResultDescription,KeyResultTarget,KeyResultUnit'
    : 'ObjectiveCode,ObjectiveName,ObjectiveDescription,ObjectiveStartDate,ObjectiveEndDate,OrgUnitCode,KeyResultCode,KeyResultName,KeyResultDescription,KeyResultTarget,KeyResultUnit'
  const rows = enableBsc
    ? [
        'OBJ001,Tăng trưởng doanh thu 20%,Mục tiêu doanh thu quý 1,2024-01-01,2024-03-31,KD_HN,DOANH_THU,KR001,Ký mới 10 hợp đồng lớn,Hợp đồng giá trị >100tr,10,hợp đồng',
        ',,,,,,,KR002,Upsell khách hàng cũ 15%,,15,%',
        'OBJ002,Nâng cao chất lượng dịch vụ,,2024-01-01,2024-06-30,NS_HN,HAI_LONG_KH,KR003,Giảm tỷ lệ rời bỏ xuống 5%,,5,%',
        ',,,,,,,KR004,Tăng điểm CSAT lên 4.5/5,,4.5,điểm',
      ]
    : [
        'OBJ001,Tăng trưởng doanh thu 20%,Mục tiêu doanh thu quý 1,2024-01-01,2024-03-31,KD_HN,KR001,Ký mới 10 hợp đồng lớn,Hợp đồng giá trị >100tr,10,hợp đồng',
        ',,,,,KR002,Upsell khách hàng cũ 15%,,15,%',
        'OBJ002,Nâng cao chất lượng dịch vụ,,2024-01-01,2024-06-30,NS_HN,KR003,Giảm tỷ lệ rời bỏ xuống 5%,,5,%',
        ',,,,,KR004,Tăng điểm CSAT lên 4.5/5,,4.5,điểm',
      ]
  return [header, ...rows].join('\n')
}

function getColumns(enableBsc: boolean) {
  return [
    { name: 'ObjectiveCode', required: true, desc: 'Mã mục tiêu (dùng để đối soát và gom nhóm KR)', example: 'OBJ001' },
    { name: 'ObjectiveName', required: true, desc: 'Tên mục tiêu', example: 'Tăng trưởng doanh thu' },
    { name: 'ObjectiveDescription', required: false, desc: 'Mô tả mục tiêu', example: 'Mục tiêu quý 1' },
    { name: 'ObjectiveStartDate', required: false, desc: 'Ngày bắt đầu (YYYY-MM-DD)', example: '2024-01-01' },
    { name: 'ObjectiveEndDate', required: false, desc: 'Ngày kết thúc (YYYY-MM-DD)', example: '2024-03-31' },
    { name: 'OrgUnitCode', required: true, desc: 'Mã phòng ban. Hỗ trợ nhập nhiều mã cách nhau bằng dấu phẩy (PB01,PB02). Nhập mã của Đơn vị gốc để giao cho tất cả đơn vị con.', example: 'KD_HN, NS_HN' },
    ...(enableBsc ? [
      { name: 'ObjectivePerspective', required: false, desc: 'Hạng mục BSC của Mục tiêu — nhập mã hoặc tên hạng mục (VD: DOANH_THU hoặc Doanh thu). KPI thuộc mục tiêu sẽ kế thừa hạng mục này.', example: 'DOANH_THU' },
    ] : []),
    { name: 'KeyResultCode', required: true, desc: 'Mã kết quả then chốt. Để trống ô này thì hệ thống tự cấp mã theo mẫu của công ty (nếu công ty bật sinh mã tự động)', example: 'KR001' },
    { name: 'KeyResultName', required: true, desc: 'Tên kết quả then chốt', example: 'Đạt 1 tỷ VNĐ' },
    { name: 'KeyResultDescription', required: false, desc: 'Mô tả KR', example: 'Doanh thu từ mảng A' },
    { name: 'KeyResultTarget', required: false, desc: 'Chỉ tiêu (số)', example: '1000000000' },
    { name: 'KeyResultUnit', required: false, desc: 'Đơn vị đo lường', example: 'VNĐ' },
  ]
}

async function downloadTemplate(type: 'csv' | 'xlsx', enableBsc: boolean) {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + buildSampleCsv(enableBsc)], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_okr.csv'
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  // Professional XLSX using ExcelJS
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Danh sách OKR')

  // Define columns
  worksheet.columns = [
    { header: 'ObjectiveCode', key: 'ObjectiveCode', width: 20 },
    { header: 'ObjectiveName', key: 'ObjectiveName', width: 30 },
    { header: 'ObjectiveDescription', key: 'ObjectiveDescription', width: 25 },
    { header: 'ObjectiveStartDate', key: 'ObjectiveStartDate', width: 20 },
    { header: 'ObjectiveEndDate', key: 'ObjectiveEndDate', width: 20 },
    { header: 'OrgUnitCode', key: 'OrgUnitCode', width: 20 },
    ...(enableBsc ? [{ header: 'ObjectivePerspective', key: 'ObjectivePerspective', width: 22 }] : []),
    { header: 'KeyResultCode', key: 'KeyResultCode', width: 20 },
    { header: 'KeyResultName', key: 'KeyResultName', width: 30 },
    { header: 'KeyResultDescription', key: 'KeyResultDescription', width: 25 },
    { header: 'KeyResultTarget', key: 'KeyResultTarget', width: 15 },
    { header: 'KeyResultUnit', key: 'KeyResultUnit', width: 15 },
  ]

  // Add data rows (chèn cột hạng mục sau OrgUnitCode khi bật BSC)
  const data = enableBsc ? [
    ['OBJ001', 'Tăng trưởng doanh thu 20%', 'Mục tiêu doanh thu quý 1', '2024-01-01', '2024-03-31', 'KD_HN', 'DOANH_THU', 'KR001', 'Ký mới 10 hợp đồng lớn', 'Hợp đồng giá trị >100tr', 10, 'hợp đồng'],
    ['', '', '', '', '', '', '', 'KR002', 'Upsell khách hàng cũ 15%', '', 15, '%'],
    ['OBJ002', 'Nâng cao chất lượng dịch vụ', '', '2024-01-01', '2024-06-30', 'NS_HN', 'HAI_LONG_KH', 'KR003', 'Giảm tỷ lệ rời bỏ xuống 5%', '', 5, '%'],
    ['', '', '', '', '', '', '', 'KR004', 'Tăng điểm CSAT lên 4.5/5', '', 4.5, 'điểm'],
  ] : [
    ['OBJ001', 'Tăng trưởng doanh thu 20%', 'Mục tiêu doanh thu quý 1', '2024-01-01', '2024-03-31', 'KD_HN', 'KR001', 'Ký mới 10 hợp đồng lớn', 'Hợp đồng giá trị >100tr', 10, 'hợp đồng'],
    ['', '', '', '', '', '', 'KR002', 'Upsell khách hàng cũ 15%', '', 15, '%'],
    ['OBJ002', 'Nâng cao chất lượng dịch vụ', '', '2024-01-01', '2024-06-30', 'NS_HN', 'KR003', 'Giảm tỷ lệ rời bỏ xuống 5%', '', 5, '%'],
    ['', '', '', '', '', '', 'KR004', 'Tăng điểm CSAT lên 4.5/5', '', 4.5, 'điểm'],
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
    { header: 'Tên cột', key: 'name', width: 25 },
    { header: 'Bắt buộc', key: 'req', width: 15 },
    { header: 'Mô tả', key: 'desc', width: 50 },
    { header: 'Ví dụ', key: 'ex', width: 25 },
  ]
  const guideHeader = guideSheet.getRow(1)
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
  guideHeader.height = 30

  getColumns(enableBsc).forEach(c => {
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
  const noteTitleRow = guideSheet.addRow(['LƯU Ý CHUNG CHO IMPORT OKR EXCEL'])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow(['1. File mẫu này hỗ trợ import định dạng .xlsx.'])
  guideSheet.addRow(['2. Để thêm nhiều KR cho một Objective, dòng đầu ghi đủ thông tin Objective, các dòng sau để trống thông tin Objective cũng được.'])
  guideSheet.addRow(['3. Mã Objective (ObjectiveCode) và Mã KR (KeyResultCode) dùng để cập nhật dữ liệu. Nếu mã đã tồn tại ở đơn vị tương ứng, hệ thống sẽ update.'])
  guideSheet.addRow(['4. Cột OrgUnitCode hỗ trợ nhập nhiều mã cách nhau bởi dấu phẩy (,), hoặc nhập mã đơn vị gốc để tự động mở rộng ra toàn bộ đơn vị con.'])
  if (enableBsc) {
    guideSheet.addRow(['5. ObjectivePerspective: Hạng mục BSC gán cho Mục tiêu. Nhập MÃ (VD: DOANH_THU) hoặc TÊN (VD: Doanh thu) — hệ thống tự đối chiếu. Để trống nếu chưa gán. KPI thuộc mục tiêu sẽ kế thừa hạng mục này.'])
  }

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_okr_pro.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const STEPS = [
  { num: '01', title: 'Tải file mẫu', desc: 'Nhấn nút bên dưới để tải về file mẫu có sẵn cấu trúc chuẩn.' },
  { num: '02', title: 'Điền thông tin', desc: 'Nhập Mục tiêu và các Kết quả then chốt vào file. (Nhiều KR có thể chung 1 Objective).' },
  { num: '03', title: 'Lưu & Upload', desc: 'Lưu file định dạng .xlsx và chọn "Chọn file & Import" bên dưới.' },
]



export default function ImportOkrGuideModal({ open, onClose, onSelectFile }: ImportOkrGuideModalProps) {
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const enableBsc = org?.enableBsc || false
  const COLUMNS = getColumns(enableBsc)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Import OKR Hàng loạt"
      description="Hỗ trợ định dạng .xlsx"
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
                <p className="text-xs text-[var(--color-muted-foreground)]">Định dạng chuẩn khuyên dùng</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx', enableBsc)}>
              <Download aria-hidden="true" /> Tải mẫu .XLSX
            </Button>
          </div>

          {/* CSV Simple */}
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4 opacity-75 grayscale">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">Mẫu CSV cơ bản</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Chỉ dùng để xem cấu trúc</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv', enableBsc)}>
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
                Các <strong>Mã (Code)</strong> dùng để hệ thống nhận diện và CẬP NHẬT dữ liệu nếu đã tồn tại. Để trống thông tin Objective ở các dòng sau nếu muốn nối thêm KR cho Objective liền trước.
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">
                Định dạng bắt buộc khi Import là <strong>.xlsx</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
