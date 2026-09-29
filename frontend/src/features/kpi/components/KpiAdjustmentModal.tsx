import { LocaleNumberInput } from '@/components/ui/number-input'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFormAssistStore } from '@/store/formAssistStore'
import { MicButton } from '@/components/common/MicButton'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { adjustmentApi } from '../api/adjustmentApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  X, Target, MessageSquare,
  Send, Loader2, Info, BarChart3
} from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { KpiCriteria } from '@/types/kpi'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

const adjustmentSchema = perLanguage(() => (z.object({
  requestedTargetValue: z.any().optional(),
  requestedMinimumValue: z.any().optional(),
  deactivationRequest: z.boolean(),
  reason: z.string().min(10, i18n.t('kpi:KpiAdjustmentModal.theReasonMustBeAtLeast')),
})))

type AdjustmentFormData = z.infer<ReturnType<typeof adjustmentSchema>>

interface KpiAdjustmentModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiAdjustmentModal({ open, onClose, kpi }: KpiAdjustmentModalProps) {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()

  const formApi = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema()),
    defaultValues: {
      deactivationRequest: false,
      reason: '',
    }
  })
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, getValues } = formApi
  const draft = useFormDraft(formApi, { key: `kpi-adjustment:${kpi?.id ?? ''}`, enabled: open && !!kpi })

  const deactivationRequest = watch('deactivationRequest')

  // Giới thiệu form này với trợ lý AI trong lúc nó đang mở. Đặt TRƯỚC lệnh return sớm bên dưới —
  // hook có điều kiện là vỡ thứ tự hook.
  useEffect(() => {
    if (!open) return
    const { register: registerForm, unregister } = useFormAssistStore.getState()
    registerForm({
      formId: 'kpi_adjustment_form',
      getValues: () => getValues() as unknown as Record<string, unknown>,
      // Tab 'Xin dừng chỉ tiêu' không vẽ hai ô số. deactivationRequest cũng không có mặt: nó là
      // input ẩn, người dùng chỉ đổi được bằng hai nút chuyển tab.
      fillableFields: () => (deactivationRequest
        ? ['reason']
        : ['requestedTargetValue', 'requestedMinimumValue', 'reason']),
      setValue: (field, value) =>
        setValue(field as keyof AdjustmentFormData, value as never,
          { shouldValidate: true, shouldDirty: true }),
    })
    return () => unregister('kpi_adjustment_form')
  }, [open, getValues, setValue, deactivationRequest])

  const mutation = useMutation({
    mutationFn: (data: AdjustmentFormData) => adjustmentApi.create({
      kpiCriteriaId: kpi!.id,
      ...data
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kpi-adjustments'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['my-kpi-adjustments'] })
      toast.success(t('KpiAdjustmentModal.adjustmentRequestSentSuccessfully'))
      onClose()
      reset()
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, t('KpiAdjustmentModal.failedToSendTheAdjustmentRequest')))
    }
  })

  if (!open || !kpi) return null

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!mutation.isPending}
      title={t('KpiAdjustmentModal.requestKpiAdjustment')}
      description={<span className="block truncate" title={kpi.name}>{kpi.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={mutation.isPending}>{t('KpiAdjustmentModal.cancel')}</Button>}
          primary={
            <Button type="submit" form="kpi-adjustment-form" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              {t('KpiAdjustmentModal.sendAdjustmentRequest')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <form
        onSubmit={handleSubmit(data => {
          const formattedData = {
            ...data,
            requestedTargetValue: (isNaN(data.requestedTargetValue as any) || data.requestedTargetValue === kpi.targetValue) ? undefined : data.requestedTargetValue,
            requestedMinimumValue: (isNaN(data.requestedMinimumValue as any) || data.requestedMinimumValue === kpi.minimumValue) ? undefined : data.requestedMinimumValue,
          }
          mutation.mutate(formattedData)
        })} 
        id="kpi-adjustment-form"
        className="space-y-5"
      >
        
        <div className="p-4 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)] flex gap-3 items-start">
          <Info size={18} className="text-[var(--color-warning)] mt-0.5" />
          <p className="text-xs font-medium text-[var(--color-warning)] leading-relaxed">
            {t('KpiAdjustmentModal.youCanRequestToChangeThe')}
          </p>
        </div>

        {/* Type Toggle */}
        <div className="flex p-1 bg-[var(--color-muted)] rounded-card">
          <ChoiceChip selected={!deactivationRequest} variant="segment" className="flex-1 py-2.5" onClick={() => reset({ ...watch(), deactivationRequest: false })}>
            {t('KpiAdjustmentModal.changeFigures')}
          </ChoiceChip>
          <ChoiceChip selected={deactivationRequest} variant="segment" className="flex-1 py-2.5" onClick={() => reset({ ...watch(), deactivationRequest: true })}>
            {t('KpiAdjustmentModal.requestToStopTheKpi')}
          </ChoiceChip>
        </div>

        <input type="hidden" {...register('deactivationRequest')} />

        {!deactivationRequest ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
                <Target size={14} /> {t('KpiAdjustmentModal.newTarget')}
              </label>
              <div className="relative">
                <LocaleNumberInput
                  type="number"
                  step="any"
                  {...register('requestedTargetValue', { valueAsNumber: true })}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder={kpi.targetValue?.toString()}
                  className="no-edit-hint w-full px-4 py-3 pr-12 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)] outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-caption">{kpi.unit}</div>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
                <BarChart3 size={14} /> {t('KpiAdjustmentModal.newMinimum')}
              </label>
              <div className="relative">
                <LocaleNumberInput
                  type="number"
                  step="any"
                  {...register('requestedMinimumValue', { valueAsNumber: true })}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder={kpi.minimumValue?.toString() || "0"}
                  className="no-edit-hint w-full px-4 py-3 pr-12 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)] outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-caption">{kpi.unit}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-card bg-[var(--color-error-bg)] border border-[var(--color-error-border)] flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <X className="text-[var(--color-error)]" size={20} />
            <p className="text-sm font-semibold text-[var(--color-error)]">
              {t('KpiAdjustmentModal.youAreRequestingTo')} <span className="underline">{t('KpiAdjustmentModal.stop')}</span> {t('KpiAdjustmentModal.workingOnThisKpi')}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
              <MessageSquare size={14} /> {t('KpiAdjustmentModal.adjustmentReason')} <span className="text-[var(--color-error)]">*</span>
            </label>
            {/* Đọc bằng giọng nói VẪN là lời của người dùng, nên chốt chặn guardGroundedText
                phía máy chủ không liên quan — nó chỉ soi giá trị do AI tự đề xuất. */}
            <MicButton
              getBaseText={() => getValues("reason") ?? ""}
              onText={text => setValue("reason", text, { shouldValidate: true, shouldDirty: true })}
            />
          </div>
          <textarea
            {...register('reason')}
            rows={4}
            placeholder={t('KpiAdjustmentModal.explainSpecificallyWhyYouNeedTo')}
            className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm focus:ring-2 focus:ring-[var(--color-ring)] outline-none resize-none transition-all"
          />
          {errors.reason && <p className="text-[var(--color-error)] text-xs font-medium">{errors.reason.message}</p>}
        </div>

      </form>
    </Dialog>
  )
}
