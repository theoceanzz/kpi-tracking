import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { X, Layers, Loader2, Plus } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PerspectiveRequest, PerspectiveResponse, BscPerspectiveStatus } from '../types'
import { useBscMutations, useBscPerspectives } from '../hooks/useBsc'

interface PerspectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  perspective?: PerspectiveResponse
}

const PRESET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#0ea5e9', '#ec4899']

export default function PerspectiveFormModal({ isOpen, onClose, organizationId, perspective }: PerspectiveFormModalProps) {
  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<PerspectiveRequest>({
    defaultValues: {
      code: '',
      name: '',
      description: '',
      color: PRESET_COLORS[0],
      displayOrder: 0,
      status: BscPerspectiveStatus.ACTIVE,
    },
  })

  const { createPerspective, updatePerspective } = useBscMutations()
  const { data: allPerspectives } = useBscPerspectives(organizationId)
  const selectedColor = watch('color')

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
      })
    } else {
      reset({
        code: '',
        name: '',
        description: '',
        color: PRESET_COLORS[0],
        displayOrder: 0,
        status: BscPerspectiveStatus.ACTIVE,
      })
    }
  }, [perspective, reset, isOpen])

  const onSubmit = (data: PerspectiveRequest) => {
    if (perspective) {
      updatePerspective.mutate({ perspectiveId: perspective.id, data }, { onSuccess: () => onClose() })
    } else {
      createPerspective.mutate({ organizationId, data }, { onSuccess: () => { onClose(); reset() } })
    }
  }

  if (!isOpen) return null

  const isPending = createPerspective.isPending || updatePerspective.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-950/20 dark:to-slate-900">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
              <Layers size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{perspective ? 'Chỉnh sửa viễn cảnh' : 'Tạo viễn cảnh mới'}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">BSC Perspective</p>
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
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên viễn cảnh</label>
                <input
                  {...register('name', { required: 'Vui lòng nhập tên viễn cảnh' })}
                  placeholder="VD: Tài chính"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-bold focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
                {errors.name && <p className="text-[10px] font-bold text-red-500 ml-1">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mã</label>
                <input
                  {...register('code', {
                    required: 'Vui lòng nhập mã',
                    maxLength: { value: 50, message: 'Mã tối đa 50 ký tự' },
                    pattern: {
                      value: /^[A-Za-z0-9_]+$/,
                      message: 'Mã chỉ gồm chữ, số và dấu gạch dưới (không dấu cách, không tiếng Việt)',
                    },
                    validate: {
                      duplicate: v => {
                        if (!v) return true
                        const clash = (allPerspectives || []).some(p => p.code?.toLowerCase() === v.trim().toLowerCase() && p.id !== perspective?.id)
                        return !clash || 'Mã này đã được dùng bởi viễn cảnh khác'
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
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mô tả</label>
              <textarea
                {...register('description')}
                placeholder="Nhóm các chỉ tiêu liên quan..."
                rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-medium focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Thứ tự hiển thị</label>
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
                        const clash = (allPerspectives || []).some(p => p.displayOrder === v && p.id !== perspective?.id)
                        return !clash || 'Thứ tự này đã được dùng bởi viễn cảnh khác'
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
                      <SelectContent className="rounded-xl border-slate-200 dark:border-slate-800">
                        <SelectItem value={BscPerspectiveStatus.ACTIVE} className="text-sm font-bold text-emerald-600">Đang dùng</SelectItem>
                        <SelectItem value={BscPerspectiveStatus.INACTIVE} className="text-sm font-bold text-slate-500">Tạm ẩn</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Màu sắc</label>
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
