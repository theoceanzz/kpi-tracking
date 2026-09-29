import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

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
        i18n.t('okr:ImportOkrGuideModal.obj001GrowRevenue20Q1Revenue'),
        i18n.t('okr:ImportOkrGuideModal.kr002UpsellExistingCustomers1515'),
        i18n.t('okr:ImportOkrGuideModal.obj002ImproveServiceQuality202401'),
        i18n.t('okr:ImportOkrGuideModal.kr004RaiseCsatTo45'),
      ]
    : [
        i18n.t('okr:ImportOkrGuideModal.obj001GrowRevenue20Q1Revenue2'),
        i18n.t('okr:ImportOkrGuideModal.kr002UpsellExistingCustomers15152'),
        i18n.t('okr:ImportOkrGuideModal.obj002ImproveServiceQuality2024012'),
        i18n.t('okr:ImportOkrGuideModal.kr004RaiseCsatTo452'),
      ]
  return [header, ...rows].join('\n')
}

function getColumns(enableBsc: boolean) {
  return [
    { name: 'ObjectiveCode', required: true, desc: i18n.t('okr:ImportOkrGuideModal.objectiveCodeUsedToMatchAnd'), example: 'OBJ001' },
    { name: 'ObjectiveName', required: true, desc: i18n.t('okr:ImportOkrGuideModal.objectiveName'), example: i18n.t('okr:ImportOkrGuideModal.revenueGrowth') },
    { name: 'ObjectiveDescription', required: false, desc: i18n.t('okr:ImportOkrGuideModal.objectiveDescription'), example: i18n.t('okr:ImportOkrGuideModal.q1Objective') },
    { name: 'ObjectiveStartDate', required: false, desc: i18n.t('okr:ImportOkrGuideModal.startDateYyyyMmDd'), example: '2024-01-01' },
    { name: 'ObjectiveEndDate', required: false, desc: i18n.t('okr:ImportOkrGuideModal.endDateYyyyMmDd'), example: '2024-03-31' },
    { name: 'OrgUnitCode', required: true, desc: i18n.t('okr:ImportOkrGuideModal.departmentCodeSeveralCodesSeparatedBy'), example: 'KD_HN, NS_HN' },
    ...(enableBsc ? [
      { name: 'ObjectivePerspective', required: false, desc: i18n.t('okr:ImportOkrGuideModal.bscItemOfTheObjectiveEnter'), example: 'DOANH_THU' },
    ] : []),
    { name: 'KeyResultCode', required: true, desc: i18n.t('okr:ImportOkrGuideModal.keyResultCodeLeaveThisCell'), example: 'KR001' },
    { name: 'KeyResultName', required: true, desc: i18n.t('okr:ImportOkrGuideModal.keyResultName'), example: i18n.t('okr:ImportOkrGuideModal.reach1BillionVnd') },
    { name: 'KeyResultDescription', required: false, desc: i18n.t('okr:ImportOkrGuideModal.krDescription'), example: i18n.t('okr:ImportOkrGuideModal.revenueFromSegmentA') },
    { name: 'KeyResultTarget', required: false, desc: i18n.t('okr:ImportOkrGuideModal.targetNumber'), example: '1000000000' },
    { name: 'KeyResultUnit', required: false, desc: i18n.t('okr:ImportOkrGuideModal.unitOfMeasure'), example: i18n.t('okr:ImportOkrGuideModal.vnd') },
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
  const worksheet = workbook.addWorksheet(i18n.t('okr:ImportOkrGuideModal.okrList'))

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
    ['OBJ001', i18n.t('okr:ImportOkrGuideModal.growRevenue20'), i18n.t('okr:ImportOkrGuideModal.q1RevenueObjective'), '2024-01-01', '2024-03-31', 'KD_HN', 'DOANH_THU', 'KR001', i18n.t('okr:ImportOkrGuideModal.sign10NewLargeContracts'), i18n.t('okr:ImportOkrGuideModal.contractsWorth100m'), 10, i18n.t('okr:ImportOkrGuideModal.contracts')],
    ['', '', '', '', '', '', '', 'KR002', i18n.t('okr:ImportOkrGuideModal.upsellExistingCustomers15'), '', 15, '%'],
    ['OBJ002', i18n.t('okr:ImportOkrGuideModal.improveServiceQuality'), '', '2024-01-01', '2024-06-30', 'NS_HN', 'HAI_LONG_KH', 'KR003', i18n.t('okr:ImportOkrGuideModal.reduceChurnTo5'), '', 5, '%'],
    ['', '', '', '', '', '', '', 'KR004', i18n.t('okr:ImportOkrGuideModal.raiseCsatTo455'), '', 4.5, i18n.t('okr:ImportOkrGuideModal.points')],
  ] : [
    ['OBJ001', i18n.t('okr:ImportOkrGuideModal.growRevenue20'), i18n.t('okr:ImportOkrGuideModal.q1RevenueObjective'), '2024-01-01', '2024-03-31', 'KD_HN', 'KR001', i18n.t('okr:ImportOkrGuideModal.sign10NewLargeContracts'), i18n.t('okr:ImportOkrGuideModal.contractsWorth100m'), 10, i18n.t('okr:ImportOkrGuideModal.contracts')],
    ['', '', '', '', '', '', 'KR002', i18n.t('okr:ImportOkrGuideModal.upsellExistingCustomers15'), '', 15, '%'],
    ['OBJ002', i18n.t('okr:ImportOkrGuideModal.improveServiceQuality'), '', '2024-01-01', '2024-06-30', 'NS_HN', 'KR003', i18n.t('okr:ImportOkrGuideModal.reduceChurnTo5'), '', 5, '%'],
    ['', '', '', '', '', '', 'KR004', i18n.t('okr:ImportOkrGuideModal.raiseCsatTo455'), '', 4.5, i18n.t('okr:ImportOkrGuideModal.points')],
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
  const guideSheet = workbook.addWorksheet(i18n.t('okr:ImportOkrGuideModal.detailedGuide'))
  guideSheet.columns = [
    { header: i18n.t('okr:ImportOkrGuideModal.columnName'), key: 'name', width: 25 },
    { header: i18n.t('okr:ImportOkrGuideModal.required'), key: 'req', width: 15 },
    { header: i18n.t('okr:ImportOkrGuideModal.description'), key: 'desc', width: 50 },
    { header: i18n.t('okr:ImportOkrGuideModal.example'), key: 'ex', width: 25 },
  ]
  const guideHeader = guideSheet.getRow(1)
  guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
  guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
  guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
  guideHeader.height = 30

  getColumns(enableBsc).forEach(c => {
    const row = guideSheet.addRow([c.name, c.required ? i18n.t('okr:ImportOkrGuideModal.yes') : i18n.t('okr:ImportOkrGuideModal.no'), c.desc, c.example])
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
  const noteTitleRow = guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.generalNotesForOkrExcelImport')])
  noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
  guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.n1ThisSampleFileSupportsImporting')])
  guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.n2ToAddSeveralKrsTo')])
  guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.n3TheObjectiveCodeObjectivecodeAnd')])
  guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.n4TheOrgunitcodeColumnSupportsSeveral')])
  if (enableBsc) {
    guideSheet.addRow([i18n.t('okr:ImportOkrGuideModal.n5ObjectiveperspectiveTheBscItemAssigned')])
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

const STEPS = perLanguage(() => ([
  { num: '01', title: i18n.t('okr:ImportOkrGuideModal.downloadSampleFile'), desc: i18n.t('okr:ImportOkrGuideModal.clickTheButtonBelowToDownload') },
  { num: '02', title: i18n.t('okr:ImportOkrGuideModal.fillInTheInformation'), desc: i18n.t('okr:ImportOkrGuideModal.enterObjectivesAndKeyResultsIn') },
  { num: '03', title: i18n.t('okr:ImportOkrGuideModal.saveUpload'), desc: i18n.t('okr:ImportOkrGuideModal.saveTheFileAsXlsxAnd') },
]))



export default function ImportOkrGuideModal({ open, onClose, onSelectFile }: ImportOkrGuideModalProps) {
  const { t } = useTranslation('okr')
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const enableBsc = org?.enableBsc || false
  const COLUMNS = getColumns(enableBsc)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('ImportOkrGuideModal.bulkOkrImport')}
      description={t('ImportOkrGuideModal.supportsTheXlsxFormat')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('ImportOkrGuideModal.close')}</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> {t('ImportOkrGuideModal.chooseFileImport')}</Button>}
        />
      }
    >
      <div className="space-y-6">
        {/* Steps */}
        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportOkrGuideModal.n3StepProcess')}</h3>
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
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportOkrGuideModal.recommendedStandardFormat')}</p>
              </div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx', enableBsc)}>
              <Download aria-hidden="true" /> {t('ImportOkrGuideModal.downloadXlsxTemplate')}
            </Button>
          </div>

          {/* CSV Simple */}
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4 opacity-75 grayscale">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]">
                <FileText size={20} />
              </div>
              <div>
                <p className="font-medium text-sm text-[var(--color-foreground)]">{t('ImportOkrGuideModal.basicCsvTemplate')}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportOkrGuideModal.forViewingTheStructureOnly')}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv', enableBsc)}>
              <Download aria-hidden="true" /> {t('ImportOkrGuideModal.downloadCsvTemplate')}
            </Button>
          </div>
        </div>

        {/* Column Specification */}
        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportOkrGuideModal.dataColumnStructure')}</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportOkrGuideModal.columnName')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportOkrGuideModal.required')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)] hidden sm:table-cell">{t('ImportOkrGuideModal.description')}</th>
                  <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportOkrGuideModal.example')}</th>
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
                          <AlertTriangle size={12} /> {t('ImportOkrGuideModal.yes2')}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('ImportOkrGuideModal.no2')}</span>
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
          <h3 className="text-eyebrow">{t('ImportOkrGuideModal.importantNotes')}</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Info size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)] leading-relaxed">
                {t('ImportOkrGuideModal.the')} <strong>{t('ImportOkrGuideModal.codesCode')}</strong> {t('ImportOkrGuideModal.areUsedByTheSystemTo')}
              </p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">
                {t('ImportOkrGuideModal.theRequiredFormatForImportIs')} <strong>.xlsx</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
