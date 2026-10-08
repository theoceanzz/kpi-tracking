import { LocaleNumberInput } from '@/components/ui/number-input'
import { intlLocale } from '@/i18n/format'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, AlertTriangle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/common/DateTimePicker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { kpiCycleApi } from '@/features/kpi/api/kpiCycleApi'
import { kpiPeriodApi } from '@/features/kpi/api/kpiPeriodApi'
import { useAuthStore } from '@/store/authStore'
import EmployeePicker from './EmployeePicker'
import { useRewardBudgets } from '../hooks/useRewards'
import { budgetSchema, type BudgetFormData, type ScopeMode } from '../schemas/budgetSchema'
import { numOrUndefined } from '../schemas/giftSchema'
import type { RewardBudget } from '../types'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useCreatePeriodCycleOption } from '@/components/common/CreatePeriodCycleOption'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  editBudget?: RewardBudget | null
}

export default function BudgetFormModal({ open, onClose, editBudget }: BudgetFormModalProps) {
  const { t } = useTranslation('rewards')
  const createCycle = useCreatePeriodCycleOption('cycle')
  const createPeriod = useCreatePeriodCycleOption('period')
  const isEdit = !!editBudget

  const formApi = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema()),
    defaultValues: {
      grantorUserId: '', grantorLabel: '', scopeMode: 'CYCLE', kpiCycleId: '', kpiPeriodId: '',
      periodStart: '', periodEnd: '', allocatedPoints: undefined, maxPerAward: undefined, note: '',
    },
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `reward-budget:${editBudget?.id ?? 'new'}`, enabled: open })

  // Người được cấp, cách khoanh thời gian và hai ô ngày không phải ô nhập thường
  // (picker / thẻ bấm) nên đọc bằng watch và ghi bằng setValue.
  const grantorUserId = watch('grantorUserId')
  const grantorLabel = watch('grantorLabel')
  const scopeMode = watch('scopeMode')
  const kpiCycleId = watch('kpiCycleId')
  const kpiPeriodId = watch('kpiPeriodId')
  const periodStart = watch('periodStart')
  const periodEnd = watch('periodEnd')

  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { createBudget, updateBudget, isCreating, isUpdating } = useRewardBudgets()

  const { data: cycles } = useQuery({
    queryKey: ['kpiCycles', 'budgetForm'],
    queryFn: () => kpiCycleApi.getAll({ page: 0, size: 100 }),
    enabled: open,
  })

  // Bắt buộc truyền organizationId như mọi nơi khác đang gọi useKpiPeriods —
  // thiếu nó thì danh sách sẽ lẫn đợt của tổ chức khác.
  const { data: periods } = useQuery({
    queryKey: ['kpiPeriods', 'budgetForm', orgId],
    queryFn: () =>
      kpiPeriodApi.getAll({
        page: 0,
        size: 100,
        sortBy: 'startDate',
        direction: 'desc',
        organizationId: orgId,
      }),
    enabled: open && !!orgId,
  })

  useEffect(() => {
    if (!open) return
    if (editBudget) {
      reset({
        grantorUserId: editBudget.grantorUserId,
        grantorLabel: editBudget.grantorName,
        scopeMode: editBudget.kpiCycleId ? 'CYCLE' : editBudget.kpiPeriodId ? 'PERIOD' : 'DATES',
        kpiCycleId: editBudget.kpiCycleId ?? '',
        kpiPeriodId: editBudget.kpiPeriodId ?? '',
        periodStart: editBudget.periodStart,
        periodEnd: editBudget.periodEnd,
        allocatedPoints: editBudget.allocatedPoints,
        maxPerAward: editBudget.maxPerAward ?? undefined,
        note: editBudget.note ?? '',
      })
    } else {
      reset({
        grantorUserId: '', grantorLabel: '', scopeMode: 'CYCLE', kpiCycleId: '', kpiPeriodId: '',
        periodStart: '', periodEnd: '', allocatedPoints: undefined, maxPerAward: undefined, note: '',
      })
    }
  }, [open, editBudget, reset])

  const onSubmit = async (data: BudgetFormData) => {
    if (blockedByTour()) return
    const payload = {
      grantorUserId: data.grantorUserId,
      // Chỉ gửi ĐÚNG MỘT cách khoanh thời gian. Gửi kèm cái thừa sẽ bị backend từ chối
      // (không rõ nên đồng bộ ngày theo kỳ hay theo đợt khi hai cái lệch nhau).
      kpiCycleId: data.scopeMode === 'CYCLE' ? data.kpiCycleId : null,
      kpiPeriodId: data.scopeMode === 'PERIOD' ? data.kpiPeriodId : null,
      periodStart: data.scopeMode === 'DATES' ? data.periodStart : null,
      periodEnd: data.scopeMode === 'DATES' ? data.periodEnd : null,
      allocatedPoints: data.allocatedPoints,
      maxPerAward: data.maxPerAward ?? null,
      note: data.note,
    }
    if (isEdit && editBudget) {
      await updateBudget({ id: editBudget.id, data: payload })
    } else {
      await createBudget(payload)
    }
    onClose()
  }

  const inputCls =
    'w-full rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'

  return (
    <Dialog {...tourAnchor('budget.form')}
      open={open}
      onClose={onClose}
      size="lg"
      dismissible={!(isCreating || isUpdating)}
      title={isEdit ? t('BudgetFormModal.editRewardBudget') : t('BudgetFormModal.grantRewardBudget')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isCreating || isUpdating}>{t('BudgetFormModal.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('budget.form.submit')} onClick={handleSubmit(onSubmit)} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isEdit ? t('BudgetFormModal.save') : t('BudgetFormModal.grantBudget')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {/* Nói trước những gì bị khoá khi hạn mức đã dùng, thay vì để người dùng sửa
            xong bấm lưu rồi mới nhận lỗi. */}
        {isEdit && (editBudget?.usedPoints ?? 0) > 0 && (
          <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
            <span>
              {t('BudgetFormModal.thisBudgetHasUsed')} <b>{editBudget!.usedPoints.toLocaleString(intlLocale())} {t('BudgetFormModal.points')}</b>{t('BudgetFormModal.youCannotLowerTheTotalBelow')}{' '}
              {editBudget!.usedPoints.toLocaleString(intlLocale())} {t('BudgetFormModal.soTheRemainderBecomes0')}
            </span>
          </div>
        )}

        <div {...tourAnchor('budget.form.recipient')}>
          <label className="text-label mb-1.5 block font-medium">{t('BudgetFormModal.budgetRecipient')}</label>
          {isEdit ? (
            <div className="rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">
              {grantorLabel}
            </div>
          ) : grantorUserId ? (
            <div className="flex items-center justify-between rounded-control bg-[var(--color-muted)] px-3 py-2 text-sm">
              {grantorLabel}
              <Button variant="ghost" size="sm" onClick={() => setValue('grantorUserId', '')}>
                {t('BudgetFormModal.change')}
              </Button>
            </div>
          ) : (
            <EmployeePicker
              selectedIds={[]}
              onPick={(u) => {
                setValue('grantorUserId', u.id, { shouldValidate: true })
                setValue('grantorLabel', u.fullName)
              }}
              enabled={open && !isEdit}
              listClassName="max-h-40"
            />
          )}
          {errors.grantorUserId && (
            <p className="mt-1 text-xs text-[var(--color-error)]">{errors.grantorUserId.message}</p>
          )}
        </div>

        <div {...tourAnchor('budget.form.scope')}>
          <label className="text-label mb-1.5 block font-medium">{t('BudgetFormModal.validityRange')}</label>
          <div className="mb-2 flex flex-wrap gap-2 text-sm">
            {(
              [
                ['CYCLE', t('BudgetFormModal.byCycle')],
                ['PERIOD', t('BudgetFormModal.byPeriod')],
                ['DATES', t('BudgetFormModal.chooseDateRange')],
              ] as [ScopeMode, string][]
            ).map(([mode, label]) => (
              <ChoiceChip selected={scopeMode === mode} variant="solid" className="py-1.5" key={mode} onClick={() => setValue('scopeMode', mode, { shouldValidate: true })}>
                {label}
              </ChoiceChip>
            ))}
          </div>

          {scopeMode === 'CYCLE' && (
            <Select value={kpiCycleId} onValueChange={createCycle.wrap(v => setValue('kpiCycleId', v, { shouldValidate: true }))}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder={t('BudgetFormModal.chooseEvaluationCycle')} />
              </SelectTrigger>
              {/* z-[1100]: SelectContent mặc định z-50, modal này z-[1000] */}
              <SelectContent className="z-[1100]">
                {(cycles?.content ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
                {createCycle.item}
              </SelectContent>
            </Select>
          )}

          {scopeMode === 'PERIOD' && (
            <Select value={kpiPeriodId} onValueChange={createPeriod.wrap(v => setValue('kpiPeriodId', v, { shouldValidate: true }))}>
              <SelectTrigger className={inputCls}>
                <SelectValue placeholder={t('BudgetFormModal.chooseEvaluationPeriod')} />
              </SelectTrigger>
              <SelectContent className="z-[1100]">
                {(periods?.content ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
                {createPeriod.item}
              </SelectContent>
            </Select>
          )}

          {scopeMode === 'DATES' && (
            // DateField: ô nhập kiểu biểu mẫu, luôn hiện dd/MM/yyyy và dùng lịch của
            // hệ điều hành nên không bị modal che. Xem javadoc của component.
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-label mb-1 block text-[var(--color-muted-foreground)]">
                  {t('BudgetFormModal.fromDate')}
                </label>
                <DateField
                  value={periodStart}
                  onChange={v => setValue('periodStart', v, { shouldValidate: true })}
                  placeholder={t('BudgetFormModal.chooseDate')}
                  className={inputCls}
                  max={periodEnd || undefined}
                />
                {errors.periodStart && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors.periodStart.message}</p>
                )}
              </div>
              <div>
                <label className="text-label mb-1 block text-[var(--color-muted-foreground)]">
                  {t('BudgetFormModal.toDate')}
                </label>
                <DateField
                  value={periodEnd}
                  onChange={v => setValue('periodEnd', v, { shouldValidate: true })}
                  placeholder={t('BudgetFormModal.chooseDate')}
                  className={inputCls}
                  min={periodStart || undefined}
                />
                {errors.periodEnd && (
                  <p className="mt-1 text-xs text-[var(--color-error)]">{errors.periodEnd.message}</p>
                )}
              </div>
            </div>
          )}

          {(errors.kpiCycleId || errors.kpiPeriodId) && (
            <p className="mt-1 text-xs text-[var(--color-error)]">
              {errors.kpiCycleId?.message ?? errors.kpiPeriodId?.message}
            </p>
          )}
          <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
            {t('BudgetFormModal.choosingACycleOrPeriodTakes')}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div {...tourAnchor('budget.form.total')}>
            <label className="text-label mb-1.5 block font-medium">{t('BudgetFormModal.totalPointsGranted')}</label>
            <LocaleNumberInput
              type="number"
              min={0}
              {...register('allocatedPoints', { setValueAs: numOrUndefined })}
              className={inputCls}
            />
            {errors.allocatedPoints && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{errors.allocatedPoints.message}</p>
            )}
          </div>
          <div {...tourAnchor('budget.form.max')}>
            <label className="text-label mb-1.5 block font-medium">{t('BudgetFormModal.maxPerPersonTime')}</label>
            <LocaleNumberInput
              type="number"
              min={1}
              placeholder={t('BudgetFormModal.unlimited')}
              {...register('maxPerAward', { setValueAs: numOrUndefined })}
              className={inputCls}
            />
            {errors.maxPerAward && (
              <p className="mt-1 text-xs text-[var(--color-error)]">{errors.maxPerAward.message}</p>
            )}
          </div>
        </div>

        <div {...tourAnchor('budget.form.notes')}>
          <label className="text-label mb-1.5 block font-medium">{t('BudgetFormModal.notes')}</label>
          <input {...register('note')} className={inputCls} />
        </div>
      </div>
    </Dialog>
  )
}
