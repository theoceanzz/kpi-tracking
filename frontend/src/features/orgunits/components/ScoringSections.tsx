import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import {
  Edit3, Trash2, Info, Plus, Sparkles, RotateCcw,
  Grid3x3, X, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import type { PerformanceMatrix } from '../api/organizationApi'
import { useUpdateOrganization } from '../hooks/useUpdateOrganization'

/**
 * Các khối cấu hình thang điểm & xếp loại, tách khỏi CompanyPage để dùng cho trang
 * "Thang điểm & xếp loại". Nội dung giữ nguyên như khi còn nằm trong CompanyPage.
 */
/** Dải màu mặc định dùng chung cho cả thang điểm định lượng & định tính (thấp → cao). */
const DEFAULT_LEVEL_COLORS = ['#ef4444', '#f59e0b', '#6366f1', '#3b82f6', '#10b981']
const FALLBACK_LEVEL_COLOR = '#6366f1'

export function ScoringConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [maxScore, setMaxScore] = useState(org?.evaluationMaxScore || 100)

  // Hiển thị từ thấp lên cao (đồng bộ với thang điểm định tính)
  const mapLevels = (levels: any[]) =>
    [...(levels || [])]
      .sort((a, b) => (a.threshold ?? 0) - (b.threshold ?? 0))
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        threshold: l.threshold,
        color: l.color || FALLBACK_LEVEL_COLOR
      }))

  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: {
      evaluationLevels: mapLevels(org?.evaluationLevels)
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: "evaluationLevels"
  })

  const watchedLevels = watch("evaluationLevels")

  useEffect(() => {
    if (org?.evaluationLevels) {
      reset({ evaluationLevels: mapLevels(org.evaluationLevels) })
      setMaxScore(org.evaluationMaxScore || 100)
    }
  }, [org, reset])

  const handleSave = (data: any) => {
    // Validation
    if (maxScore <= 0) {
      toast.error('Thang điểm tối đa phải lớn hơn 0')
      return
    }

    const invalidLevel = data.evaluationLevels.find((l: any) => l.threshold > maxScore)
    if (invalidLevel) {
      toast.error(`Điểm mức "${invalidLevel.name}" không được vượt quá Thang điểm tối đa (${maxScore})`)
      return
    }

    updateMutation.mutate({ 
      evaluationMaxScore: maxScore,
      evaluationLevels: data.evaluationLevels.map((l: any) => ({
        name: l.name,
        threshold: Number(l.threshold),
        color: l.color
      }))
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Cập nhật thang điểm thành công')
      },
      onError: () => toast.error('Không thể cập nhật thang điểm')
    })
  }

  const handleResetToDefault = () => {
    const defaultLevels = [
      { name: 'YẾU', threshold: 0, color: DEFAULT_LEVEL_COLORS[0] },
      { name: 'TRUNG BÌNH', threshold: 50, color: DEFAULT_LEVEL_COLORS[1] },
      { name: 'KHÁ', threshold: 70, color: DEFAULT_LEVEL_COLORS[2] },
      { name: 'TỐT', threshold: 80, color: DEFAULT_LEVEL_COLORS[3] },
      { name: 'XUẤT SẮC', threshold: 90, color: DEFAULT_LEVEL_COLORS[4] },
    ]
    
    updateMutation.mutate({
      evaluationMaxScore: 100,
      evaluationLevels: defaultLevels
    }, {
      onSuccess: () => {
        setIsEditing(false)
        toast.success('Đã đặt lại về thang điểm mặc định thành công')
      },
      onError: () => toast.error('Không thể đặt lại thang điểm')
    })
  }

  return (
    // Tiêu đề và hai nút sửa/đặt lại nằm trên `WorkspaceHeader` — đó cũng là nơi vẽ
    // hàng tab Định lượng/Định tính, nên không dựng thêm một đầu card nữa ở đây.
    <div className="space-y-5">
      <WorkspaceHeader
        description="Thang điểm tối đa và các mức xếp loại áp cho KPI định lượng."
        actions={
          !isEditing && (
            <>
              <button
                onClick={handleResetToDefault}
                className="w-10 h-10 rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] border border-[var(--color-border)] transition-all flex items-center justify-center"
                title="Đặt lại về mặc định"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95"
              >
                <Edit3 size={16} /> Chỉnh sửa
              </button>
            </>
          )
        }
      />

      <section className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
            <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-700 text-white overflow-hidden shadow-xl shadow-indigo-500/10">
               <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
               <div className="flex justify-between items-center relative z-10">
                 <div className="space-y-0.5">
                   <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest">Hệ số tối đa</p>
                   <h4 className="text-xl font-black">Thang {maxScore} điểm</h4>
                 </div>
                 <div className="flex items-center">
                   {isEditing ? (
                     <input 
                        type="number"
                        value={maxScore}
                        onChange={e => setMaxScore(Number(e.target.value))}
                        className="w-20 bg-white/10 border border-white/10 rounded-lg py-2 px-2 text-center text-sm font-bold focus:outline-none focus:ring-1 focus:ring-amber-500"
                        onWheel={(e) => (e.target as HTMLInputElement).blur()}
                     />
                   ) : (
                     <div className="px-4 py-2 bg-white/10 rounded-lg text-sm font-black border border-white/10">
                        {maxScore}
                     </div>
                   )}
                 </div>
               </div>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Các mức xếp loại</h4>
                  {isEditing && (
                    <button 
                      type="button"
                      onClick={() => append({ id: undefined, name: 'MỨC MỚI', threshold: 0, color: '#3b82f6' })}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus size={14} /> Thêm mức
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {fields.map((field, index) => (
                    <div key={field.id} className="group relative bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                        {isEditing ? (
                          <>
                            <div className="flex-1 space-y-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Tên mức</label>
                              <input
                                {...register(`evaluationLevels.${index}.name` as const)}
                                className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="flex items-end gap-3">
                              <div className="w-24 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Điểm ≥</label>
                                <input
                                  type="number"
                                  {...register(`evaluationLevels.${index}.threshold` as const)}
                                  className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-indigo-500"
                                />
                              </div>
                              <div className="flex-1 sm:flex-none sm:w-16 space-y-1">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Màu</label>
                                <input
                                  type="color"
                                  {...register(`evaluationLevels.${index}.color` as const)}
                                  className="w-full h-9 bg-transparent border border-slate-100 dark:border-slate-800 outline-none cursor-pointer p-0.5 rounded-lg"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => remove(index)}
                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mb-0.5"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm" style={{ backgroundColor: watchedLevels[index]?.color || '#cbd5e1' }}>
                              <Sparkles size={18} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{watchedLevels[index]?.name}</p>
                              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Xếp loại cho điểm ≥ {watchedLevels[index]?.threshold}</p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-900 dark:text-white">{watchedLevels[index]?.threshold}</span>
                              <span className="text-[10px] font-bold text-slate-400 ml-1">đ</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            {isEditing && (
              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsEditing(false);
                    reset();
                  }} 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                >
                  Hủy
                </button>
                <button 
                  type="button" 
                  onClick={handleSubmit(handleSave)}
                  disabled={updateMutation.isPending}
                  className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Lưu cấu hình
                </button>
              </div>
            )}
        </div>
      </section>
    </div>
  )
}

const DEFAULT_QUALITATIVE_LEVELS = [
  { name: 'KÉM', value: 0, position: 1, scorePercent: 0, color: DEFAULT_LEVEL_COLORS[0] },
  { name: 'YẾU', value: 2, position: 2, scorePercent: 40, color: DEFAULT_LEVEL_COLORS[1] },
  { name: 'TRUNG BÌNH', value: 3, position: 3, scorePercent: 60, color: DEFAULT_LEVEL_COLORS[2] },
  { name: 'KHÁ', value: 3.5, position: 4, scorePercent: 80, color: DEFAULT_LEVEL_COLORS[3] },
  { name: 'TỐT', value: 4.5, position: 5, scorePercent: 100, color: DEFAULT_LEVEL_COLORS[4] },
]

export function QualitativeConfigSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)

  const mapLevels = (levels: any[]) =>
    [...(levels || [])]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((l: any) => ({
        id: l.id,
        name: l.name,
        value: l.value,
        position: l.position,
        scorePercent: l.scorePercent ?? 0,
        color: l.color || FALLBACK_LEVEL_COLOR,
      }))

  const { register, control, handleSubmit, reset, watch } = useForm({
    defaultValues: { qualitativeLevels: mapLevels(org?.qualitativeLevels) },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'qualitativeLevels' })
  const watchedLevels = watch('qualitativeLevels')

  useEffect(() => {
    reset({ qualitativeLevels: mapLevels(org?.qualitativeLevels) })
  }, [org, reset])

  const handleSave = (data: any) => {
    if (!data.qualitativeLevels.length) {
      toast.error('Cần ít nhất 1 mức đánh giá')
      return
    }
    const invalid = data.qualitativeLevels.find((l: any) => !l.name?.trim())
    if (invalid) {
      toast.error('Tên mức không được để trống')
      return
    }

    const positions = data.qualitativeLevels.map((l: any) => Number(l.position))
    const invalidPos = positions.find((p: number) => !Number.isInteger(p) || p < 1)
    if (invalidPos !== undefined) {
      toast.error('Vị trí phải là số nguyên lớn hơn hoặc bằng 1')
      return
    }
    // Vị trí phải liên tục từ 1: 1, 2, 3, ..., n (không trùng, không nhảy cóc)
    const sorted = [...positions].sort((a, b) => a - b)
    const isSequential = sorted.every((p, i) => p === i + 1)
    if (!isSequential) {
      toast.error('Vị trí phải liên tục từ 1 (ví dụ: 1, 2, 3, 4, 5)')
      return
    }

    const invalidPct = data.qualitativeLevels.find((l: any) => {
      const p = Number(l.scorePercent)
      return isNaN(p) || p < 0 || p > 100
    })
    if (invalidPct) {
      toast.error('% quy đổi BSC phải nằm trong khoảng 0–100')
      return
    }

    updateMutation.mutate(
      {
        qualitativeLevels: data.qualitativeLevels.map((l: any) => ({
          name: l.name.trim(),
          value: Number(l.value),
          position: Number(l.position),
          scorePercent: Number(l.scorePercent),
          color: l.color,
        })),
      },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success('Cập nhật thang điểm định tính thành công')
        },
        onError: () => toast.error('Không thể cập nhật thang điểm định tính'),
      }
    )
  }

  const handleResetToDefault = () => {
    updateMutation.mutate(
      { qualitativeLevels: DEFAULT_QUALITATIVE_LEVELS },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success('Đã đặt lại về thang điểm định tính mặc định')
        },
        onError: () => toast.error('Không thể đặt lại thang điểm định tính'),
      }
    )
  }

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        description="Các mức đánh giá hành vi và điểm quy đổi tương ứng, dùng cho KPI định tính."
        actions={
          !isEditing && (
            <>
              <button
                onClick={handleResetToDefault}
                className="w-10 h-10 rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)] hover:text-[var(--color-primary)] border border-[var(--color-border)] transition-all flex items-center justify-center"
                title="Đặt lại về mặc định"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95"
              >
                <Edit3 size={16} /> Chỉnh sửa
              </button>
            </>
          )
        }
      />

      <section className="bg-[var(--color-card)] rounded-2xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        <div className="p-8 space-y-8">
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 flex items-start gap-3">
          <Info size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 font-medium leading-relaxed">
            Quy đổi mỗi mức đánh giá định tính sang một giá trị điểm để tham chiếu. <span className="font-bold">Vị trí</span> là thứ tự cột trong bảng tính, <span className="font-bold">Giá trị</span> là điểm quy đổi tương ứng (dùng cho ma trận hiệu suất).
            {org?.enableBsc && <> Cột <span className="font-bold text-indigo-600 dark:text-indigo-400">% BSC</span> là mức hoàn thành tương ứng khi tính điểm BSC — độc lập với Giá trị, do bạn tự định nghĩa (VD: KÉM 0% · YẾU 40% · TB 60% · KHÁ 80% · TỐT 100%).</>}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Các mức đánh giá</h4>
            {isEditing && (
              <button
                type="button"
                onClick={() => append({ id: undefined, name: 'MỨC MỚI', value: 0, position: fields.length + 1, scorePercent: 0, color: '#3b82f6' })}
                className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <Plus size={14} /> Thêm mức
              </button>
            )}
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="group relative bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  {isEditing ? (
                    <>
                      <div className="w-16 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Vị trí</label>
                        <input
                          type="number"
                          {...register(`qualitativeLevels.${index}.position` as const)}
                          className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-emerald-500"
                          onWheel={(e) => (e.target as HTMLInputElement).blur()}
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Tên mức</label>
                        <input
                          {...register(`qualitativeLevels.${index}.name` as const)}
                          className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-end gap-3">
                        <div className="w-20 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Giá trị</label>
                          <input
                            type="number"
                            step="0.5"
                            {...register(`qualitativeLevels.${index}.value` as const)}
                            className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-emerald-500"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        </div>
                        <div className="w-24 space-y-1">
                          <label className="text-[9px] font-bold text-indigo-400 uppercase" title="Mức này tương đương bao nhiêu % hoàn thành khi tính điểm BSC">% BSC</label>
                          <input
                            type="number"
                            step="1"
                            min="0"
                            max="100"
                            {...register(`qualitativeLevels.${index}.scorePercent` as const)}
                            className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-900/50 outline-none focus:border-indigo-500"
                            onWheel={(e) => (e.target as HTMLInputElement).blur()}
                          />
                        </div>
                        <div className="flex-1 sm:flex-none sm:w-16 space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Màu</label>
                          <input
                            type="color"
                            {...register(`qualitativeLevels.${index}.color` as const)}
                            className="w-full h-9 bg-transparent border border-slate-100 dark:border-slate-800 outline-none cursor-pointer p-0.5 rounded-lg"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors mb-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-sm" style={{ backgroundColor: watchedLevels[index]?.color || '#cbd5e1' }}>
                        {watchedLevels[index]?.position}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-slate-900 dark:text-white uppercase">{watchedLevels[index]?.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Vị trí {watchedLevels[index]?.position} · Điểm quy đổi</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {org?.enableBsc && (
                          <div className="text-right" title="Quy đổi sang % hoàn thành khi tính điểm BSC">
                            <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{watchedLevels[index]?.scorePercent ?? 0}%</span>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">BSC</p>
                          </div>
                        )}
                        <div className="text-right">
                          <span className="text-lg font-black text-slate-900 dark:text-white">{watchedLevels[index]?.value}</span>
                          <span className="text-[10px] font-bold text-slate-400 ml-1">đ</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {isEditing && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsEditing(false)
                reset()
              }}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSubmit(handleSave)}
              disabled={updateMutation.isPending}
              className="flex-[2] py-2.5 bg-emerald-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Lưu cấu hình
            </button>
          </div>
        )}
        </div>
      </section>
    </div>
  )
}

const DEFAULT_PERFORMANCE_MATRIX: PerformanceMatrix = {
  rowHeader: 'Điểm hành vi',
  colHeader: '% Hoàn thành KPI',
  rows: ['<2', '≥2 và <3', '≥3 và <3.5', '≥3.5 và <4.5', '≥4.5 và ≤5'],
  cols: ['< 70%', '≥70 và <90%', '≥90 và <110%', '≥110 và <120%', '≥120%'],
  cells: [
    [1, 1, 1, 2, 2],
    [1, 2, 2, 3, 3],
    [2, 2, 3, 4, 4],
    [2, 3, 3, 4, 5],
    [2, 3, 4, 4, 5],
  ],
}

const cellColor = (v: number) => {
  const map: Record<number, string> = {
    1: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    2: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    3: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    4: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    5: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  }
  return map[v] || 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
}

function parseMatrix(raw?: string): PerformanceMatrix {
  if (!raw) return DEFAULT_PERFORMANCE_MATRIX
  try {
    const m = JSON.parse(raw)
    if (Array.isArray(m?.rows) && Array.isArray(m?.cols) && Array.isArray(m?.cells)) return m
  } catch {
    /* fall through to default */
  }
  return DEFAULT_PERFORMANCE_MATRIX
}

export function PerformanceMatrixSection({ org }: { org: any }) {
  const updateMutation = useUpdateOrganization(org.id)
  const [isEditing, setIsEditing] = useState(false)
  const [matrix, setMatrix] = useState<PerformanceMatrix>(() => parseMatrix(org?.performanceMatrix))

  useEffect(() => {
    setMatrix(parseMatrix(org?.performanceMatrix))
  }, [org])

  const clone = (m: PerformanceMatrix): PerformanceMatrix => JSON.parse(JSON.stringify(m))

  const setCell = (r: number, c: number, value: string) => {
    const next = clone(matrix)
    if (!next.cells[r]) return
    next.cells[r][c] = value === '' ? 0 : Number(value)
    setMatrix(next)
  }
  const setRowHeader = (r: number, value: string) => {
    const next = clone(matrix)
    next.rows[r] = value
    setMatrix(next)
  }
  const setColHeader = (c: number, value: string) => {
    const next = clone(matrix)
    next.cols[c] = value
    setMatrix(next)
  }
  const addRow = () => {
    const next = clone(matrix)
    next.rows.push('Dải mới')
    next.cells.push(next.cols.map(() => 1))
    setMatrix(next)
  }
  const removeRow = (r: number) => {
    if (matrix.rows.length <= 1) return
    const next = clone(matrix)
    next.rows.splice(r, 1)
    next.cells.splice(r, 1)
    setMatrix(next)
  }
  const addCol = () => {
    const next = clone(matrix)
    next.cols.push('Dải mới')
    next.cells.forEach(row => row.push(1))
    setMatrix(next)
  }
  const removeCol = (c: number) => {
    if (matrix.cols.length <= 1) return
    const next = clone(matrix)
    next.cols.splice(c, 1)
    next.cells.forEach(row => row.splice(c, 1))
    setMatrix(next)
  }

  const handleSave = () => {
    const cleaned: PerformanceMatrix = {
      ...matrix,
      rowHeader: matrix.rowHeader?.trim(),
      colHeader: matrix.colHeader?.trim(),
      rows: matrix.rows.map(h => h.trim()),
      cols: matrix.cols.map(h => h.trim()),
    }
    if (!cleaned.rows.length || !cleaned.cols.length) {
      toast.error('Ma trận cần ít nhất 1 hàng và 1 cột')
      return
    }
    if (cleaned.rows.some(h => !h) || cleaned.cols.some(h => !h)) {
      toast.error('Nhãn hàng/cột không được để trống')
      return
    }
    if (new Set(cleaned.rows).size !== cleaned.rows.length) {
      toast.error('Nhãn hàng không được trùng nhau')
      return
    }
    if (new Set(cleaned.cols).size !== cleaned.cols.length) {
      toast.error('Nhãn cột không được trùng nhau')
      return
    }
    const hasInvalidCell = cleaned.cells.some(row => row.some(v => !Number.isInteger(v) || v < 1))
    if (hasInvalidCell) {
      toast.error('Giá trị ô phải là số nguyên lớn hơn hoặc bằng 1')
      return
    }
    updateMutation.mutate(
      { performanceMatrix: JSON.stringify(cleaned) },
      {
        onSuccess: () => {
          setIsEditing(false)
          toast.success('Cập nhật ma trận xếp loại thành công')
        },
        onError: () => toast.error('Không thể cập nhật ma trận xếp loại'),
      }
    )
  }

  const handleCancel = () => {
    setMatrix(parseMatrix(org?.performanceMatrix))
    setIsEditing(false)
  }

  const handleResetToDefault = () => {
    updateMutation.mutate(
      { performanceMatrix: JSON.stringify(DEFAULT_PERFORMANCE_MATRIX) },
      {
        onSuccess: () => {
          setMatrix(DEFAULT_PERFORMANCE_MATRIX)
          setIsEditing(false)
          toast.success('Đã đặt lại về ma trận mặc định')
        },
        onError: () => toast.error('Không thể đặt lại ma trận'),
      }
    )
  }

  const inputCls = 'w-full bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-fuchsia-500 text-center'

  return (
    <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <div className="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-fuchsia-50 dark:bg-fuchsia-900/30 flex items-center justify-center text-fuchsia-600 dark:text-fuchsia-400">
            <Grid3x3 size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Ma trận xếp loại</h3>
            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Hiệu quả làm việc</p>
          </div>
        </div>
        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToDefault}
              className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-fuchsia-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center"
              title="Đặt lại về mặc định"
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={() => setIsEditing(true)}
              className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-fuchsia-600 border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center"
            >
              <Edit3 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="p-8 space-y-6">
        <div className="p-4 rounded-2xl bg-fuchsia-50 dark:bg-fuchsia-900/10 border border-fuchsia-100 dark:border-fuchsia-900/30 flex items-start gap-3">
          <Info size={18} className="text-fuchsia-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-fuchsia-700/80 dark:text-fuchsia-400/80 font-medium leading-relaxed">
            Ánh xạ <span className="font-bold">Điểm hành vi</span> (hàng) và <span className="font-bold">% hoàn thành KPI</span> (cột) sang mức xếp loại cuối cùng. Chỉnh nhãn dải, giá trị ô, thêm/bớt hàng-cột tùy ý.
          </p>
        </div>

        {isEditing && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Tên trục hàng</label>
              <input
                value={matrix.rowHeader || ''}
                onChange={e => setMatrix({ ...clone(matrix), rowHeader: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-fuchsia-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase">Tên trục cột</label>
              <input
                value={matrix.colHeader || ''}
                onChange={e => setMatrix({ ...clone(matrix), colHeader: e.target.value })}
                className="w-full bg-white dark:bg-slate-900 px-3 py-2 rounded-lg text-xs font-bold border border-slate-100 dark:border-slate-800 outline-none focus:border-fuchsia-500"
              />
            </div>
          </div>
        )}

        {!isEditing && (
          <p className="sm:hidden text-[10px] font-medium text-slate-400 flex items-center gap-1 px-1">
            <ArrowRight size={12} className="animate-pulse" /> Vuốt ngang để xem đầy đủ bảng
          </p>
        )}

        <div className="overflow-x-auto -mx-2 px-2">
          <table className="border-separate border-spacing-1 min-w-full">
            <thead>
              <tr>
                <th className="p-2 min-w-[88px] sm:min-w-[120px] text-left align-bottom sticky left-0 z-20 bg-white dark:bg-slate-900">
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight block">
                    {matrix.rowHeader} ↓
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase leading-tight block">
                    {matrix.colHeader} →
                  </span>
                </th>
                {matrix.cols.map((col, ci) => (
                  <th key={ci} className="p-1 min-w-[76px] sm:min-w-[110px]">
                    {isEditing ? (
                      <div className="flex flex-col gap-1">
                        <input value={col} onChange={e => setColHeader(ci, e.target.value)} className={inputCls} />
                        <button
                          type="button"
                          onClick={() => removeCol(ci)}
                          className="self-center p-1 text-red-400 hover:text-red-600 disabled:opacity-30"
                          disabled={matrix.cols.length <= 1}
                          title="Xóa cột"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="px-1.5 sm:px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-200 text-center">
                        {col}
                      </div>
                    )}
                  </th>
                ))}
                {isEditing && (
                  <th className="p-1 align-top">
                    <button
                      type="button"
                      onClick={addCol}
                      className="h-9 px-3 rounded-lg border border-dashed border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus size={12} /> Cột
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, ri) => (
                <tr key={ri}>
                  <th className="p-1 min-w-[88px] sm:min-w-[120px] sticky left-0 z-10 bg-white dark:bg-slate-900">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <input value={row} onChange={e => setRowHeader(ri, e.target.value)} className={inputCls + ' text-left'} />
                        <button
                          type="button"
                          onClick={() => removeRow(ri)}
                          className="p-1 text-red-400 hover:text-red-600 disabled:opacity-30 shrink-0"
                          disabled={matrix.rows.length <= 1}
                          title="Xóa hàng"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ) : (
                      <div className="px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-200 text-left">
                        {row}
                      </div>
                    )}
                  </th>
                  {matrix.cols.map((_, ci) => {
                    const val = matrix.cells[ri]?.[ci] ?? 0
                    return (
                      <td key={ci} className="p-1">
                        {isEditing ? (
                          <input
                            type="number"
                            value={matrix.cells[ri]?.[ci] ?? 0}
                            onChange={e => setCell(ri, ci, e.target.value)}
                            onWheel={e => (e.target as HTMLInputElement).blur()}
                            className={inputCls}
                          />
                        ) : (
                          <div className={cn('py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-black text-center', cellColor(val))}>
                            {val}
                          </div>
                        )}
                      </td>
                    )
                  })}
                  {isEditing && <td />}
                </tr>
              ))}
              {isEditing && (
                <tr>
                  <td className="p-1">
                    <button
                      type="button"
                      onClick={addRow}
                      className="h-9 px-3 rounded-lg border border-dashed border-fuchsia-300 text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                    >
                      <Plus size={12} /> Hàng
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isEditing && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="flex-[2] py-2.5 bg-fuchsia-600 text-white rounded-xl text-[11px] font-bold uppercase tracking-wider shadow-lg hover:bg-fuchsia-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {updateMutation.isPending && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              Lưu ma trận
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
