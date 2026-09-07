import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, X, Gift, Upload, ImageOff, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { giftApi } from '../api/giftApi'
import { useGiftsManage } from '../hooks/useGifts'
import { giftSchema, numOrUndefined, type GiftFormData } from '../schemas/giftSchema'
import { GiftItemStatus, type GiftItem } from '../types'

interface GiftFormModalProps {
  open: boolean
  onClose: () => void
  editGift?: GiftItem | null
}

export default function GiftFormModal({ open, onClose, editGift }: GiftFormModalProps) {
  const isEdit = !!editGift
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<GiftFormData>({
    resolver: zodResolver(giftSchema),
    defaultValues: {
      name: '', description: '', imageUrl: '', pointCost: undefined,
      unlimitedStock: false, stockQuantity: undefined, active: true, requiresDelivery: true,
    },
  })

  // Ảnh và hai lựa chọn dạng thẻ không phải ô nhập nên đọc/ghi qua watch + setValue.
  const imageUrl = watch('imageUrl')
  const unlimitedStock = watch('unlimitedStock')
  const requiresDelivery = watch('requiresDelivery')

  const { createGift, updateGift, isCreating, isUpdating } = useGiftsManage()

  useEffect(() => {
    if (!open) return
    reset({
      name: editGift?.name ?? '',
      description: editGift?.description ?? '',
      imageUrl: editGift?.imageUrl ?? '',
      pointCost: editGift?.pointCost ?? undefined,
      unlimitedStock: editGift?.unlimitedStock ?? false,
      stockQuantity: editGift?.stockQuantity ?? undefined,
      active: (editGift?.status ?? GiftItemStatus.ACTIVE) === GiftItemStatus.ACTIVE,
      requiresDelivery: editGift?.requiresDelivery ?? true,
    })
  }, [open, editGift, reset])

  if (!open) return null

  const handleUpload = async (file: File) => {
    // Kiểm ngay ở client để người dùng biết liền, backend vẫn kiểm lại vì đó mới là
    // ranh giới đáng tin.
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận tệp ảnh')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB')
      return
    }
    setUploading(true)
    try {
      setValue('imageUrl', await giftApi.uploadImage(file), { shouldValidate: true })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Tải ảnh thất bại')
    } finally {
      setUploading(false)
    }
  }

  const onSubmit = async (data: GiftFormData) => {
    const payload = {
      name: data.name.trim(),
      description: data.description.trim() || undefined,
      imageUrl: data.imageUrl || undefined,
      pointCost: data.pointCost,
      unlimitedStock: data.unlimitedStock,
      requiresDelivery: data.requiresDelivery,
      stockQuantity: data.unlimitedStock ? null : (data.stockQuantity ?? 0),
      status: data.active ? GiftItemStatus.ACTIVE : GiftItemStatus.INACTIVE,
    }
    if (isEdit && editGift) {
      await updateGift({ id: editGift.id, data: payload })
    } else {
      await createGift(payload)
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
            <Gift size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">{isEdit ? 'Sửa quà tặng' : 'Thêm quà tặng'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Giải thích trước cái gì ảnh hưởng và cái gì không: giá/tên đã được chụp
              snapshot lúc nhân viên đặt nên sửa không đụng tới yêu cầu đang chờ, còn
              tồn kho thì bị khoá vì số hiện tại đã trừ sẵn phần giữ chỗ. */}
          {isEdit && !!editGift?.pendingRedemptionCount && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
              <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              <span>
                Đang có <b>{editGift.pendingRedemptionCount} yêu cầu đổi chờ xử lý</b>. Sửa tên hay
                giá điểm không ảnh hưởng tới các yêu cầu đó (đã chốt lúc nhân viên đặt), nhưng{' '}
                <b>tồn kho tạm thời không sửa được</b> vì số hiện tại đã trừ sẵn phần giữ chỗ.
              </span>
            </div>
          )}

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-muted)]">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--color-muted-foreground)]">
                    <ImageOff size={22} />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 size={20} className="animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="mt-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-[var(--color-border)] py-1.5 text-xs"
                >
                  <Upload size={13} />
                  Tải ảnh
                </button>
                {imageUrl && (
                  <button
                    type="button"
                    onClick={() => setValue('imageUrl', '')}
                    className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleUpload(f)
                  e.target.value = ''
                }}
              />
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tên quà</label>
                <input
                  {...register('name')}
                  placeholder="Ví dụ: Voucher cà phê 100.000đ"
                  className={inputCls}
                />
                {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mô tả</label>
                <textarea {...register('description')} rows={2} className={inputCls} />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Số điểm để đổi</label>
              <input
                type="number"
                min={1}
                {...register('pointCost', { setValueAs: numOrUndefined })}
                className={inputCls}
              />
              {errors.pointCost && <p className="mt-1 text-xs text-rose-600">{errors.pointCost.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tồn kho</label>
              <input
                type="number"
                min={0}
                disabled={unlimitedStock || !!editGift?.pendingRedemptionCount}
                placeholder={unlimitedStock ? 'Không giới hạn' : '0'}
                {...register('stockQuantity', { setValueAs: numOrUndefined })}
                className={`${inputCls} disabled:opacity-50`}
              />
              {errors.stockQuantity && <p className="mt-1 text-xs text-rose-600">{errors.stockQuantity.message}</p>}
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register('unlimitedStock')}
              className="rounded border-[var(--color-border)]"
            />
            Không giới hạn số lượng
            <span className="text-xs text-[var(--color-muted-foreground)]">
              (dùng cho voucher điện tử, quà cấp phát không hạn chế)
            </span>
          </label>

          {/* Quyết định luồng sau khi nhân viên đổi: cần trao tay thì có bước "đã giao",
              nhận ngay thì hoàn tất luôn, không tạo việc cho ai. */}
          <div>
            <label className="mb-2 block text-sm font-medium">Cách nhận quà</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setValue('requiresDelivery', true)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  requiresDelivery
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="font-medium">Cần trao tay</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Áo, cốc, voucher giấy… Yêu cầu nằm ở tab chờ giao tới khi có người đánh
                  dấu đã trao.
                </div>
              </button>
              <button
                type="button"
                onClick={() => setValue('requiresDelivery', false)}
                className={`rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  !requiresDelivery
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                    : 'border-[var(--color-border)]'
                }`}
              >
                <div className="font-medium">Nhận ngay</div>
                <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                  Ngày nghỉ phép, quyền lợi tự động… Đổi xong là hoàn tất, không ai phải xử lý.
                </div>
              </button>
            </div>
            {!requiresDelivery && (
              <p className="mt-2 text-xs text-amber-700">
                Nhân viên sẽ thấy “đã nhận” ngay lập tức — chỉ chọn khi quà thực sự đến tay họ
                mà không cần ai làm gì.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              {...register('active')}
              className="rounded border-[var(--color-border)]"
            />
            Đang bày bán
            <span className="text-xs text-[var(--color-muted-foreground)]">
              (tắt để ẩn khỏi cửa hàng mà không xoá)
            </span>
          </label>
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
            disabled={isCreating || isUpdating || uploading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {(isCreating || isUpdating) && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Lưu' : 'Thêm quà'}
          </button>
        </div>
      </div>
    </div>
  )
}
