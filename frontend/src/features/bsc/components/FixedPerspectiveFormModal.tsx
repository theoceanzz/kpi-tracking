import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Lock } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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
}

const PRESET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#0ea5e9', '#ec4899']

export default function FixedPerspectiveFormModal({
  isOpen, onClose, organizationId, fixedPerspective, usedOrders = [],
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
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title={'Chỉnh sửa lĩnh vực'}
      description="BSC · Lĩnh vực cố định"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="fixed-perspective-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {'Lưu thay đổi'}
            </Button>
          }
        />
      }
    >
      <form id="fixed-perspective-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-label">Tên lĩnh vực <span className="text-[var(--color-error)]">*</span></label>
            <input
              {...register('name')}
              placeholder="VD: Tài chính"
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.name && <p className="text-caption text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-label">Mã</label>
            <div className="relative">
              <input
                value={fixedPerspective.code}
                disabled
                className="w-full px-4 py-2.5 pr-9 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium text-[var(--color-subtle-foreground)] cursor-not-allowed outline-none"
              />
              <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" />
            </div>
            <p className="text-caption ml-1">Mã cố định, không sửa được.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-label">Thứ tự hiển thị <span className="text-[var(--color-error)]">*</span></label>
          <input
            type="number"
            min={0}
            step={1}
            {...register('displayOrder', { valueAsNumber: true })}
            className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
          />
          {errors.displayOrder && <p className="text-caption text-[var(--color-error)]">{errors.displayOrder.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-label">Màu sắc <span className="text-[var(--color-error)]">*</span></label>
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
                className="w-8 h-8 rounded-control transition-all"
                style={{
                  backgroundColor: color,
                  outline: selectedColor === color ? `2px solid ${color}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
            {/* Chọn màu tùy ý */}
            <label
              className="w-8 h-8 rounded-control cursor-pointer relative overflow-hidden border border-dashed border-[var(--color-border-strong)] flex items-center justify-center"
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
              className="w-28 px-3 py-1.5 rounded-control bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
            />
          </div>
          {errors.color && <p className="text-caption text-[var(--color-error)]">{errors.color.message}</p>}
        </div>
      </form>
    </Dialog>
  )
}
