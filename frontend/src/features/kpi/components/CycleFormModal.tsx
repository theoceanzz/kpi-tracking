import { useState } from 'react'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { FREQUENCY_MAP } from '@/lib/utils'
import { toast } from 'sonner'
import { CYCLE_TYPES, cycleStandardEnd as computeStandardEndDate } from '../utils/standardDuration'
import type { KpiCycle, KpiFrequency, CycleEvaluationMode } from '@/types/kpi'
import { useTranslation } from 'react-i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

interface CycleFormModalProps {
  onClose: () => void
  editCycle: KpiCycle | null
  organizationId: string
  onSubmit: (payload: Record<string, unknown>) => Promise<void>
  isSubmitting: boolean
  /**
   * `modal` (mặc định) giữ nguyên lớp phủ + tiêu đề + nút Huỷ như trang quản lý đang dùng.
   * `inline` bỏ hết phần khung đó để nhúng thẳng vào một bước của trình thiết lập, nơi tiêu đề
   * và nút điều hướng đã do khung wizard lo.
   */
  variant?: 'modal' | 'inline'
  /** Nhãn nút xác nhận. Trong wizard thường là "Tạo kỳ & tiếp tục". */
  submitLabel?: string
}

/**
 * Form tạo/sửa kỳ đánh giá.
 *
 * Trước đây nằm private trong `KpiCyclesPage`. Tách ra file riêng để trình thiết lập dùng lại
 * được đúng bộ trường này — chép sang một bản thứ hai là chấp nhận hai bản luật ngày tháng sẽ
 * lệch nhau theo thời gian.
 *
 * Mutation vẫn do component cha giữ qua `onSubmit`, nên cùng một form phục vụ được cả trang quản
 * lý (tạo xong đóng modal) lẫn wizard (tạo xong sang bước sau).
 */
export default function CycleFormModal({
  onClose,
  editCycle,
  organizationId,
  onSubmit,
  isSubmitting,
  variant = 'modal',
  submitLabel,
}: CycleFormModalProps) {
  const { t } = useTranslation('kpi')
  const isInline = variant === 'inline'

  const [formData, setFormData] = useState(() => {
    const start = editCycle?.startDate ? format(parseISO(editCycle.startDate), "yyyy-MM-dd'T'HH:mm") : format(new Date(), "yyyy-MM-dd'T'07:00")
    const type = (editCycle?.cycleType as KpiFrequency) || 'SEMI_ANNUALLY'
    const end = editCycle?.endDate
      ? format(parseISO(editCycle.endDate), "yyyy-MM-dd'T'HH:mm")
      : format(computeStandardEndDate(new Date(start), type), "yyyy-MM-dd'T'HH:mm")
    return { name: editCycle?.name || '', cycleType: type, startDate: start, endDate: end, description: editCycle?.description || '', evaluationMode: (editCycle?.evaluationMode as CycleEvaluationMode) || 'BOTH' }
  })
  const [showMismatchConfirm, setShowMismatchConfirm] = useState(false)
  const draft = useStateDraft(formData, setFormData, { key: `kpi-cycle:${editCycle?.id ?? 'new'}`, enabled: true })

  // Không bật KPI định tính ⇒ chỉ được đánh giá theo Định lượng.
  //
  // Ép ngay trong lúc render theo mẫu "chỉnh state khi nguồn đổi" của React, thay vì useEffect:
  // cờ enableQualitative tới sau một nhịp (chờ query tổ chức), và effect sẽ để lọt đúng một lượt
  // render với giá trị sai trước khi sửa lại.
  const { data: org } = useOrganization(organizationId)
  const enableQualitative = org?.enableQualitative ?? false
  if (!enableQualitative && formData.evaluationMode !== 'QUANTITATIVE') {
    setFormData(p => ({ ...p, evaluationMode: 'QUANTITATIVE' }))
  }

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'startDate' || field === 'cycleType') {
        const start = field === 'startDate' ? value : prev.startDate
        const type = field === 'cycleType' ? value as KpiFrequency : prev.cycleType
        const startObj = new Date(start)
        next.endDate = format(computeStandardEndDate(startObj, type), "yyyy-MM-dd'T'HH:mm")
        if (!next.name || next.name.startsWith('Tháng') || next.name.startsWith('Quý') || next.name.startsWith('6 Tháng') || next.name.startsWith('Năm')) {
          if (type === 'MONTHLY') next.name = t('CycleFormModal.month', { startObj: format(startObj, 'MM/yyyy') })
          else if (type === 'QUARTERLY') next.name = t('CycleFormModal.q', { value: Math.floor(startObj.getMonth() / 3) + 1, startObj: format(startObj, 'yyyy') })
          else if (type === 'SEMI_ANNUALLY') next.name = t('CycleFormModal.h', { value: Math.floor(startObj.getMonth() / 6) + 1, startObj: format(startObj, 'yyyy') })
          else if (type === 'YEARLY') next.name = t('CycleFormModal.year', { startObj: format(startObj, 'yyyy') })
        }
      }
      return next
    })
  }

  const submitForm = async () => {
    await onSubmit({
      name: formData.name,
      cycleType: formData.cycleType,
      startDate: new Date(formData.startDate).toISOString(),
      endDate: new Date(formData.endDate).toISOString(),
      description: formData.description || null,
      evaluationMode: formData.evaluationMode,
      organizationId,
    })
    // Trong wizard, bước sau tự điều hướng nên không có gì để đóng.
    if (!isInline) onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const start = new Date(formData.startDate).getTime()
    const end = new Date(formData.endDate).getTime()
    if (end <= start) {
      toast.error(t('CycleFormModal.theEndTimeMustBeAfter'))
      return
    }
    const standardEnd = computeStandardEndDate(new Date(formData.startDate), formData.cycleType).getTime()
    if (Math.abs(end - standardEnd) > 60 * 1000) {
      setShowMismatchConfirm(true)
      return
    }
    await submitForm()
  }

  const selectedDays = formData.startDate && formData.endDate
    ? differenceInCalendarDays(new Date(formData.endDate), new Date(formData.startDate)) + 1 : 0
  const standardDays = formData.startDate
    ? differenceInCalendarDays(computeStandardEndDate(new Date(formData.startDate), formData.cycleType), new Date(formData.startDate)) + 1 : 0
  const mismatchDescription = t('CycleFormModal.youChoseDaysWhileTheStandard', { selectedDays, value: FREQUENCY_MAP()[formData.cycleType], standardDays })

  const fields = (
    <form id="cycle-form" onSubmit={handleSubmit} className="space-y-5">
      <DraftNotice draft={draft} />
      <div className="space-y-2">
        <label className="text-label">{t('CycleFormModal.cycleName')} <span className="text-[var(--color-error)]">*</span></label>
        <input value={formData.name} onChange={e => handleFieldChange('name', e.target.value)} required placeholder={t('CycleFormModal.eGFirstHalfOf2026')}
          className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none text-sm font-medium transition-all placeholder:text-[var(--color-subtle-foreground)]"/>
      </div>

      <div className="space-y-2">
        <label className="text-label">{t('CycleFormModal.cycleType')} <span className="text-[var(--color-error)]">*</span></label>
        <Select value={formData.cycleType} onValueChange={val => handleFieldChange('cycleType', val)}>
          <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-success-solid)]">
            <SelectValue placeholder={t('CycleFormModal.chooseCycleType')} />
          </SelectTrigger>
          <SelectContent className="rounded-card border-[var(--color-border)] p-2">
            {CYCLE_TYPES.map(type => (
              <SelectItem key={type} value={type} className="rounded-card text-sm font-medium">{FREQUENCY_MAP()[type]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-label">{t('CycleFormModal.endOfCycleEvaluationMode')}</label>
        <Select
          value={formData.evaluationMode}
          onValueChange={val => setFormData(p => ({ ...p, evaluationMode: val as CycleEvaluationMode }))}
          disabled={!enableQualitative}
        >
          <SelectTrigger className="w-full px-5 h-[56px] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium shadow-sm focus:ring-4 focus:ring-[var(--color-success-solid)] disabled:opacity-70">
            <SelectValue placeholder={t('CycleFormModal.chooseEvaluationMode')} />
          </SelectTrigger>
          <SelectContent className="rounded-card border-[var(--color-border)] p-2">
            <SelectItem value="QUANTITATIVE" className="rounded-card text-sm font-medium">{t('CycleFormModal.quantitative')}</SelectItem>
            {enableQualitative && <SelectItem value="QUALITATIVE" className="rounded-card text-sm font-medium">{t('CycleFormModal.qualitative')}</SelectItem>}
            {enableQualitative && <SelectItem value="BOTH" className="rounded-card text-sm font-medium">{t('CycleFormModal.both')}</SelectItem>}
          </SelectContent>
        </Select>
        {!enableQualitative && (
          <p className="text-caption font-medium ml-1">
            {t('CycleFormModal.theOrganizationHasNotEnabledQualitative')} <span className="font-semibold text-[var(--color-muted-foreground)]">{t('CycleFormModal.quantitative')}</span>.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-label">{t('CycleFormModal.start')} <span className="text-[var(--color-error)]">*</span></label>
          <DateTimePicker value={formData.startDate} onChange={val => handleFieldChange('startDate', val)} />
        </div>
        <div className="space-y-2">
          <label className="text-label">{t('CycleFormModal.end')} <span className="text-[var(--color-error)]">*</span></label>
          <DateTimePicker value={formData.endDate} onChange={val => handleFieldChange('endDate', val)} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-label">{t('CycleFormModal.description')}</label>
        <textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={2} placeholder={t('CycleFormModal.overallGoalOfTheCycle')}
          className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none text-sm font-medium transition-all placeholder:text-[var(--color-subtle-foreground)] resize-none"/>
      </div>

      {isInline && (
        <div className="pt-2">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? t('CycleFormModal.saving') : (submitLabel ?? t('CycleFormModal.confirm'))}
          </Button>
        </div>
      )}
    </form>
  )

  const mismatchDialog = (
    <ConfirmDialog
      open={showMismatchConfirm}
      title={t('CycleFormModal.areYouSure')}
      description={mismatchDescription}
      confirmLabel={t('CycleFormModal.saveThisCycleAnyway')}
      onConfirm={async () => { setShowMismatchConfirm(false); await submitForm() }}
      onClose={() => setShowMismatchConfirm(false)}
      loading={isSubmitting}
    />
  )

  if (isInline) {
    return (
      <>
        {fields}
        {mismatchDialog}
      </>
    )
  }

  return (
    <>
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isSubmitting}
      title={editCycle ? t('CycleFormModal.editCycle') : t('CycleFormModal.createANewCycle')}
      description={t('CycleFormModal.configureTheCombinedEvaluationCycle')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSubmitting}>{t('CycleFormModal.cancel')}</Button>}
          primary={
            <Button type="submit" form="cycle-form" disabled={isSubmitting}>
              {isSubmitting ? t('CycleFormModal.saving') : (submitLabel ?? t('CycleFormModal.confirm'))}
            </Button>
          }
        />
      }
    >
      {fields}
    </Dialog>

      {mismatchDialog}
    </>
  )
}
