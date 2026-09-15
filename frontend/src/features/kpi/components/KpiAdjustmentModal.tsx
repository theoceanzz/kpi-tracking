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

const adjustmentSchema = z.object({
  requestedTargetValue: z.any().optional(),
  requestedMinimumValue: z.any().optional(),
  deactivationRequest: z.boolean(),
  reason: z.string().min(10, 'Lý do phải ít nhất 10 ký tự'),
})

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

interface KpiAdjustmentModalProps {
  open: boolean
  onClose: () => void
  kpi: KpiCriteria | null
}

export default function KpiAdjustmentModal({ open, onClose, kpi }: KpiAdjustmentModalProps) {
  const qc = useQueryClient()

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue, getValues } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      deactivationRequest: false,
      reason: '',
    }
  })

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
      toast.success('Gửi yêu cầu điều chỉnh thành công!')
      onClose()
      reset()
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Gửi yêu cầu điều chỉnh thất bại'))
    }
  })

  if (!open || !kpi) return null

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!mutation.isPending}
      title="Xin điều chỉnh KPI"
      description={<span className="block truncate" title={kpi.name}>{kpi.name}</span>}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={mutation.isPending}>Hủy bỏ</Button>}
          primary={
            <Button type="submit" form="kpi-adjustment-form" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
              Gửi yêu cầu điều chỉnh
            </Button>
          }
        />
      }
    >
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
            Bạn có thể yêu cầu thay đổi mục tiêu, giá trị tối thiểu hoặc xin tạm dừng chỉ tiêu này. 
            Yêu cầu sẽ được gửi tới quản lý trực tiếp phê duyệt.
          </p>
        </div>

        {/* Type Toggle */}
        <div className="flex p-1 bg-[var(--color-muted)] rounded-card">
          <ChoiceChip selected={!deactivationRequest} variant="segment" className="flex-1 py-2.5" onClick={() => reset({ ...watch(), deactivationRequest: false })}>
            Thay đổi thông số
          </ChoiceChip>
          <ChoiceChip selected={deactivationRequest} variant="segment" className="flex-1 py-2.5" onClick={() => reset({ ...watch(), deactivationRequest: true })}>
            Xin dừng chỉ tiêu
          </ChoiceChip>
        </div>

        <input type="hidden" {...register('deactivationRequest')} />

        {!deactivationRequest ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
                <Target size={14} /> Mục tiêu mới
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  {...register('requestedTargetValue', { valueAsNumber: true })}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder={kpi.targetValue?.toString()}
                  className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)] outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-caption">{kpi.unit}</div>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
                <BarChart3 size={14} /> Tối thiểu mới
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  {...register('requestedMinimumValue', { valueAsNumber: true })}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  placeholder={kpi.minimumValue?.toString() || "0"}
                  className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:ring-2 focus:ring-[var(--color-ring)] outline-none"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-caption">{kpi.unit}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-card bg-[var(--color-error-bg)] border border-[var(--color-error-border)] flex items-center gap-3 animate-in slide-in-from-top-2 duration-300">
            <X className="text-[var(--color-error)]" size={20} />
            <p className="text-sm font-semibold text-[var(--color-error)]">
              Bạn đang yêu cầu <span className="underline">dừng</span> thực hiện chỉ tiêu này.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-label flex items-center gap-2 text-[var(--color-muted-foreground)] tracking-widest">
              <MessageSquare size={14} /> Lý do điều chỉnh <span className="text-[var(--color-error)]">*</span>
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
            placeholder="Giải trình cụ thể tại sao bạn cần điều chỉnh chỉ tiêu này..."
            className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm focus:ring-2 focus:ring-[var(--color-ring)] outline-none resize-none transition-all"
          />
          {errors.reason && <p className="text-[var(--color-error)] text-xs font-medium">{errors.reason.message}</p>}
        </div>

      </form>
    </Dialog>
  )
}
