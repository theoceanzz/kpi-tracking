import { useForm } from 'react-hook-form'
import { X, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { KeyResultRequest, KeyResultResponse, ObjectiveResponse, UnitWeight } from '../types'
import { useOkrMutations } from '../hooks/useOkr'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface KeyResultFormModalProps {
  isOpen: boolean
  onClose: () => void
  objective: ObjectiveResponse
  keyResult?: KeyResultResponse
}

export default function KeyResultFormModal({ isOpen, onClose, objective, keyResult }: KeyResultFormModalProps) {
  const { register, handleSubmit, reset, formState: { errors } } = useForm<KeyResultRequest>()
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

  const onSubmit = (data: KeyResultRequest) => {
    if (hasMultipleUnits) {
      const total = Math.round(totalWeight)
      if (total !== 100) {
        setWeightError(`Tổng % hiện tại là ${total}%, cần đúng 100%`)
        return
      }
    }

    const requestData: KeyResultRequest = {
      ...data,
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

  if (!isOpen) return null

  const isPending = createKeyResult.isPending || updateKeyResult.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200 dark:shadow-none">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{keyResult ? 'Chỉnh sửa kết quả' : 'Thêm kết quả then chốt'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Key Result Configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[85vh]">
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên kết quả then chốt</label>
                <input
                  {...register('name', { required: 'Vui lòng nhập tên KR' })}
                  placeholder="VD: Đạt 1 tỷ doanh số miền Nam"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã kết quả then chốt</label>
                <input
                  {...register('code', { required: 'Vui lòng nhập mã KR' })}
                  placeholder="VD: KR001"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                />
                {errors.code && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.code.message}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả chi tiết</label>
                <textarea
                  {...register('description')}
                  placeholder="Mô tả cụ thể cách đo lường kết quả này..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Đơn vị</label>
                  <input
                    {...register('unit')}
                    placeholder="VD: VNĐ, %"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hiện tại</label>
                  <input
                    type="number"
                    {...register('currentValue', { valueAsNumber: true })}
                    onWheel={e => e.currentTarget.blur()}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1.5 col-span-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mục tiêu</label>
                  <input
                    type="number"
                    {...register('targetValue', { required: true, valueAsNumber: true })}
                    onWheel={e => e.currentTarget.blur()}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Unit weight distribution — only shown when objective has multiple units */}
            {hasMultipleUnits && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">% Phân bổ theo đơn vị</label>
                  <span className={cn(
                    "text-xs font-black px-2 py-0.5 rounded-lg",
                    Math.round(totalWeight) === 100
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  )}>
                    Tổng: {Math.round(totalWeight * 10) / 10}%
                  </span>
                </div>

                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                  {unitWeights.map((w, idx) => (
                    <div
                      key={w.orgUnitId}
                      className={cn(
                        "flex items-center gap-4 px-4 py-3",
                        idx !== unitWeights.length - 1 && "border-b border-slate-100 dark:border-slate-800"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{w.orgUnitName || w.orgUnitId}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          value={w.weightPercentage}
                          onChange={e => updateWeight(idx, parseFloat(e.target.value) || 0)}
                          className="w-20 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-black text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                        />
                        <span className="text-xs font-black text-slate-400">%</span>
                      </div>
                    </div>
                  ))}
                </div>

                {weightError && (
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle size={14} />
                    {weightError}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-8 pb-8 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-[2] px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="animate-spin" size={18} />}
              {keyResult ? 'Cập nhật KR' : 'Tạo KR mới'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
