import { useState } from 'react'
import { X, Download, FileSpreadsheet, AlertTriangle, CheckCircle2, Info, FileText, FileBox, BarChart3, SlidersHorizontal } from 'lucide-react'
import ExcelJS from 'exceljs'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { cn } from '@/lib/utils'
import type { KpiType } from '@/types/kpi'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

// Columns that only apply to quantitative KPIs (dropped for qualitative import).
const QUANTITATIVE_ONLY_COLUMNS = ['TargetValue', 'MinimumValue', 'IsReverseKpi', 'Unit']

interface KpiImportGuideModalProps {
  open: boolean
  onClose: () => void
  onSelectFile: (kpiType: KpiType) => void
}

const SAMPLE_DATA = perLanguage(() => ([
  {
    Name: i18n.t('kpi:KpiImportGuideModal.salesRevenue'),
    Description: i18n.t('kpi:KpiImportGuideModal.totalSalesInTheMonth'),
    Weight: 40,
    TargetValue: 100000000,
    MinimumValue: 80000000,
    IsReverseKpi: false,
    IsBonusKpi: false,
    Deadline: '',
    Unit: 'VND',
    EmployeeCode: 'NV001',
    OrgUnitCode: 'MKT001',
    ObjectiveCode: 'OBJ001',
    KeyResultCode: 'KR001',
    Perspective: 'DOANH_THU',
  },
  {
    Name: i18n.t('kpi:KpiImportGuideModal.productDefectRate'),
    Description: i18n.t('kpi:KpiImportGuideModal.theLowerTheDefectRateThe'),
    Weight: 30,
    TargetValue: 2,
    MinimumValue: 5,
    IsReverseKpi: true,
    IsBonusKpi: false,
    Deadline: '25/10/2026 17:00',
    Unit: '%',
    EmployeeCode: 'NV002, NV003',
    OrgUnitCode: 'KD002',
    ObjectiveCode: '',
    KeyResultCode: '',
    Perspective: 'INTERNAL_PROCESS',
  },
  {
    Name: i18n.t('kpi:KpiImportGuideModal.processImprovementInitiatives'),
    Description: i18n.t('kpi:KpiImportGuideModal.optionalKpiNotCountedTowardThe'),
    Weight: 10,
    TargetValue: 1,
    MinimumValue: 1,
    IsReverseKpi: false,
    IsBonusKpi: true,
    Deadline: '',
    Unit: i18n.t('kpi:KpiImportGuideModal.initiatives'),
    EmployeeCode: 'NV001',
    OrgUnitCode: 'MKT001',
    ObjectiveCode: '',
    KeyResultCode: '',
    Perspective: 'LEARNING_GROWTH',
  }
]))

const BASE_COLUMNS = perLanguage(() => ([
  { name: 'Name', required: true, desc: i18n.t('kpi:KpiImportGuideModal.kpiName'), example: i18n.t('kpi:KpiImportGuideModal.octoberSales') },
  { name: 'Description', required: false, desc: i18n.t('kpi:KpiImportGuideModal.detailedDescription'), example: i18n.t('kpi:KpiImportGuideModal.calculatedOnContractValue') },
  { name: 'Weight', required: true, desc: i18n.t('kpi:KpiImportGuideModal.weightEG30For30'), example: '30' },
  { name: 'TargetValue', required: true, desc: i18n.t('kpi:KpiImportGuideModal.targetValueToReach'), example: '500000000' },
  { name: 'MinimumValue', required: false, desc: i18n.t('kpi:KpiImportGuideModal.minimumValue'), example: '400000000' },
  { name: 'IsReverseKpi', required: false, desc: i18n.t('kpi:KpiImportGuideModal.inverseKpiTheLowerTheValue'), example: 'true' },
  { name: 'IsBonusKpi', required: false, desc: i18n.t('kpi:KpiImportGuideModal.bonusKpiOptionalNotCountedToward'), example: 'true' },
  { name: 'Deadline', required: false, desc: i18n.t('kpi:KpiImportGuideModal.ownDeadlineForThisKpiEarlier'), example: '25/10/2026 17:00' },
  { name: 'Unit', required: true, desc: i18n.t('kpi:KpiImportGuideModal.unitOfMeasure'), example: 'VND' },
  { name: 'Frequency', required: false, desc: i18n.t('kpi:KpiImportGuideModal.frequencyChooseQuicklyInThePreview'), example: 'MONTHLY' },
  { name: 'EmployeeCode', required: false, desc: i18n.t('kpi:KpiImportGuideModal.employeeCodeChooseEnterInThe'), example: 'NV001' },
  { name: 'Period', required: false, desc: i18n.t('kpi:KpiImportGuideModal.kpiPeriodChooseQuicklyInThe'), example: i18n.t('kpi:KpiImportGuideModal.october2026') },
  { name: 'OrgUnitCode', required: false, desc: i18n.t('kpi:KpiImportGuideModal.unitCodeTheSystemFindsThe'), example: 'MKT01' },
]))

const STEPS = perLanguage(() => ([
  { num: '01', title: i18n.t('kpi:KpiImportGuideModal.downloadSampleFile'), desc: i18n.t('kpi:KpiImportGuideModal.clickTheButtonBelowToDownload') },
  { num: '02', title: i18n.t('kpi:KpiImportGuideModal.fillInTheInformation'), desc: i18n.t('kpi:KpiImportGuideModal.openTheFileInExcelFill') },
  { num: '03', title: i18n.t('kpi:KpiImportGuideModal.saveUpload'), desc: i18n.t('kpi:KpiImportGuideModal.saveTheFileAsCsvOr') },
]))



export default function KpiImportGuideModal({ open, onClose, onSelectFile }: KpiImportGuideModalProps) {
  const { t } = useTranslation('kpi')
  const { user } = useAuthStore()
  const { data: org } = useOrganization(user?.memberships?.[0]?.organizationId)
  const enableOkr = org?.enableOkr || false
  const enableQualitative = org?.enableQualitative || false
  const enableBsc = org?.enableBsc || false

  const [importType, setImportType] = useState<KpiType>('QUANTITATIVE')
  const isQualitative = enableQualitative && importType === 'QUALITATIVE'

  const COLUMNS = [
    ...BASE_COLUMNS().filter(c => !isQualitative || !QUANTITATIVE_ONLY_COLUMNS.includes(c.name)),
    ...(enableOkr ? [
      { name: 'ObjectiveCode', required: false, desc: t('KpiImportGuideModal.objectiveCodeOkr'), example: 'OBJ001' },
      { name: 'KeyResultCode', required: false, desc: t('KpiImportGuideModal.krCodeOkr'), example: 'KR001' },
    ] : []),
    ...(enableBsc ? [
      { name: 'Perspective', required: false, desc: t('KpiImportGuideModal.bscItemEnterTheItemCode'), example: 'DOANH_THU' },
    ] : [])
  ]

  const getSampleData = () => {
    return SAMPLE_DATA().map(row => {
      const newRow: Record<string, any> = { ...row }
      if (!enableOkr) {
        delete newRow.ObjectiveCode
        delete newRow.KeyResultCode
      }
      if (!enableBsc) {
        delete newRow.Perspective
      }
      if (isQualitative) {
        QUANTITATIVE_ONLY_COLUMNS.forEach(k => delete newRow[k])
      }
      return newRow
    })
  }

  function downloadCsvTemplate() {
    const data = getSampleData()
    if (data.length === 0) return
    const headers = Object.keys(data[0] || {}).join(',')
    const rows = data.map(row => 
      Object.values(row).map(val => `"${val}"`).join(',')
    ).join('\n')
    const content = headers + '\n' + rows
    const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_chi_tieu_kpi.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function downloadXlsxTemplate() {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('KPI Template')

    const baseColumns = [
      { header: 'Name', key: 'Name', width: 30 },
      { header: 'Description', key: 'Description', width: 40 },
      { header: 'Weight', key: 'Weight', width: 12 },
      { header: 'TargetValue', key: 'TargetValue', width: 18 },
      { header: 'MinimumValue', key: 'MinimumValue', width: 18 },
      { header: 'IsReverseKpi', key: 'IsReverseKpi', width: 15 },
      { header: 'IsBonusKpi', key: 'IsBonusKpi', width: 15 },
      { header: 'Deadline', key: 'Deadline', width: 18 },
      { header: 'Unit', key: 'Unit', width: 12 },
      { header: 'EmployeeCode', key: 'EmployeeCode', width: 25 },
      { header: 'OrgUnitCode', key: 'OrgUnitCode', width: 15 },
    ].filter(c => !isQualitative || !QUANTITATIVE_ONLY_COLUMNS.includes(c.key))

    worksheet.columns = [
      ...baseColumns,
      ...(enableOkr ? [
        { header: 'ObjectiveCode', key: 'ObjectiveCode', width: 20 },
        { header: 'KeyResultCode', key: 'KeyResultCode', width: 20 },
      ] : []),
      ...(enableBsc ? [
        { header: 'Perspective', key: 'Perspective', width: 20 },
      ] : []),
    ]

    worksheet.addRows(getSampleData())

    const headerRow = worksheet.getRow(1)
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
    })
    headerRow.height = 25

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell) => {
          cell.font = { name: 'Arial', size: 10 }
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          }
        })
      }
    })

    const guideSheet = workbook.addWorksheet(t('KpiImportGuideModal.detailedGuide'))
    guideSheet.columns = [
      { header: t('KpiImportGuideModal.columnName'), key: 'name', width: 20 },
      { header: t('KpiImportGuideModal.required'), key: 'req', width: 15 },
      { header: t('KpiImportGuideModal.description'), key: 'desc', width: 50 },
      { header: t('KpiImportGuideModal.example'), key: 'ex', width: 25 },
    ]
    const guideHeader = guideSheet.getRow(1)
    guideHeader.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
    guideHeader.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    guideHeader.alignment = { vertical: 'middle', horizontal: 'center' }
    guideHeader.height = 30

    COLUMNS.forEach(c => {
      const row = guideSheet.addRow([c.name, c.required ? t('KpiImportGuideModal.yes') : t('KpiImportGuideModal.no'), c.desc, c.example])
      row.font = { size: 11 }
      row.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
      })
    })

    guideSheet.addRow([])
    const noteTitleRow = guideSheet.addRow([t('KpiImportGuideModal.generalNotesForExcelCsvImport')])
    noteTitleRow.font = { bold: true, size: 12, color: { argb: 'FFDC2626' } }
    guideSheet.addRow([t('KpiImportGuideModal.n1ThisSampleFileSupportsImporting')])
    guideSheet.addRow([t('KpiImportGuideModal.n2IfImportingViaCsvPlease')])
    guideSheet.addRow([t('KpiImportGuideModal.n3EmployeecodeEmployeeCodeOptionalYou')])
    guideSheet.addRow([t('KpiImportGuideModal.n4WeightANumberFrom1')])
    guideSheet.addRow([t('KpiImportGuideModal.n5OrgunitcodeDepartmentCodeTheSystem')])
    guideSheet.addRow([t('KpiImportGuideModal.n6IsreversekpiMarksAnInverseKpi')])
    guideSheet.addRow([t('KpiImportGuideModal.n7IsbonuskpiMarksABonusKpi')])
    guideSheet.addRow([t('KpiImportGuideModal.n8DeadlineOwnDeadlineForThis')])
    guideSheet.addRow([t('KpiImportGuideModal.n9PerspectiveBscItemOnlyItems')])

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mau_import_chi_tieu_kpi.xlsx'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!open) return null

  return (
    <div className="fixed inset-x-0 top-0 h-screen z-[200] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[var(--color-card)] rounded-card border border-[var(--color-border)] animate-in fade-in zoom-in-95 duration-300">
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[var(--color-card)] border-b border-[var(--color-border)] px-4 sm:px-8 py-6 flex items-center justify-between rounded-t-card">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-card bg-[var(--color-primary-soft)] flex items-center justify-center">
              <FileSpreadsheet size={24} className="text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-section-title">{t('KpiImportGuideModal.bulkKpiImport')}</h2>
              <p className="text-sm font-medium text-[var(--color-muted-foreground)]">{t('KpiImportGuideModal.assignKpisToPeopleViaExcel')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-card hover:bg-[var(--color-muted)] text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 sm:px-8 py-6 space-y-8">

          {/* KPI type tabs (only when qualitative enabled) */}
          {enableQualitative && (
            <div className="grid grid-cols-2 gap-2 p-1 rounded-card bg-[var(--color-muted)]">
              <ChoiceChip selected={!isQualitative} variant="solid" className="py-2.5" onClick={() => setImportType('QUANTITATIVE')}>
                <BarChart3 /> {t('KpiImportGuideModal.quantitativeKpis')}
              </ChoiceChip>
              <button
                type="button"
                onClick={() => setImportType('QUALITATIVE')}
                className={cn(
                  "flex items-center justify-center gap-2 py-2.5 rounded-card text-sm font-medium transition-all",
                  isQualitative ? "bg-[var(--color-success-solid)] text-white" : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-card)]"
                )}
              >
                <SlidersHorizontal size={14} /> {t('KpiImportGuideModal.qualitativeKpis')}
              </button>
            </div>
          )}

          {isQualitative && (
            <div className="p-4 rounded-card bg-[var(--color-success-bg)] border border-[var(--color-success-border)] flex items-start gap-3">
              <Info size={18} className="text-[var(--color-success)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-success)] leading-relaxed font-medium">
                {t('KpiImportGuideModal.qualitativeSampleFile')} <strong>{t('KpiImportGuideModal.hasNo')}</strong> {t('KpiImportGuideModal.targetMinimumUnitInverseKpiColumns')}
              </p>
            </div>
          )}

          {/* Steps */}
          <div>
            <h3 className="text-eyebrow mb-3">{t('KpiImportGuideModal.process')}</h3>
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
          <div className="p-6 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <Download size={20} className="text-[var(--color-primary)] shrink-0" />
              <div>
                <p className="font-semibold text-sm text-[var(--color-foreground)]">{t('KpiImportGuideModal.downloadTheSampleImportFile')}</p>
                <p className="text-xs text-[var(--color-muted-foreground)] font-medium mt-0.5">{t('KpiImportGuideModal.chooseTheFormatThatSuitsYour')}</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button className="group" onClick={downloadXlsxTemplate}>
                    <FileBox aria-hidden="true" className="group-hover:rotate-12 transition-transform" /> {t('KpiImportGuideModal.downloadXlsxTemplateExcel')}
                </Button>
                <Button className="group" onClick={downloadCsvTemplate}>
                    <FileText aria-hidden="true" className="group-hover:rotate-12 transition-transform" /> {t('KpiImportGuideModal.downloadCsvTemplateText')}
                </Button>
            </div>
          </div>

          {/* Column Specification */}
          <div>
            <h3 className="text-eyebrow mb-3">{t('KpiImportGuideModal.columnList')}</h3>
            <div className="rounded-card border border-[var(--color-border)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-[var(--color-muted)] border-b border-[var(--color-border)]">
                      <th className="px-3 py-3 text-sm font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">{t('KpiImportGuideModal.columnName')}</th>
                      <th className="px-3 py-3 text-sm font-medium text-[var(--color-muted-foreground)] whitespace-nowrap">{t('KpiImportGuideModal.required')}</th>
                      <th className="px-3 py-3 text-sm font-medium text-[var(--color-muted-foreground)]">{t('KpiImportGuideModal.description')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {COLUMNS.map((col) => (
                      <tr key={col.name} className="hover:bg-[var(--color-muted)] transition-colors">
                        <td className="px-3 py-3 align-top">
                          <code className="px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-xs font-medium text-[var(--color-primary)] whitespace-nowrap">{col.name}</code>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {col.required ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-error)] whitespace-nowrap">
                              <AlertTriangle size={12} /> {t('KpiImportGuideModal.yes2')}
                            </span>
                          ) : (
                            <span className="text-caption whitespace-nowrap">{t('KpiImportGuideModal.no2')}</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <p className="text-xs text-[var(--color-foreground)] font-semibold">{col.desc}</p>
                          <p className="text-caption mt-1 font-mono">{t('KpiImportGuideModal.example2')} {col.example}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Important Notes */}
          <div className="space-y-4">
            <h3 className="text-eyebrow">{t('KpiImportGuideModal.notesWhenEnteringData')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-4 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
                <Info size={18} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-warning)] leading-relaxed font-medium">
                  <strong>EmployeeCode</strong> {t('KpiImportGuideModal.mustBeExactAndTheEmployee')}
                </p>
              </div>
              <div className="flex items-start gap-3 p-4 rounded-card bg-[var(--color-info-bg)] border border-[var(--color-info-border)]">
                <CheckCircle2 size={18} className="text-[var(--color-info)] shrink-0 mt-0.5" />
                <p className="text-xs text-[var(--color-info)] leading-relaxed font-medium">
                  {t('KpiImportGuideModal.weightIsAnIntegerFrom1')}
                </p>
              </div>
              {enableBsc && (
                <div className="flex items-start gap-3 p-4 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)] md:col-span-2">
                  <Info size={18} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
                  <p className="text-xs text-[var(--color-primary)] leading-relaxed font-medium">
                    <strong>{t('KpiImportGuideModal.bscItemPerspective')}</strong> {t('KpiImportGuideModal.onlyItems')} <strong>{t('KpiImportGuideModal.inTheScorecardOfTheUnit')}</strong> {t('KpiImportGuideModal.ofThatRowCanBeChosen')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[var(--color-card)] border-t border-[var(--color-border)] px-4 sm:px-8 py-5 flex items-center justify-end gap-3 rounded-b-card">
          <Button variant="outline" onClick={onClose}>
            {t('KpiImportGuideModal.cancel')}
          </Button>
          <Button onClick={() => { onSelectFile(isQualitative ? 'QUALITATIVE' : 'QUANTITATIVE'); onClose() }}>
            <FileSpreadsheet aria-hidden="true" /> {t('KpiImportGuideModal.chooseFileImport')}
          </Button>
        </div>
      </div>
    </div>
  )
}
