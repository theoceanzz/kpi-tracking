import { LocaleNumberInput } from '@/components/ui/number-input'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, ImageOff, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { giftApi } from '../api/giftApi'
import { useGiftsManage } from '../hooks/useGifts'
import { giftSchema, numOrUndefined, type GiftFormData } from '../schemas/giftSchema'
import { GiftItemStatus, type GiftItem } from '../types'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

interface GiftFormModalProps {
  open: boolean
  onClose: () => void
  editGift?: GiftItem | null
}

export default function GiftFormModal({ open, onClose, editGift }: GiftFormModalProps) {
  const { t } = useTranslation('rewards')
  const isEdit = !!editGift
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)

  const formApi = useForm<GiftFormData>({
    resolver: zodResolver(giftSchema()),
    defaultValues: {
      name: '', description: '', imageUrl: '', pointCost: undefined,
      unlimitedStock: false, stockQuantity: undefined, active: true, requiresDelivery: true,
    },
  })
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `reward-gift:${editGift?.id ?? 'new'}`, enabled: open })

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
      toast.error(t('GiftFormModal.onlyImageFilesAreAccepted'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('GiftFormModal.theImageMustNotExceed5mb'))
      return
    }
    setUploading(true)
    try {
      setValue('imageUrl', await giftApi.uploadImage(file), { shouldValidate: true })
    } catch (e: any) {
      toast.error(getApiErrorMessage(e, t('GiftFormModal.imageUploadFailed')))
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
    'w-full rounded-control border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm'

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!(isCreating || isUpdating || uploading)}
      title={isEdit ? t('GiftFormModal.editGift') : t('GiftFormModal.addGift')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isCreating || isUpdating}>{t('GiftFormModal.cancel')}</Button>}
          primary={
            <Button onClick={handleSubmit(onSubmit)} disabled={isCreating || isUpdating || uploading}>
              {(isCreating || isUpdating) && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isEdit ? t('GiftFormModal.save') : t('GiftFormModal.addGift2')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {/* Giải thích trước cái gì ảnh hưởng và cái gì không: giá/tên đã được chụp
            snapshot lúc nhân viên đặt nên sửa không đụng tới yêu cầu đang chờ, còn
            tồn kho thì bị khoá vì số hiện tại đã trừ sẵn phần giữ chỗ. */}
        {isEdit && !!editGift?.pendingRedemptionCount && (
          <div className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
            <span>
              {t('GiftFormModal.thereAre')} <b>{editGift.pendingRedemptionCount} {t('GiftFormModal.pendingRedemptionRequests')}</b>{t('GiftFormModal.changingTheNameOrPointPrice')}{' '}
              <b>{t('GiftFormModal.stockTemporarilyCannotBeEdited')}</b> {t('GiftFormModal.becauseTheCurrentNumberAlreadyHas')}
            </span>
          </div>
        )}

        <div className="flex gap-4">
          <div className="flex-shrink-0">
            <div className="relative h-28 w-28 overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]">
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
              <Button variant="outline" size="sm" className="flex-1" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload aria-hidden="true" />
                {t('GiftFormModal.uploadImage')}
              </Button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setValue('imageUrl', '')}
                  className="rounded-control border border-[var(--color-border)] px-2 py-1.5 text-[var(--color-error)]"
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
              <label className="text-label mb-1.5 block font-medium">{t('GiftFormModal.giftName')}</label>
              <input
                {...register('name')}
                placeholder={t('GiftFormModal.eG100000VndCoffee')}
                className={inputCls}
              />
              {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-label mb-1.5 block font-medium">{t('GiftFormModal.description')}</label>
              <textarea {...register('description')} rows={2} className={inputCls} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-label mb-1.5 block font-medium">{t('GiftFormModal.pointsToRedeem')}</label>
            <LocaleNumberInput
              type="number"
              min={1}
              {...register('pointCost', { setValueAs: numOrUndefined })}
              className={inputCls}
            />
            {errors.pointCost && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.pointCost.message}</p>}
          </div>
          <div>
            <label className="text-label mb-1.5 block font-medium">{t('GiftFormModal.stock')}</label>
            <LocaleNumberInput
              type="number"
              min={0}
              disabled={unlimitedStock || !!editGift?.pendingRedemptionCount}
              placeholder={unlimitedStock ? t('GiftFormModal.unlimited') : '0'}
              {...register('stockQuantity', { setValueAs: numOrUndefined })}
              className={`${inputCls} disabled:opacity-50`}
            />
            {errors.stockQuantity && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.stockQuantity.message}</p>}
          </div>
        </div>

        <label className="text-label flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            {...register('unlimitedStock')}
            className="rounded border-[var(--color-border)]"
          />
          {t('GiftFormModal.unlimitedQuantity')}
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('GiftFormModal.forEVouchersAndGiftsIssued')}
          </span>
        </label>

        {/* Quyết định luồng sau khi nhân viên đổi: cần trao tay thì có bước "đã giao",
            nhận ngay thì hoàn tất luôn, không tạo việc cho ai. */}
        <div>
          <label className="text-label mb-2 block font-medium">{t('GiftFormModal.howTheGiftIsReceived')}</label>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setValue('requiresDelivery', true)}
              className={`rounded-card border px-4 py-3 text-left text-sm transition-colors ${
                requiresDelivery
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-medium">{t('GiftFormModal.handedOverInPerson')}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {t('GiftFormModal.tShirtsMugsPaperVouchersThe')}
              </div>
            </button>
            <button
              type="button"
              onClick={() => setValue('requiresDelivery', false)}
              className={`rounded-card border px-4 py-3 text-left text-sm transition-colors ${
                !requiresDelivery
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="font-medium">{t('GiftFormModal.receivedInstantly')}</div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {t('GiftFormModal.daysOffAutomaticBenefitsDoneAs')}
              </div>
            </button>
          </div>
          {!requiresDelivery && (
            <p className="mt-2 text-xs text-[var(--color-warning)]">
              {t('GiftFormModal.employeesWillSeeReceivedImmediatelyOnly')}
            </p>
          )}
        </div>

        <label className="text-label flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            {...register('active')}
            className="rounded border-[var(--color-border)]"
          />
          {t('GiftFormModal.onSale')}
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {t('GiftFormModal.turnOffToHideFromThe')}
          </span>
        </label>
      </div>
    </Dialog>
  )
}
