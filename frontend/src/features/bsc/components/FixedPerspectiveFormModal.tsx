import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { X, Compass, Loader2, Plus, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FixedPerspectiveResponse } from '../types'
import { useFixedPerspectiveMutations } from '../hooks/useBsc'
import { createFixedPerspectiveSchema, type FixedPerspectiveFormValues } from '../schemas/perspectiveSchema'

interface FixedPerspectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  fixedPerspective?: FixedPerspectiveResponse
  usedOrders?: number[]
  /** Đè z-index của lớp phủ khi modal này nằm trên một modal khác. */
  overlayClassName?: string
}

const PRESET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#0ea5e9', '#ec4899']

export default function FixedPerspectiveFormModal({
  isOpen, onClose, organizationId, fixedPerspective, usedOrders = [], overlayClassName,
}: FixedPerspectiveFormModalProps) {
  // Thứ tự đã bị lĩnh vực khác chiếm là dữ liệu động, nên schema dựng theo ngữ cảnh.
  const schema = useMemo(() => createFixedPerspectiveSchema(usedOrders), [usedOrders])

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<FixedPerspectiveFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', color: PRESET_COLORS[0], displayOrder: 0 },
  })

  const { updateFixedPerspective } = useFixedPerspectiveMutations()
  const selectedColor = watch('color')

  useEffect(() => {
    if (fixedPerspective) {
      reset({
        name: fixedPerspective.name,
        color: fixedPerspective.color || PRESET_COLORS[0],
        displayOrder: fixedPerspective.displayOrder,
      })
    }
  }, [fixedPerspective, reset, isOpen])

  const onSubmit = (data: FixedPerspectiveFormValues) => {
    if (!fixedPerspective) return
    updateFixedPerspective.mutate(
      { organizationId, code: fixedPerspective.code, data },
      { onSuccess: () => onClose() },
    )
  }

  if (!isOpen || !fixedPerspective) return null

  const isPending = updateFixedPerspective.isPending

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300', overlayClassName)}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none" style={{ backgroundColor: selectedColor || '#4f46e5' }}>
              <Compass size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Chỉnh sửa lĩnh vực</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BSC · Lĩnh vực cố định</p>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên lĩnh vực <span className="text-red-500">*</span></label>
                <input
                  {...register('name')}
                  placeholder="VD: Tài chính"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã</label>
                <div className="relative">
                  <input
                    value={fixedPerspective.code}
                    disabled
                    className="w-full px-4 py-2.5 pr-9 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-400 cursor-not-allowed outline-none"
                  />
                  <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
                <p className="text-[10px] font-medium text-slate-400 ml-1">Mã cố định, không sửa được.</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thứ tự hiển thị <span className="text-red-500">*</span></label>
              <input
                type="number"
                min={0}
                step={1}
                {...register('displayOrder', { valueAsNumber: true })}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
              />
              {errors.displayOrder && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.displayOrder.message}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Màu sắc <span className="text-red-500">*</span></label>
              <input
                type="hidden"
                {...register('color')}
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
              Lưu thay đổi
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
