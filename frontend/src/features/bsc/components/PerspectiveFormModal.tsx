import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { X, Layers, Loader2, Plus, Scale } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PerspectiveRequest, PerspectiveResponse, BscPerspectiveStatus, BscFixedPerspective } from '../types'
import { useBscMutations, useBscPerspectives, useFixedPerspectives } from '../hooks/useBsc'

interface PerspectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  perspective?: PerspectiveResponse
  /** Chọn sẵn lĩnh vực khi tạo — dùng khi mở từ đúng nhóm lĩnh vực trong bộ tiêu chí. */
  defaultFixedPerspective?: BscFixedPerspective
  /** Đè z-index của lớp phủ khi modal này nằm trên một modal khác. */
  overlayClassName?: string
  /** Hiện thêm ô trọng số % — dùng khi mở từ modal bộ tiêu chí. */
  showWeight?: boolean
  /** Trọng số khởi tạo: trọng số hiện tại khi sửa, thường là 0 khi tạo mới. */
  defaultWeight?: number
  /** Tổng trọng số các hạng mục đang bật KHÔNG tính hạng mục này — để gợi ý phần còn thiếu. */
  otherWeightTotal?: number
  /** Gọi sau khi lưu để bộ tiêu chí áp trọng số vừa nhập cho hạng mục. */
  onWeightSubmit?: (perspectiveId: string, weight: number) => void
}

/** Trọng số không thuộc hạng mục mà thuộc bộ tiêu chí, nên tách khỏi payload khi gửi. */
type PerspectiveFormValues = PerspectiveRequest & { weightPercentage?: number }

const PRESET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#0ea5e9', '#ec4899']

export default function PerspectiveFormModal({
  isOpen, onClose, organizationId, perspective, defaultFixedPerspective, overlayClassName,
  showWeight, defaultWeight = 0, otherWeightTotal = 0, onWeightSubmit,
}: PerspectiveFormModalProps) {
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<PerspectiveFormValues>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      color: PRESET_COLORS[0],
      displayOrder: 0,
      status: BscPerspectiveStatus.ACTIVE,
      fixedPerspective: undefined,
      weightPercentage: 0,
    },
  })

  const { createPerspective, updatePerspective } = useBscMutations()
  const { data: allPerspectives } = useBscPerspectives(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives()
  const selectedColor = watch('color')
  const selectedFixed = watch('fixedPerspective')
  const weightValue = watch('weightPercentage')

  // Phần còn thiếu để bộ tiêu chí đủ 100% (đã trừ các hạng mục khác đang bật).
  const round1 = (n: number) => Math.round(n * 10) / 10
  const missingWeight = round1(Math.max(0, 100 - otherWeightTotal))
  const totalAfterSave = round1(otherWeightTotal + (Number(weightValue) || 0))

  // Select/Popover của Radix portal thẳng ra <body> với z-50 cố định. Khi modal này được
  // đẩy lên z-[60] (nằm trên modal bộ tiêu chí) thì danh sách chọn rơi xuống DƯỚI lớp phủ —
  // nhìn như dropdown bấm không mở. Nâng theo cùng nhịp với lớp phủ.
  const layerClass = overlayClassName ? 'z-[70]' : ''

  // Thứ tự hiển thị phải không trùng TRONG CÙNG lĩnh vực, nên gợi ý sẵn số kế tiếp.
  // Để mặc định 0 thì hạng mục thứ hai của mỗi lĩnh vực luôn báo lỗi trùng.
  const nextOrderIn = (fixed?: BscFixedPerspective) => {
    const orders = (allPerspectives || []).filter(p => p.fixedPerspective === fixed).map(p => p.displayOrder ?? 0)
    return orders.length === 0 ? 0 : Math.max(...orders) + 1
  }

  useEffect(() => {
    if (perspective) {
      reset({
        code: perspective.code,
        name: perspective.name,
        description: perspective.description,
        color: perspective.color || PRESET_COLORS[0],
        icon: perspective.icon,
        displayOrder: perspective.displayOrder,
        status: perspective.status,
        fixedPerspective: perspective.fixedPerspective,
        weightPercentage: defaultWeight,
      })
    } else {
      reset({
        code: '',
        name: '',
        description: '',
        color: PRESET_COLORS[0],
        displayOrder: nextOrderIn(defaultFixedPerspective),
        status: BscPerspectiveStatus.ACTIVE,
        fixedPerspective: defaultFixedPerspective,
        weightPercentage: defaultWeight,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perspective, reset, isOpen, defaultFixedPerspective, defaultWeight])

  const onSubmit = ({ weightPercentage, ...data }: PerspectiveFormValues) => {
    const weight = Number.isFinite(Number(weightPercentage)) ? Number(weightPercentage) : 0
    if (perspective) {
      updatePerspective.mutate({ perspectiveId: perspective.id, data }, {
        onSuccess: () => {
          if (showWeight) onWeightSubmit?.(perspective.id, weight)
          onClose()
        },
      })
    } else {
      createPerspective.mutate({ organizationId, data }, {
        onSuccess: created => {
          if (showWeight && created?.id) onWeightSubmit?.(created.id, weight)
          onClose()
          reset()
        },
      })
    }
  }

  if (!isOpen) return null

  const isPending = createPerspective.isPending || updatePerspective.isPending

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300', overlayClassName)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{perspective ? 'Chỉnh sửa hạng mục' : 'Tạo hạng mục mới'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BSC · Hạng mục</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[85vh]">
          <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên hạng mục <span className="text-red-500">*</span></label>
                <input
                  {...register('name', { required: 'Vui lòng nhập tên hạng mục' })}
                  placeholder="VD: Công tác giảng dạy"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã <span className="text-red-500">*</span></label>
                <input
                  {...register('code', {
                    required: 'Vui lòng nhập mã',
                    maxLength: { value: 50, message: 'Mã tối đa 50 ký tự' },
                    pattern: {
                      value: /^[A-Za-z0-9_]+$/,
                      message: 'Mã chỉ gồm chữ, số và dấu gạch dưới (không dấu cách, không tiếng Việt)',
                    },
                    validate: {
                      reserved: v => {
                        if (!v) return true
                        const RESERVED = ['FINANCIAL', 'CUSTOMER', 'INTERNAL_PROCESS', 'LEARNING_GROWTH']
                        return !RESERVED.includes(v.trim().toUpperCase()) || 'Mã này trùng mã lĩnh vực cố định — hãy dùng mã khác'
                      },
                      duplicate: v => {
                        if (!v) return true
                        const clash = (allPerspectives || []).some(p => p.code?.toLowerCase() === v.trim().toLowerCase() && p.id !== perspective?.id)
                        return !clash || 'Mã này đã được dùng bởi hạng mục khác'
                      },
                    },
                  })}
                  placeholder="FINANCIAL"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.code && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.code.message}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lĩnh vực BSC <span className="text-red-500">*</span></label>
              <Controller
                name="fixedPerspective"
                control={control}
                rules={{ required: 'Vui lòng chọn lĩnh vực cho hạng mục' }}
                render={({ field }) => (
                  <Select
                    key={`${field.value ?? 'NONE'}-${(fixedPerspectives || []).length}`}
                    value={field.value ?? ''}
                    onValueChange={v => {
                      field.onChange(v)
                      // Đổi lĩnh vực là đổi luôn dãy thứ tự phải tránh trùng.
                      if (!perspective) setValue('displayOrder', nextOrderIn(v as BscFixedPerspective), { shouldValidate: true })
                    }}
                  >
                    <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none">
                      <SelectValue placeholder="Chọn 1 trong 4 lĩnh vực cố định" />
                    </SelectTrigger>
                    <SelectContent className={cn('rounded-xl border-slate-200 dark:border-slate-800', layerClass)}>
                      {(fixedPerspectives || []).map(fp => (
                        <SelectItem key={fp.code} value={fp.code} className="text-sm font-bold">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: fp.color }} />
                            {fp.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-[10px] font-medium text-slate-400 ml-1">Hạng mục này thuộc lĩnh vực nào trong 4 lĩnh vực cố định của bộ tiêu chí.</p>
              {errors.fixedPerspective && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.fixedPerspective.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả</label>
              <textarea
                {...register('description')}
                placeholder="Nhóm các chỉ tiêu liên quan..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className={cn('grid gap-4', showWeight ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thứ tự hiển thị <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  {...register('displayOrder', {
                    valueAsNumber: true,
                    validate: {
                      required: v => (v !== undefined && v !== null && !Number.isNaN(v)) || 'Vui lòng nhập thứ tự hiển thị',
                      integer: v => v == null || Number.isInteger(v) || 'Thứ tự phải là số nguyên',
                      min: v => v == null || v >= 0 || 'Thứ tự không được âm',
                      duplicate: v => {
                        if (v == null || Number.isNaN(v)) return true
                        // Thứ tự hiển thị chỉ cần duy nhất TRONG CÙNG 1 lĩnh vực.
                        const clash = (allPerspectives || []).some(p => p.displayOrder === v && p.fixedPerspective === selectedFixed && p.id !== perspective?.id)
                        return !clash || 'Thứ tự này đã được dùng bởi hạng mục khác trong cùng lĩnh vực'
                      },
                    },
                  })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.displayOrder && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.displayOrder.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Trạng thái</label>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-sm font-bold outline-none">
                        <SelectValue placeholder="Trạng thái" />
                      </SelectTrigger>
                      <SelectContent className={cn('rounded-xl border-slate-200 dark:border-slate-800', layerClass)}>
                        <SelectItem value={BscPerspectiveStatus.ACTIVE} className="text-sm font-bold text-emerald-600">Đang dùng</SelectItem>
                        <SelectItem value={BscPerspectiveStatus.INACTIVE} className="text-sm font-bold text-slate-500">Tạm ẩn</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {showWeight && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Scale size={11} /> Trọng số (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    {...register('weightPercentage', {
                      valueAsNumber: true,
                      // Bỏ trống = 0 (react-hook-form trả NaN), chỉ chặn số ngoài khoảng.
                      validate: {
                        range: v => v == null || Number.isNaN(v) || (v >= 0 && v <= 100) || 'Trọng số phải trong khoảng 0 – 100',
                      },
                    })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black text-right focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                  {errors.weightPercentage && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.weightPercentage.message}</p>}
                </div>
              )}
            </div>

            {showWeight && (
              <p className="text-[10px] font-medium text-slate-400 ml-1">
                Trọng số của hạng mục trong bộ tiêu chí đang mở — vẫn sửa lại được ở danh sách bên ngoài.
                {' '}Tổng sau khi lưu: <span className={cn('font-black', Math.abs(totalAfterSave - 100) <= 0.01 ? 'text-emerald-600' : 'text-amber-600')}>{totalAfterSave}%</span>.
                {missingWeight > 0 && (
                  <button
                    type="button"
                    onClick={() => setValue('weightPercentage', missingWeight, { shouldValidate: true })}
                    className="ml-1 font-black text-indigo-600 hover:text-indigo-700 underline underline-offset-2"
                  >
                    Dùng {missingWeight}% còn thiếu
                  </button>
                )}
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Màu sắc <span className="text-red-500">*</span></label>
              <input
                type="hidden"
                {...register('color', {
                  required: 'Vui lòng chọn màu sắc',
                  pattern: { value: /^#([0-9A-Fa-f]{6})$/, message: 'Màu không hợp lệ' },
                })}
              />
              <div className="flex flex-wrap gap-2 items-center">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setValue('color', color, { shouldValidate: true })}
                    className="w-8 h-8 rounded-lg transition-all"
                    style={{
                      backgroundColor: color,
                      outline: selectedColor === color ? `2px solid ${color}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                {/* Chọn màu tùy ý */}
                <label
                  className="w-8 h-8 rounded-lg cursor-pointer relative overflow-hidden border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center"
                  style={{
                    background: !PRESET_COLORS.includes(selectedColor || '') && /^#([0-9A-Fa-f]{6})$/.test(selectedColor || '')
                      ? selectedColor
                      : 'conic-gradient(#ef4444,#f59e0b,#10b981,#3b82f6,#8b5cf6,#ec4899,#ef4444)',
                    outline: !PRESET_COLORS.includes(selectedColor || '') && /^#([0-9A-Fa-f]{6})$/.test(selectedColor || '') ? `2px solid ${selectedColor}` : 'none',
                    outlineOffset: '2px',
                  }}
                  title="Chọn màu tùy ý"
                >
                  <Plus size={14} className="text-white drop-shadow" />
                  <input
                    type="color"
                    value={/^#([0-9A-Fa-f]{6})$/.test(selectedColor || '') ? selectedColor : PRESET_COLORS[0]}
                    onChange={e => setValue('color', e.target.value, { shouldValidate: true })}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </label>
                {/* Nhập mã hex */}
                <input
                  value={selectedColor || ''}
                  onChange={e => setValue('color', e.target.value, { shouldValidate: true })}
                  placeholder="#RRGGBB"
                  className="w-28 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              {errors.color && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.color.message}</p>}
            </div>
          </div>

          <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-[2] px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isPending && <Loader2 className="animate-spin" size={18} />}
              {perspective ? 'Lưu thay đổi' : 'Xác nhận tạo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
