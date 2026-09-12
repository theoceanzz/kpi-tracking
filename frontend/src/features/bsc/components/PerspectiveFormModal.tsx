import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Plus, Scale, Target } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { PerspectiveResponse, BscPerspectiveStatus, BscFixedPerspective } from '../types'
import { useBscMutations, useBscPerspectives, useFixedPerspectives } from '../hooks/useBsc'
import {
  createPerspectiveSchema,
  numOrNull,
  numOrUndefined,
  type PerspectiveFormValues,
} from '../schemas/perspectiveSchema'
import { useCodeRule } from '@/features/orgunits/hooks/useCodeRules'
import CodeField from '@/components/common/CodeField'

interface PerspectiveFormModalProps {
  isOpen: boolean
  onClose: () => void
  organizationId: string
  perspective?: PerspectiveResponse
  /** Chọn sẵn lĩnh vực khi tạo — dùng khi mở từ đúng nhóm lĩnh vực trong bộ tiêu chí. */
  defaultFixedPerspective?: BscFixedPerspective
  /** Đè z-index của lớp phủ khi modal này nằm trên một modal khác. */
  /** Hiện thêm ô trọng số % — dùng khi mở từ modal bộ tiêu chí. */
  showWeight?: boolean
  /** Trọng số khởi tạo: trọng số hiện tại khi sửa, thường là 0 khi tạo mới. */
  defaultWeight?: number
  /** Tổng trọng số các hạng mục đang bật KHÔNG tính hạng mục này — để gợi ý phần còn thiếu. */
  otherWeightTotal?: number
  /** Gọi sau khi lưu để bộ tiêu chí áp trọng số vừa nhập cho hạng mục. */
  onWeightSubmit?: (perspectiveId: string, weight: number) => void
}

const PRESET_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#6366f1', '#0ea5e9', '#ec4899']

export default function PerspectiveFormModal({
  isOpen, onClose, organizationId, perspective, defaultFixedPerspective,
  showWeight, defaultWeight = 0, otherWeightTotal = 0, onWeightSubmit,
}: PerspectiveFormModalProps) {
  const { data: allPerspectives } = useBscPerspectives(organizationId)

  // Ràng buộc trùng mã / trùng thứ tự phải đối chiếu danh sách hiện có, nên schema dựng lại
  // mỗi khi danh sách đổi (react-hook-form đọc resolver mới ở mỗi lần render).
  // Mã hạng mục do tổ chức quyết định: tự sinh (ô mã khoá lại) hay nhập tay như trước.
  const codeRule = useCodeRule('BSC_PERSPECTIVE', organizationId)

  const schema = useMemo(
    () => createPerspectiveSchema({
      existing: allPerspectives || [],
      currentId: perspective?.id,
      requireCode: !codeRule.optional,
    }),
    [allPerspectives, perspective?.id, codeRule.optional],
  )

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors } } = useForm<PerspectiveFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      description: '',
      color: PRESET_COLORS[0],
      targetValue: undefined,
      minimumValue: undefined,
      unit: '',
      displayOrder: 0,
      status: BscPerspectiveStatus.ACTIVE,
      fixedPerspective: undefined,
      weightPercentage: 0,
    },
  })

  const { createPerspective, updatePerspective } = useBscMutations()
  const { data: fixedPerspectives } = useFixedPerspectives()
  const selectedColor = watch('color')
  const weightValue = watch('weightPercentage')

  const targetValue = watch('targetValue')
  const minimumValue = watch('minimumValue')
  const unitValue = watch('unit')
  // Có mục tiêu > 0 ⇒ backend chuyển hạng mục sang cách chấm kiểu OKR; giữ đúng một điều kiện ở hai phía.
  const hasOwnTarget = numOrNull(targetValue) != null && Number(targetValue) > 0
  const unitLabel = unitValue ? ` ${unitValue}` : ''
  const minimumLabel = numOrNull(minimumValue) != null
    ? `, và = 0 nếu tổng thực đạt dưới ${minimumValue}${unitLabel}`
    : ''

  // Phần còn thiếu để bộ tiêu chí đủ 100% (đã trừ các hạng mục khác đang bật).
  const round1 = (n: number) => Math.round(n * 10) / 10
  const missingWeight = round1(Math.max(0, 100 - otherWeightTotal))
  const totalAfterSave = round1(otherWeightTotal + (Number(weightValue) || 0))

  // Select/Popover của Radix portal thẳng ra <body> với z-50 cố định. Khi modal này được
  // đẩy lên z-[60] (nằm trên modal bộ tiêu chí) thì danh sách chọn rơi xuống DƯỚI lớp phủ —
  // nhìn như dropdown bấm không mở. Nâng theo cùng nhịp với lớp phủ.

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
        targetValue: perspective.targetValue ?? undefined,
        minimumValue: perspective.minimumValue ?? undefined,
        unit: perspective.unit ?? '',
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
        targetValue: undefined,
        minimumValue: undefined,
        unit: '',
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
    // Ô mã bị khoá ⇒ không gửi mã lên: backend giữ mã cũ khi sửa, tự cấp mã khi tạo.
    if (codeRule.locked) data.code = undefined
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

  const isPending = createPerspective.isPending || updatePerspective.isPending

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      size="md"
      dismissible={!isPending}
      title={perspective ? 'Chỉnh sửa hạng mục' : 'Tạo hạng mục mới'}
      description="BSC · Hạng mục"
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isPending}>Hủy</Button>}
          primary={
            <Button type="submit" form="perspective-form" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {perspective ? 'Lưu thay đổi' : 'Xác nhận tạo'}
            </Button>
          }
        />
      }
    >
      <form id="perspective-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-label">Tên hạng mục <span className="text-[var(--color-error)]">*</span></label>
            <input
              {...register('name')}
              placeholder="VD: Công tác giảng dạy"
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.name && <p className="text-caption text-[var(--color-error)]">{errors.name.message}</p>}
          </div>
          <CodeField
            rule={codeRule}
            currentCode={perspective?.code}
            error={errors.code?.message}
            register={register('code')}
            fallbackPlaceholder="GIANG_DAY"
            tone="indigo"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-label">Lĩnh vực BSC <span className="text-[var(--color-error)]">*</span></label>
          <Controller
            name="fixedPerspective"
            control={control}
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
                <SelectTrigger className="w-full h-10 rounded-card bg-[var(--color-muted)] border-[var(--color-border)] text-sm font-medium outline-none">
                  <SelectValue placeholder="Chọn 1 trong 4 lĩnh vực cố định" />
                </SelectTrigger>
                <SelectContent className={'z-[1100]'}>
                  {(fixedPerspectives || []).map(fp => (
                    <SelectItem key={fp.code} value={fp.code} className="text-sm font-medium">
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
          <p className="text-caption ml-1">Hạng mục này thuộc lĩnh vực nào trong 4 lĩnh vực cố định của bộ tiêu chí.</p>
          {errors.fixedPerspective && <p className="text-caption text-[var(--color-error)]">{errors.fixedPerspective.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-label">Mô tả</label>
          <textarea
            {...register('description')}
            placeholder="Nhóm các chỉ tiêu liên quan..."
            rows={2}
            className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-label ml-1 flex items-end gap-1 min-h-[26px] leading-tight">
              <Target size={11} className="mb-[1px] shrink-0" /> Mục tiêu mong muốn <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="number"
              step="any"
              min={0}
              onWheel={e => (e.target as HTMLInputElement).blur()}
              {...register('targetValue', { setValueAs: numOrNull })}
              placeholder="VD: 100"
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.targetValue && <p className="text-caption text-[var(--color-error)]">{errors.targetValue.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-label ml-1 flex items-end gap-1 min-h-[26px] leading-tight">
              <Target size={11} className="mb-[1px] shrink-0" /> Kết quả tối thiểu <span className="text-[var(--color-error)]">*</span>
            </label>
            <input
              type="number"
              step="any"
              min={0}
              onWheel={e => (e.target as HTMLInputElement).blur()}
              {...register('minimumValue', { setValueAs: numOrNull })}
              placeholder="VD: 80"
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.minimumValue && <p className="text-caption text-[var(--color-error)]">{errors.minimumValue.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-label ml-1 flex items-end gap-1 min-h-[26px] leading-tight">Đơn vị tính <span className="text-[var(--color-error)]">*</span></label>
            <input
              {...register('unit')}
              placeholder="VNĐ, %, buổi..."
              className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
            />
            {errors.unit && <p className="text-caption text-[var(--color-error)]">{errors.unit.message}</p>}
          </div>
        </div>
        <div className={cn('p-3 rounded-card border text-xs font-medium leading-relaxed',
          hasOwnTarget
            ? 'bg-[var(--color-primary-soft)] border-[var(--color-border)] text-[var(--color-primary)]'
            : 'bg-[var(--color-muted)] border-[var(--color-border)] text-[var(--color-muted-foreground)]')}>
          {hasOwnTarget ? (
            <>
              <b>Hạng mục này tự chấm theo mục tiêu của chính nó (kiểu OKR).</b> Điểm hạng mục ={' '}
              tổng giá trị thực đạt của các KPI <b>định lượng</b> trong hạng mục ÷ {targetValue}
              {unitLabel} × 100 (trần 150%){minimumLabel}. KPI định tính trong hạng mục không tham gia phép cộng này —
              hãy đảm bảo các KPI cùng đơn vị tính.
            </>
          ) : (
            <>Bỏ trống mục tiêu ⇒ hạng mục chấm như cũ: trung bình có trọng số tỉ lệ đạt của các KPI con.
              Điền mục tiêu ⇒ hạng mục tự chấm theo mục tiêu của chính nó giống OKR.</>
          )}
        </div>

        <div className={cn('grid gap-4', showWeight ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2')}>
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
            <label className="text-label">Trạng thái</label>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full h-10 rounded-card bg-[var(--color-muted)] border-[var(--color-border)] text-sm font-medium outline-none">
                    <SelectValue placeholder="Trạng thái" />
                  </SelectTrigger>
                  <SelectContent className={'z-[1100]'}>
                    <SelectItem value={BscPerspectiveStatus.ACTIVE} className="text-sm font-medium text-[var(--color-success)]">Đang dùng</SelectItem>
                    <SelectItem value={BscPerspectiveStatus.INACTIVE} className="text-sm font-medium text-[var(--color-muted-foreground)]">Tạm ẩn</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {showWeight && (
            <div className="space-y-1.5">
              <label className="text-label ml-1 flex items-center gap-1">
                <Scale size={11} /> Trọng số (%)
              </label>
              {/* Bỏ trống = 0 khi gửi, nên map về undefined để schema cho qua thay vì báo NaN. */}
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                {...register('weightPercentage', { setValueAs: numOrUndefined })}
                className="w-full px-4 py-2.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)] text-sm font-semibold text-right focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] outline-none transition-all"
              />
              {errors.weightPercentage && <p className="text-caption text-[var(--color-error)]">{errors.weightPercentage.message}</p>}
            </div>
          )}
        </div>

        {showWeight && (
          <p className="text-caption ml-1">
            Trọng số của hạng mục trong bộ tiêu chí đang mở — vẫn sửa lại được ở danh sách bên ngoài.
            {' '}Tổng sau khi lưu: <span className={cn('font-semibold', Math.abs(totalAfterSave - 100) <= 0.01 ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>{totalAfterSave}%</span>.
            {missingWeight > 0 && (
              <Button variant="ghost" className="ml-1" type="button" onClick={() => setValue('weightPercentage', missingWeight, { shouldValidate: true })}>
                Dùng {missingWeight}% còn thiếu
              </Button>
            )}
          </p>
        )}

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
