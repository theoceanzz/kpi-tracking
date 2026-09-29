import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface OrgImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = perLanguage(() => (i18n.t('organization:OrgImportGuideModal.nameCodeParentcodeEmailPhoneAddress')))

const COLUMNS = perLanguage(() => ([
  { name: 'Name', required: true, desc: i18n.t('organization:OrgImportGuideModal.fullNameOfTheOrganizationUnit'), example: i18n.t('organization:OrgImportGuideModal.technologyDivision') },
  { name: 'Code', required: true, desc: i18n.t('organization:OrgImportGuideModal.unitCodeUniqueInTheSystem'), example: 'KPG-TECH' },
  { name: 'ParentCode', required: true, desc: i18n.t('organization:OrgImportGuideModal.parentUnitCodeRequiredToPlace'), example: 'KPG' },
  { name: 'Email', required: false, desc: i18n.t('organization:OrgImportGuideModal.unitContactEmail'), example: 'tech@company.com' },
  { name: 'Phone', required: false, desc: i18n.t('organization:OrgImportGuideModal.contactPhoneNumber'), example: '0243123456' },
  { name: 'Address', required: false, desc: i18n.t('organization:OrgImportGuideModal.unitHeadquartersAddress'), example: i18n.t('organization:OrgImportGuideModal.n5thFloorBuildingA') },
]))

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['\uFEFF' + SAMPLE_CSV_CONTENT()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_so_do_to_chuc.csv'
    a.click()
    URL.revokeObjectURL(url)
    return
  }

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(i18n.t('organization:OrgImportGuideModal.organizationChart'))

  worksheet.columns = [
    { header: 'Name', key: 'Name', width: 30 },
    { header: 'Code', key: 'Code', width: 15 },
    { header: 'ParentCode', key: 'ParentCode', width: 15 },
    { header: 'Email', key: 'Email', width: 25 },
    { header: 'Phone', key: 'Phone', width: 15 },
    { header: 'Address', key: 'Address', width: 30 },
  ]

  const data = [
    [i18n.t('organization:OrgImportGuideModal.technologyDivision'), 'KPG-TECH', 'KPG', 'tech@keyperson.com', '0325614226', i18n.t('organization:OrgImportGuideModal.hanoi')],
    [i18n.t('organization:OrgImportGuideModal.developmentCenter'), 'KPG-TECH-DEV', 'KPG-TECH', 'dev@keyperson.com', '0354744854', i18n.t('organization:OrgImportGuideModal.hanoi')],
    [i18n.t('organization:OrgImportGuideModal.qaCenter'), 'KPG-TECH-QA', 'KPG-TECH', 'qa@keyperson.com', '0342719583', i18n.t('organization:OrgImportGuideModal.hanoi')],
    [i18n.t('organization:OrgImportGuideModal.salesDivision'), 'KPG-SALES', 'KPG', 'sales@keyperson.com', '0972458591', i18n.t('organization:OrgImportGuideModal.hanoi')],
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

  const guideSheet = workbook.addWorksheet(i18n.t('organization:OrgImportGuideModal.detailedGuide'))
  guideSheet.columns = [
    { header: i18n.t('organization:OrgImportGuideModal.columnName'), key: 'name', width: 20 },
    { header: i18n.t('organization:OrgImportGuideModal.required'), key: 'req', width: 15 },
    { header: i18n.t('organization:OrgImportGuideModal.description'), key: 'desc', width: 50 },
    { header: i18n.t('organization:OrgImportGuideModal.example'), key: 'ex', width: 25 },
  ]
  const guideHeader = guideSheet.getRow(1)
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
  guideHeader.height = 30

  COLUMNS().forEach(c => {
    const row = guideSheet.addRow([c.name, c.required ? i18n.t('organization:OrgImportGuideModal.yes') : i18n.t('organization:OrgImportGuideModal.no'), c.desc, c.example])
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
  const noteTitleRow = guideSheet.addRow([i18n.t('organization:OrgImportGuideModal.notesForImportingTheOrganizationChart')])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow([i18n.t('organization:OrgImportGuideModal.n1ParentcodeMustBeACode')])
  guideSheet.addRow([i18n.t('organization:OrgImportGuideModal.n2IfAUnitHasNo')])
  guideSheet.addRow([i18n.t('organization:OrgImportGuideModal.n3UnittypenameIsUsedToShow')])
  guideSheet.addRow([i18n.t('organization:OrgImportGuideModal.n4IfTheCodeAlreadyExists')])

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'mau_import_so_do_to_chuc.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

const STEPS = perLanguage(() => ([
  { num: '01', title: i18n.t('organization:OrgImportGuideModal.downloadSampleFile'), desc: i18n.t('organization:OrgImportGuideModal.chooseCsvOrXlsxToDownload') },
  { num: '02', title: i18n.t('organization:OrgImportGuideModal.setUpTheTree'), desc: i18n.t('organization:OrgImportGuideModal.defineParentChildRelationshipsViaThe') },
  { num: '03', title: i18n.t('organization:OrgImportGuideModal.checkImport'), desc: i18n.t('organization:OrgImportGuideModal.uploadTheFileToBuildThe') },
]))

export default function OrgImportGuideModal({ open, onClose, onSelectFile }: OrgImportGuideModalProps) {
  const { t } = useTranslation('organization')
  if (!open) return null

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('OrgImportGuideModal.importOrganizationChart')}
      description={t('OrgImportGuideModal.buildTheDepartmentStructureInBulk')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('OrgImportGuideModal.close')}</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> {t('OrgImportGuideModal.chooseFileImport')}</Button>}
        />
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-eyebrow mb-3">{t('OrgImportGuideModal.steps')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS().map((step) => (
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
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('OrgImportGuideModal.recommendedFormat')}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}>
              <Download aria-hidden="true" /> {t('OrgImportGuideModal.downloadXlsxTemplate')}
            </Button>
          </div>

          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">{t('OrgImportGuideModal.csvTemplate')}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('OrgImportGuideModal.simpleAndLightweight')}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}>
              <Download aria-hidden="true" /> {t('OrgImportGuideModal.downloadCsvTemplate')}
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-eyebrow mb-3">{t('OrgImportGuideModal.columnDescriptions')}</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-2.5 text-eyebrow">{t('OrgImportGuideModal.theColumn')}</th>
                  <th className="px-4 py-2.5 text-eyebrow">{t('OrgImportGuideModal.required')}</th>
                  <th className="px-4 py-2.5 text-eyebrow">{t('OrgImportGuideModal.example')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {COLUMNS().map((col) => (
                  <tr key={col.name} className="hover:bg-[var(--color-muted)]">
                    <td className="px-4 py-3">
                      <code className="text-xs font-medium text-[var(--color-primary)]">{col.name}</code>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {col.required ? (
                        <span className="inline-flex items-center gap-1 text-[var(--color-error)] font-semibold">
                          <AlertTriangle size={12} /> {t('OrgImportGuideModal.yes2')}
                        </span>
                      ) : (
                        <span className="text-[var(--color-subtle-foreground)]">{t('OrgImportGuideModal.no2')}</span>
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
                {t('OrgImportGuideModal.theColumn')} <code>Code</code> {t('OrgImportGuideModal.ofUnitsMustBeUniqueIf')}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
              <Info size={16} className="text-[var(--color-info)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-info)] leading-relaxed">
                {t('OrgImportGuideModal.theColumn')} <code>ParentCode</code> {t('OrgImportGuideModal.isVeryImportantForTheSystem')}
              </p>
            </div>
      </div>
    </Dialog>
  )
}
