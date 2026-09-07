import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Loader2, X, Wallet, AlertTriangle } from 'lucide-react'
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

interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  editBudget?: RewardBudget | null
}

export default function BudgetFormModal({ open, onClose, editBudget }: BudgetFormModalProps) {
  const isEdit = !!editBudget

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      grantorUserId: '', grantorLabel: '', scopeMode: 'CYCLE', kpiCycleId: '', kpiPeriodId: '',
      periodStart: '', periodEnd: '', allocatedPoints: undefined, maxPerAward: undefined, note: '',
    },
  })

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

  if (!open) return null

  const onSubmit = async (data: BudgetFormData) => {
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
    'w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Wallet size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">
              {isEdit ? 'Sửa hạn mức thưởng' : 'Cấp hạn mức thưởng'}
            </h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Nói trước những gì bị khoá khi hạn mức đã dùng, thay vì để người dùng sửa
              xong bấm lưu rồi mới nhận lỗi. */}
          {isEdit && (editBudget?.usedPoints ?? 0) > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <span>
                Hạn mức này đã dùng <b>{editBudget!.usedPoints.toLocaleString('vi-VN')} điểm</b>. Bạn
                không thể hạ tổng điểm xuống dưới mức đó, cũng không thu hẹp được khoảng hiệu lực
                (chỉ mở rộng được). Muốn dừng quyền tự thưởng, hãy đặt tổng điểm bằng đúng{' '}
                {editBudget!.usedPoints.toLocaleString('vi-VN')} để phần còn lại về 0.
              </span>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Người được cấp hạn mức</label>
            {isEdit ? (
              <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                {grantorLabel}
              </div>
            ) : grantorUserId ? (
              <div className="flex items-center justify-between rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                {grantorLabel}
                <button onClick={() => setValue('grantorUserId', '')} className="text-xs underline">
                  Đổi
                </button>
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
              <p className="mt-1 text-xs text-rose-600">{errors.grantorUserId.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Khoảng hiệu lực</label>
            <div className="mb-2 flex flex-wrap gap-2 text-sm">
              {(
                [
                  ['CYCLE', 'Theo kỳ'],
                  ['PERIOD', 'Theo đợt'],
                  ['DATES', 'Chọn khoảng ngày'],
                ] as [ScopeMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setValue('scopeMode', mode, { shouldValidate: true })}
                  className={`rounded-lg border px-3 py-1.5 ${scopeMode === mode ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scopeMode === 'CYCLE' && (
              <Select value={kpiCycleId} onValueChange={v => setValue('kpiCycleId', v, { shouldValidate: true })}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn kỳ đánh giá" />
                </SelectTrigger>
                {/* z-[1100]: SelectContent mặc định z-50, modal này z-[1000] */}
                <SelectContent className="z-[1100]">
                  {(cycles?.content ?? []).map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scopeMode === 'PERIOD' && (
              <Select value={kpiPeriodId} onValueChange={v => setValue('kpiPeriodId', v, { shouldValidate: true })}>
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Chọn đợt đánh giá" />
                </SelectTrigger>
                <SelectContent className="z-[1100]">
                  {(periods?.content ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {scopeMode === 'DATES' && (
              // DateField: ô nhập kiểu biểu mẫu, luôn hiện dd/MM/yyyy và dùng lịch của
              // hệ điều hành nên không bị modal che. Xem javadoc của component.
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted-foreground)]">
                    Từ ngày
                  </label>
                  <DateField
                    value={periodStart}
                    onChange={v => setValue('periodStart', v, { shouldValidate: true })}
                    placeholder="Chọn ngày"
                    className={inputCls}
                    max={periodEnd || undefined}
                  />
                  {errors.periodStart && (
                    <p className="mt-1 text-xs text-rose-600">{errors.periodStart.message}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted-foreground)]">
                    Đến ngày
                  </label>
                  <DateField
                    value={periodEnd}
                    onChange={v => setValue('periodEnd', v, { shouldValidate: true })}
                    placeholder="Chọn ngày"
                    className={inputCls}
                    min={periodStart || undefined}
                  />
                  {errors.periodEnd && (
                    <p className="mt-1 text-xs text-rose-600">{errors.periodEnd.message}</p>
                  )}
                </div>
              </div>
            )}

            {(errors.kpiCycleId || errors.kpiPeriodId) && (
              <p className="mt-1 text-xs text-rose-600">
                {errors.kpiCycleId?.message ?? errors.kpiPeriodId?.message}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Chọn kỳ hoặc đợt thì hệ thống tự lấy ngày bắt đầu/kết thúc của nó. Mỗi người tại
              một thời điểm chỉ được có một hạn mức, nên khoảng này không được đè lên hạn mức
              khác của cùng người đó — muốn thay thì sửa hạn mức cũ.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tổng điểm được cấp</label>
              <input
                type="number"
                min={0}
                {...register('allocatedPoints', { setValueAs: numOrUndefined })}
                className={inputCls}
              />
              {errors.allocatedPoints && (
                <p className="mt-1 text-xs text-rose-600">{errors.allocatedPoints.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tối đa mỗi người/lần</label>
              <input
                type="number"
                min={1}
                placeholder="Không giới hạn"
                {...register('maxPerAward', { setValueAs: numOrUndefined })}
                className={inputCls}
              />
              {errors.maxPerAward && (
                <p className="mt-1 text-xs text-rose-600">{errors.maxPerAward.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Ghi chú</label>
            <input {...register('note')} className={inputCls} />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={isCreating || isUpdating}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {(isCreating || isUpdating) && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Lưu' : 'Cấp hạn mức'}
          </button>
        </div>
      </div>
    </div>
  )
}
