import { LocaleNumberInput } from '@/components/ui/number-input'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, AlertCircle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { KeyResultRequest, KeyResultResponse, ObjectiveResponse, UnitWeight } from '../types'
import { createKeyResultSchema, type KeyResultFormData } from '../schemas/okrSchema'
import { useOkrMutations } from '../hooks/useOkr'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCodeRule } from '@/features/orgunits/hooks/useCodeRules'
import CodeField from '@/components/common/CodeField'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

interface KeyResultFormModalProps {
  isOpen: boolean
  onClose: () => void
  objective: ObjectiveResponse
  keyResult?: KeyResultResponse
}

export default function KeyResultFormModal({ isOpen, onClose, objective, keyResult }: KeyResultFormModalProps) {
  const { t } = useTranslation('okr')
  // Mã KR do tổ chức quyết định: tự sinh (ô mã khoá lại) hay nhập tay như trước.
  const codeRule = useCodeRule('KEY_RESULT')
  const schema = useMemo(() => createKeyResultSchema({ requireCode: !codeRule.optional }), [codeRule.optional])

  const formApi = useForm<KeyResultFormData>({
    resolver: zodResolver(schema),
  })
  const { register, handleSubmit, reset, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `okr-key-result:${keyResult?.id ?? `new:${objective?.id ?? ''}`}`, enabled: isOpen })
  const { createKeyResult, updateKeyResult } = useOkrMutations()

  const hasMultipleUnits = (objective.orgUnitIds?.length ?? 0) > 1
  const [unitWeights, setUnitWeights] = useState<UnitWeight[]>([])
  const [weightError, setWeightError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    reset({
      name: keyResult?.name ?? '',
      code: keyResult?.code ?? '',
      description: keyResult?.description ?? '',
      targetValue: keyResult?.targetValue ?? 0,
      currentValue: keyResult?.currentValue ?? 0,
      unit: keyResult?.unit ?? '',
      objectiveId: objective.id
    })

    if (hasMultipleUnits) {
      if (keyResult?.unitWeights && keyResult.unitWeights.length > 0) {
        setUnitWeights(keyResult.unitWeights.map(w => ({ ...w })))
      } else {
        // initialize with equal distribution
        const count = objective.orgUnitIds!.length
        const base = Math.floor(100 / count)
        const remainder = 100 - base * count
        setUnitWeights(
          objective.orgUnitIds!.map((id, idx) => ({
            orgUnitId: id,
            orgUnitName: objective.orgUnitNames?.[idx] ?? '',
            weightPercentage: idx === 0 ? base + remainder : base
          }))
        )
      }
    } else {
      setUnitWeights([])
    }
    setWeightError(null)
  }, [isOpen, keyResult, objective])

  const updateWeight = (index: number, value: number) => {
    setUnitWeights(prev => prev.map((w, i) => i === index ? { ...w, weightPercentage: value } : w))
    setWeightError(null)
  }

  const totalWeight = unitWeights.reduce((sum, w) => sum + (w.weightPercentage || 0), 0)

  const onSubmit = (data: KeyResultFormData) => {
    if (blockedByTour()) return
    if (hasMultipleUnits) {
      const total = Math.round(totalWeight)
      if (total !== 100) {
        setWeightError(t('KeyResultFormModal.theCurrentTotalIsItMust', { total }))
        return
      }
    }

    const requestData: KeyResultRequest = {
      ...data,
      // Ô mã bị khoá ⇒ không gửi mã lên: backend giữ mã cũ khi sửa, tự cấp mã khi tạo.
      code: codeRule.locked ? undefined : data.code,
      objectiveId: objective.id,
      unitWeights: hasMultipleUnits ? unitWeights : undefined
    }

    if (keyResult) {
      updateKeyResult.mutate({ keyResultId: keyResult.id, data: requestData }, {
        onSuccess: () => onClose()
      })
    } else {
      createKeyResult.mutate(requestData, {
        onSuccess: () => onClose()
      })
    }
  }

  const isPending = createKeyResult.isPending || updateKeyResult.isPending

  return (
    <Dialog {...tourAnchor('kr.form')}
      open={isOpen}
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title={keyResult ? t('KeyResultFormModal.editResult') : t('KeyResultFormModal.addKeyResult')}
      description={t('KeyResultFormModal.configureKeyResult')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>{t('KeyResultFormModal.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('kr.form.submit')} type="submit" form="key-result-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {keyResult ? t('KeyResultFormModal.updateKr') : t('KeyResultFormModal.createNewKr')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <form id="key-result-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-4">
          <div {...tourAnchor('kr.form.name')} className="space-y-1.5">
            <label className="text-label">{t('KeyResultFormModal.keyResultName')} <span className="text-[var(--color-error)]">*</span></label>
            <input
              {...register('name')}
              placeholder={t('KeyResultFormModal.eGReach1BillionIn')}
              className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all"
            />
            {errors.name && <p className="text-xs font-medium text-[var(--color-error)] ml-1">{errors.name.message}</p>}
          </div>

          <CodeField
            rule={codeRule}
            currentCode={keyResult?.code}
            error={errors.code?.message}
            register={register('code')}
            label={t('KeyResultFormModal.keyResultCode')}
            fallbackPlaceholder="VD: KR001"
            tone="emerald"
            inputClassName="rounded-card py-3"
          />

          <div {...tourAnchor('kr.form.description')} className="space-y-1.5">
            <label className="text-label">{t('KeyResultFormModal.detailedDescription')}</label>
            <textarea
              {...register('description')}
              placeholder={t('KeyResultFormModal.describeSpecificallyHowThisResultIs')}
              rows={3}
              className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all resize-none"
            />
          </div>

          <div {...tourAnchor('kr.form.numbers')} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label className="text-label">{t('KeyResultFormModal.unit')}</label>
              <input
                {...register('unit')}
                placeholder={t('KeyResultFormModal.eGVnd')}
                className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className="text-label">{t('KeyResultFormModal.current')}</label>
              {/* Xoá trắng ô ⇒ undefined để schema cho qua, thay vì NaN chặn nút Lưu mà không báo gì. */}
              <LocaleNumberInput
                type="number"
                {...register('currentValue', { setValueAs: v => (v === '' || v == null ? undefined : Number(v)) })}
                onWheel={e => e.currentTarget.blur()}
                className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className="text-label">{t('KeyResultFormModal.target')} <span className="text-[var(--color-error)]">*</span></label>
              <LocaleNumberInput
                type="number"
                {...register('targetValue', { valueAsNumber: true })}
                onWheel={e => e.currentTarget.blur()}
                className="w-full px-4 py-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all"
              />
              {errors.targetValue && <p className="text-xs font-medium text-[var(--color-error)] ml-1">{errors.targetValue.message}</p>}
            </div>
          </div>
        </div>

        {/* Unit weight distribution — only shown when objective has multiple units */}
        {hasMultipleUnits && (
          <div {...tourAnchor('kr.form.allocation')} className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-label">{t('KeyResultFormModal.allocationByUnit')}</label>
              <span className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-control",
                Math.round(totalWeight) === 100
                  ? "bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]"
                  : "bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)] dark:text-[var(--color-warning)]"
              )}>
                {t('KeyResultFormModal.total')} {Math.round(totalWeight * 10) / 10}%
              </span>
            </div>

            <div className="rounded-card border border-[var(--color-border)] overflow-hidden">
              {unitWeights.map((w, idx) => (
                <div
                  key={w.orgUnitId}
                  className={cn(
                    "flex items-center gap-4 px-4 py-3",
                    idx !== unitWeights.length - 1 && "border-b border-[var(--color-border)]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-foreground)] truncate">{w.orgUnitName || w.orgUnitId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <LocaleNumberInput
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={w.weightPercentage}
                      onChange={e => updateWeight(idx, parseFloat(e.target.value) || 0)}
                      className="w-20 px-3 py-1.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-semibold text-right focus:ring-2 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all"
                    />
                    <span className="text-xs font-semibold text-[var(--color-subtle-foreground)]">%</span>
                  </div>
                </div>
              ))}
            </div>

            {weightError && (
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--color-warning)]">
                <AlertCircle size={14} />
                {weightError}
              </div>
            )}
          </div>
        )}
      </form>
    </Dialog>
  )
}
