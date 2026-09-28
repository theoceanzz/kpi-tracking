import { Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBarChart } from 'lucide-react'
import ExcelJS from 'exceljs'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface ImportScorecardGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: () => void
}

const SAMPLE_CSV_CONTENT = perLanguage(() => (i18n.t('bsc:ImportScorecardGuideModal.periodScorecardnameVisionOrgunitsPerspectivecode')))

const COLUMNS = perLanguage(() => ([
  { name: 'Period', required: true, desc: i18n.t('bsc:ImportScorecardGuideModal.kpiCycleNameUsedToFind'), example: i18n.t('bsc:ImportScorecardGuideModal.q32026') },
  { name: 'ScorecardName', required: true, desc: i18n.t('bsc:ImportScorecardGuideModal.scorecardNameWrittenOnTheFirst'), example: i18n.t('bsc:ImportScorecardGuideModal.q3Strategy') },
  { name: 'Vision', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.strategyStatement'), example: i18n.t('bsc:ImportScorecardGuideModal.leadMarketShare') },
  { name: 'OrgUnits', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.codesOfTheApplicableDepartmentsSeveral'), example: 'IT, MKT' },
  { name: 'PerspectiveCode', required: true, desc: i18n.t('bsc:ImportScorecardGuideModal.itemCodeIfItDoesNot'), example: 'DOANH_THU' },
  { name: 'PerspectiveName', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.itemNameRequiredIfTheCode'), example: i18n.t('bsc:ImportScorecardGuideModal.netRevenue') },
  { name: 'FixedPerspective', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.bscAreaFinancialCustomerInternalProcess'), example: 'FINANCIAL' },
  { name: 'Unit', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.itemUnitOfMeasure'), example: i18n.t('bsc:ImportScorecardGuideModal.billion') },
  { name: 'TargetValue', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.desiredTargetOfTheItem'), example: '100' },
  { name: 'MinimumValue', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.minimumResultOfTheItem'), example: '80' },
  { name: 'Weight', required: true, desc: i18n.t('bsc:ImportScorecardGuideModal.itemWeightTotalPerCycle100'), example: '40' },
  { name: 'Status', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.draftActiveArchivedDefaultDraft'), example: 'ACTIVE' },
  { name: 'ScoringMode', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.shadowOfficialDefaultShadow'), example: 'SHADOW' },
  { name: 'EmptyPolicy', required: false, desc: i18n.t('bsc:ImportScorecardGuideModal.renormalizeZeroFillDefaultRenormalize'), example: 'RENORMALIZE' },
]))

async function downloadTemplate(type: 'csv' | 'xlsx') {
  if (type === 'csv') {
    const blob = new Blob(['﻿' + SAMPLE_CSV_CONTENT()], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'mau_import_the_diem_bsc.csv'; a.click()
    URL.revokeObjectURL(url)
    return
  }
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(i18n.t('bsc:ImportScorecardGuideModal.bscScorecard'))
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
    [i18n.t('bsc:ImportScorecardGuideModal.q32026'), i18n.t('bsc:ImportScorecardGuideModal.q3Strategy'), i18n.t('bsc:ImportScorecardGuideModal.leadRegionalMarketShare'), '', 'DOANH_THU', i18n.t('bsc:ImportScorecardGuideModal.netRevenue'), 'FINANCIAL', i18n.t('bsc:ImportScorecardGuideModal.billion'), 40, 'ACTIVE', 'SHADOW', 'RENORMALIZE'],
    [i18n.t('bsc:ImportScorecardGuideModal.q32026'), '', '', '', 'HAI_LONG_KH', i18n.t('bsc:ImportScorecardGuideModal.customerSatisfaction'), 'CUSTOMER', '%', 30, '', '', ''],
    [i18n.t('bsc:ImportScorecardGuideModal.q32026'), '', '', '', 'VAN_HANH', i18n.t('bsc:ImportScorecardGuideModal.standardizeOperations'), 'INTERNAL_PROCESS', '%', 20, '', '', ''],
    [i18n.t('bsc:ImportScorecardGuideModal.q32026'), '', '', '', 'DAO_TAO', i18n.t('bsc:ImportScorecardGuideModal.internalTraining'), 'LEARNING_GROWTH', i18n.t('bsc:ImportScorecardGuideModal.hours'), 10, '', '', ''],
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

const STEPS = perLanguage(() => ([
  { num: '01', title: i18n.t('bsc:ImportScorecardGuideModal.downloadSampleFile'), desc: i18n.t('bsc:ImportScorecardGuideModal.downloadASampleFileWithThe') },
  { num: '02', title: i18n.t('bsc:ImportScorecardGuideModal.fillInTheInformation'), desc: i18n.t('bsc:ImportScorecardGuideModal.eachCycleIsAGroupOf') },
  { num: '03', title: i18n.t('bsc:ImportScorecardGuideModal.chooseUnitsImport'), desc: i18n.t('bsc:ImportScorecardGuideModal.chooseAFileThenPickThe') },
]))

export default function ImportScorecardGuideModal({ open, onClose, onSelectFile }: ImportScorecardGuideModalProps) {
  const { t } = useTranslation('bsc')
  if (!open) return null
  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t('ImportScorecardGuideModal.importBscScorecards')}
      description={t('ImportScorecardGuideModal.supportsTheXlsxFormat')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('ImportScorecardGuideModal.close')}</Button>}
          primary={<Button onClick={() => { onSelectFile(); onClose() }}><FileSpreadsheet aria-hidden="true" /> {t('ImportScorecardGuideModal.chooseFileImport')}</Button>}
        />
      }
    >
      <div className="space-y-6">
        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportScorecardGuideModal.n3StepProcess')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {STEPS().map((step) => (
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
              <div><p className="font-medium text-sm text-[var(--color-foreground)]">Template XLSX Pro</p><p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportScorecardGuideModal.recommended')}</p></div>
            </div>
            <Button className="w-full" onClick={() => downloadTemplate('xlsx')}><Download aria-hidden="true" /> {t('ImportScorecardGuideModal.downloadXlsxTemplate')}</Button>
          </div>
          <div className="p-5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] space-y-4 opacity-75 grayscale">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-card bg-[var(--color-border)] flex items-center justify-center text-[var(--color-muted-foreground)]"><FileText size={20} /></div>
              <div><p className="font-medium text-sm text-[var(--color-foreground)]">{t('ImportScorecardGuideModal.basicCsvTemplate')}</p><p className="text-xs text-[var(--color-muted-foreground)]">{t('ImportScorecardGuideModal.viewStructure')}</p></div>
            </div>
            <Button variant="outline" className="w-full" onClick={() => downloadTemplate('csv')}><Download aria-hidden="true" /> {t('ImportScorecardGuideModal.downloadCsvTemplate')}</Button>
          </div>
        </div>

        <div>
          <h3 className="text-eyebrow mb-3">{t('ImportScorecardGuideModal.dataColumnStructure')}</h3>
          <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                    <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportScorecardGuideModal.columnName')}</th>
                    <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportScorecardGuideModal.required')}</th>
                    <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)] hidden sm:table-cell">{t('ImportScorecardGuideModal.description')}</th>
                    <th className="px-4 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('ImportScorecardGuideModal.example')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {COLUMNS().map((col) => (
                    <tr key={col.name} className="hover:bg-[var(--color-muted)]">
                      <td className="px-4 py-3"><code className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-xs font-medium text-[var(--color-foreground)]">{col.name}</code></td>
                      <td className="px-4 py-3">{col.required ? <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)]"><AlertTriangle size={12} /> {t('ImportScorecardGuideModal.yes')}</span> : <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{t('ImportScorecardGuideModal.no')}</span>}</td>
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
          <h3 className="text-eyebrow">{t('ImportScorecardGuideModal.importantNotes')}</h3>
          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Info size={16} className="text-[var(--color-warning)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-warning)] leading-relaxed">{t('ImportScorecardGuideModal.rowsWithTheSame')} <strong>Period</strong> {t('ImportScorecardGuideModal.areGroupedIntoOneScorecard')} <strong>{t('ImportScorecardGuideModal.theTotalWeightOfEachCycle')}</strong>{t('ImportScorecardGuideModal.aCycleThatAlreadyHasA')} <strong>{t('ImportScorecardGuideModal.updated')}</strong>.</p>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={16} className="text-[var(--color-success)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed">{t('ImportScorecardGuideModal.oneFileDoesBothItemCodes')} <strong>{t('ImportScorecardGuideModal.none')}</strong> {t('ImportScorecardGuideModal.areCreatedFromTheColumn')} <strong>PerspectiveName</strong> + <strong>FixedPerspective</strong>{t('ImportScorecardGuideModal.codes')} <strong>{t('ImportScorecardGuideModal.thatAlreadyExist')}</strong> {t('ImportScorecardGuideModal.areOnlyAssignedWeightsApplicableDepartments')} <strong>.xlsx</strong>.</p>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
