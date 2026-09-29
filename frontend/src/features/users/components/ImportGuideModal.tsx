import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface ImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = perLanguage(() => (i18n.t('users:ImportGuideModal.emailFullnameEmployeecodePhoneRolePassword')))

const COLUMNS = perLanguage(() => ([
  { name: 'Email', required: true, desc: i18n.t('users:ImportGuideModal.signInEmailMustBeUnique'), example: 'abc@company.com' },
  { name: 'FullName', required: true, desc: i18n.t('users:ImportGuideModal.fullName'), example: i18n.t('users:ImportGuideModal.johnDoe') },
  { name: 'EmployeeCode', required: false, desc: i18n.t('users:ImportGuideModal.employeeId'), example: 'NV001' },
  { name: 'Phone', required: false, desc: i18n.t('users:ImportGuideModal.phoneNumberCanBeLeftEmpty'), example: '0901000001' },
  { name: 'Role', required: false, desc: i18n.t('users:ImportGuideModal.roleDirectorHeadDeputyLeaderStaff'), example: 'STAFF' },
  { name: 'Password', required: false, desc: i18n.t('users:ImportGuideModal.signInPasswordGeneratedAutomaticallyIf'), example: '123456aA' },
  { name: 'OrgUnitCode', required: false, desc: i18n.t('users:ImportGuideModal.unitCodeToAssignThePerson'), example: 'HN01' },
]))

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_CONTENT()], { type: 'text/csv;charset=utf-8;' })
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
  const worksheet = workbook.addWorksheet(i18n.t('users:ImportGuideModal.peopleList'))

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
    ['hai@keyperson.com', i18n.t('users:ImportGuideModal.hai'), 'KP001', '0972867825', 'STAFF', 'Haikp123@', ''],
    ['nghia@keyperson.com', i18n.t('users:ImportGuideModal.nghia'), 'KP002', '0325614226', 'STAFF', 'Nghiakp123@', ''],
    ['xuan@keyperson.com', i18n.t('users:ImportGuideModal.xuan'), 'KP003', '0354744854', 'STAFF', 'Xuankp123@', 'HN01'],
    ['khoa@keyperson.com', 'Khoa', 'KP004', '0342719583', 'STAFF', 'Khoakp123@', ''],
    ['duc@keyperson.com', i18n.t('users:ImportGuideModal.duc'), 'KP005', '0972458591', 'STAFF', 'Duckp123@', 'HCM01'],
    ['phuonganh@keyperson.com', i18n.t('users:ImportGuideModal.phuongAnh'), 'KP006', '0968078673', 'STAFF', 'Phuonganhkp123@', ''],
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
  const guideSheet = workbook.addWorksheet(i18n.t('users:ImportGuideModal.detailedGuide'))
  guideSheet.columns = [
    { header: i18n.t('users:ImportGuideModal.columnName'), key: 'name', width: 20 },
    { header: i18n.t('users:ImportGuideModal.required'), key: 'req', width: 15 },
    { header: i18n.t('users:ImportGuideModal.description'), key: 'desc', width: 50 },
    { header: i18n.t('users:ImportGuideModal.example'), key: 'ex', width: 25 },
  ]
  const guideHeader = guideSheet.getRow(1)
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
  guideHeader.height = 30

  COLUMNS().forEach(c => {
    const row = guideSheet.addRow([c.name, c.required ? i18n.t('users:ImportGuideModal.yes') : i18n.t('users:ImportGuideModal.no'), c.desc, c.example])
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
  const noteTitleRow = guideSheet.addRow([i18n.t('users:ImportGuideModal.generalNotesForExcelCsvImport')])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow([i18n.t('users:ImportGuideModal.n1ThisSampleFileSupportsImporting')])
  guideSheet.addRow([i18n.t('users:ImportGuideModal.n2IfImportingViaCsvPlease')])
  guideSheet.addRow([i18n.t('users:ImportGuideModal.n3TheEmailIsUniqueAnd')])
  guideSheet.addRow([i18n.t('users:ImportGuideModal.n4PasswordCanBeLeftEmpty')])
  guideSheet.addRow([i18n.t('users:ImportGuideModal.n5OrgunitcodeIsTheDepartmentCode')])

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

const STEPS = perLanguage(() => ([
  { num: '01', title: i18n.t('users:ImportGuideModal.downloadSampleFile'), desc: i18n.t('users:ImportGuideModal.clickTheButtonBelowToDownload') },
  { num: '02', title: i18n.t('users:ImportGuideModal.fillInTheInformation'), desc: i18n.t('users:ImportGuideModal.openTheFileInExcelOr') },
  { num: '03', title: i18n.t('users:ImportGuideModal.saveUpload'), desc: i18n.t('users:ImportGuideModal.saveTheFileAsCsvOr') },
]))



export default function ImportGuideModal({ open, onClose, onSelectFile }: ImportGuideModalProps) {
  const { t } = useTranslation('users')
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('ImportGuideModal.bulkPeopleImport')}
      description={t('ImportGuideModal.supportsCsvAndXlsxFormats')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('ImportGuideModal.close')}</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> {t('ImportGuideModal.chooseFileImport')}</Button>}
        />
      }
    >
      <div className="space-y-6">
        {/* Steps */}
        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportGuideModal.n3StepProcess')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS().map((step) => (
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
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportGuideModal.withColorsAndStandardFormatting')}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}>
              <Download aria-hidden="true" /> {t('ImportGuideModal.downloadXlsxTemplate')}
            </Button>
          </div>

          {/* CSV Simple */}
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">{t('ImportGuideModal.basicCsvTemplate')}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportGuideModal.compatibleWithEveryDevice')}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}>
              <Download aria-hidden="true" /> {t('ImportGuideModal.downloadCsvTemplate')}
            </Button>
          </div>
        </div>

        {/* Column Specification */}
        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportGuideModal.dataColumnStructure')}</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportGuideModal.columnName')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportGuideModal.required')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)] hidden sm:table-cell">{t('ImportGuideModal.description')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportGuideModal.example')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {COLUMNS().map((col) => (
                  <tr key={col.name} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <code className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-xs font-medium text-[var(--color-foreground)]">{col.name}</code>
                    </td>
                    <td className="px-4 py-3">
                      {col.required ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)]">
                          <AlertTriangle size={12} /> {t('ImportGuideModal.yes2')}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('ImportGuideModal.no2')}</span>
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
          <h3 className="text-eyebrow">{t('ImportGuideModal.importantNotes')}</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Info size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)] leading-relaxed">
                {t('ImportGuideModal.each')} <strong>Email</strong> {t('ImportGuideModal.mustBeUniqueIfTheEmail')}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
              <Info size={16} className="text-[var(--color-info)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-info)] leading-relaxed">
                {t('ImportGuideModal.youCan')} <strong>{t('ImportGuideModal.setYourOwnPassword')}</strong> {t('ImportGuideModal.inTheImportFileIfLeft')}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">
                {t('ImportGuideModal.bothFormatsAreSupported')} <strong>.csv</strong> {t('ImportGuideModal.recommendedAnd')} <strong>.xlsx</strong>{t('ImportGuideModal.ifUsingExcelSaveTheFile')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
