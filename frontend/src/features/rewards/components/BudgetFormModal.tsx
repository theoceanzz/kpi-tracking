import { useEffect, useState } from 'react'
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
import type { RewardBudget } from '../types'

interface BudgetFormModalProps {
  open: boolean
  onClose: () => void
  editBudget?: RewardBudget | null
}

/** Ba cách khoanh thời gian, chọn đúng một. Backend từ chối nếu gửi cả kỳ lẫn đợt. */
type ScopeMode = 'CYCLE' | 'PERIOD' | 'DATES'

export default function BudgetFormModal({ open, onClose, editBudget }: BudgetFormModalProps) {
  const isEdit = !!editBudget

  const [grantorUserId, setGrantorUserId] = useState('')
  const [grantorLabel, setGrantorLabel] = useState('')
  const [scopeMode, setScopeMode] = useState<ScopeMode>('CYCLE')
  const [kpiCycleId, setKpiCycleId] = useState('')
  const [kpiPeriodId, setKpiPeriodId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [allocatedPoints, setAllocatedPoints] = useState<number | ''>('')
  const [maxPerAward, setMaxPerAward] = useState<number | ''>('')
  const [note, setNote] = useState('')

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
      setGrantorUserId(editBudget.grantorUserId)
      setGrantorLabel(editBudget.grantorName)
      setScopeMode(
        editBudget.kpiCycleId ? 'CYCLE' : editBudget.kpiPeriodId ? 'PERIOD' : 'DATES',
      )
      setKpiCycleId(editBudget.kpiCycleId ?? '')
      setKpiPeriodId(editBudget.kpiPeriodId ?? '')
      setPeriodStart(editBudget.periodStart)
      setPeriodEnd(editBudget.periodEnd)
      setAllocatedPoints(editBudget.allocatedPoints)
      setMaxPerAward(editBudget.maxPerAward ?? '')
      setNote(editBudget.note ?? '')
    } else {
      setGrantorUserId('')
      setGrantorLabel('')
      setScopeMode('CYCLE')
      setKpiCycleId('')
      setKpiPeriodId('')
      setPeriodStart('')
      setPeriodEnd('')
      setAllocatedPoints('')
      setMaxPerAward('')
      setNote('')
    }
  }, [open, editBudget])

  if (!open) return null

  const scopeReady =
    scopeMode === 'CYCLE' ? !!kpiCycleId
    : scopeMode === 'PERIOD' ? !!kpiPeriodId
    : !!periodStart && !!periodEnd

  const canSubmit =
    !!grantorUserId && typeof allocatedPoints === 'number' && allocatedPoints >= 0 && scopeReady

  const handleSubmit = async () => {
    if (!canSubmit) return
    const payload = {
      grantorUserId,
      // Chỉ gửi ĐÚNG MỘT cách khoanh thời gian. Gửi kèm cái thừa sẽ bị backend từ chối
      // (không rõ nên đồng bộ ngày theo kỳ hay theo đợt khi hai cái lệch nhau).
      kpiCycleId: scopeMode === 'CYCLE' ? kpiCycleId : null,
      kpiPeriodId: scopeMode === 'PERIOD' ? kpiPeriodId : null,
      periodStart: scopeMode === 'DATES' ? periodStart : null,
      periodEnd: scopeMode === 'DATES' ? periodEnd : null,
      allocatedPoints: allocatedPoints as number,
      maxPerAward: maxPerAward === '' ? null : (maxPerAward as number),
      note,
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
                <button onClick={() => setGrantorUserId('')} className="text-xs underline">
                  Đổi
                </button>
              </div>
            ) : (
              <EmployeePicker
                selectedIds={[]}
                onPick={(u) => {
                  setGrantorUserId(u.id)
                  setGrantorLabel(u.fullName)
                }}
                enabled={open && !isEdit}
                listClassName="max-h-40"
              />
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
                  onClick={() => setScopeMode(mode)}
                  className={`rounded-lg border px-3 py-1.5 ${scopeMode === mode ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10' : 'border-[var(--color-border)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {scopeMode === 'CYCLE' && (
              <Select value={kpiCycleId} onValueChange={setKpiCycleId}>
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
              <Select value={kpiPeriodId} onValueChange={setKpiPeriodId}>
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
                    onChange={setPeriodStart}
                    placeholder="Chọn ngày"
                    className={inputCls}
                    max={periodEnd || undefined}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[var(--color-muted-foreground)]">
                    Đến ngày
                  </label>
                  <DateField
                    value={periodEnd}
                    onChange={setPeriodEnd}
                    placeholder="Chọn ngày"
                    className={inputCls}
                    min={periodStart || undefined}
                  />
                </div>
              </div>
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
                value={allocatedPoints}
                onChange={(e) =>
                  setAllocatedPoints(e.target.value === '' ? '' : Number(e.target.value))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tối đa mỗi người/lần</label>
              <input
                type="number"
                min={1}
                placeholder="Không giới hạn"
                value={maxPerAward}
                onChange={(e) => setMaxPerAward(e.target.value === '' ? '' : Number(e.target.value))}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Ghi chú</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
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
            onClick={handleSubmit}
            disabled={!canSubmit || isCreating || isUpdating}
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
