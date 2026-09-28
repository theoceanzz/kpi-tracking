import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resolveEventSchema, type ResolveEventFormData } from '../schemas/reconcileSchema'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import EmployeePicker from '@/features/rewards/components/EmployeePicker'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useReconcileActions } from '../hooks/useWallet'
import { SepayResolveMode, type SepayEvent } from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

interface ResolveEventModalProps {
  event: SepayEvent | null
  onClose: () => void
}

const MODES = perLanguage((): { key: SepayResolveMode; label: string; hint: string }[] => ([
  {
    key: SepayResolveMode.MATCH_ORDER,
    label: i18n.t('wallet:ResolveEventModal.assignToTopUpOrder'),
    hint: i18n.t('wallet:ResolveEventModal.theUserEnteredTheWrongTransfer'),
  },
  {
    key: SepayResolveMode.CREDIT_USER,
    label: i18n.t('wallet:ResolveEventModal.creditTheUser'),
    hint: i18n.t('wallet:ResolveEventModal.cannotBeTracedToAnyOrder'),
  },
  {
    key: SepayResolveMode.IGNORE,
    label: i18n.t('wallet:ResolveEventModal.skip'),
    hint: i18n.t('wallet:ResolveEventModal.notAWalletTopUpOr'),
  },
]))

export default function ResolveEventModal({ event, onClose }: ResolveEventModalProps) {
  const { t } = useTranslation('wallet')
  const formApi = useForm<ResolveEventFormData>({
    resolver: zodResolver(resolveEventSchema()),
    defaultValues: { mode: SepayResolveMode.CREDIT_USER, orderId: '', user: null, note: '' },
  })
  const { register, handleSubmit, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `wallet-resolve:${event?.id ?? ''}`, enabled: !!event })

  // Cách xử lý chọn bằng thẻ bấm, người ghi có chọn bằng EmployeePicker.
  const mode = watch('mode')
  const user = watch('user')

  const { resolveEvent, isResolving } = useReconcileActions()

  if (!event) return null

  const needsUser = mode === SepayResolveMode.CREDIT_USER
  const needsOrder = mode === SepayResolveMode.MATCH_ORDER

  const onSubmit = async (data: ResolveEventFormData) => {
    await resolveEvent({
      id: event.id,
      data: {
        mode: data.mode,
        note: data.note.trim(),
        ...(needsOrder ? { orderId: data.orderId.trim() } : {}),
        ...(needsUser && data.user ? { userId: data.user.id } : {}),
      },
    })
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isResolving}
      title={t('ResolveEventModal.handleSepayTransaction')}
      description={t('ResolveEventModal.transaction', { sepayId: event.sepayId, receivedAt: formatDateTime(event.receivedAt) })}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isResolving}>{t('ResolveEventModal.close')}</Button>}
          primary={
            <Button onClick={handleSubmit(onSubmit)} disabled={isResolving}>
              {isResolving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('ResolveEventModal.confirmHandling')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      {/* Thông điệp của hệ thống chính là hướng dẫn chọn cách xử lý ở nhiều
          trường hợp, nên đặt lên đầu chứ không giấu dưới bảng. */}
      {event.errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
          <span>{event.errorMessage}</span>
        </div>
      )}

      <div className="mb-4 rounded-card border border-[var(--color-border)] px-4 py-3 text-sm">
        <div className="flex justify-between gap-3 py-1">
          <span className="text-[var(--color-muted-foreground)]">{t('ResolveEventModal.amountActuallyReceived')}</span>
          <strong className="tabular-nums">{formatCurrency(event.transferAmount ?? 0)}</strong>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <span className="text-[var(--color-muted-foreground)]">{t('ResolveEventModal.description')}</span>
          <span className="max-w-[60%] truncate text-right">{event.content || '—'}</span>
        </div>
        <div className="flex justify-between gap-3 py-1">
          <span className="text-[var(--color-muted-foreground)]">{t('ResolveEventModal.bank')}</span>
          <span>{event.gateway || '—'}</span>
        </div>
      </div>

      {/* KHÔNG có ô nhập số tiền: hệ thống luôn ghi có đúng số thực nhận. Một ô
          tự do sẽ phá chính sách đó ở đúng chỗ dễ gõ nhầm nhất. */}
      <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
        {t('ResolveEventModal.theCreditedAmountAlwaysEqualsExactly')}
      </p>

      <label className="text-label mb-1.5 block font-medium">{t('ResolveEventModal.howToHandle')}</label>
      <div className="mb-4 space-y-2">
        {MODES().map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setValue('mode', m.key, { shouldValidate: true })}
            className={`w-full rounded-card border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              mode === m.key
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                : 'border-[var(--color-border)] hover:bg-[var(--color-muted)]/40'
            }`}
          >
            <div className="text-sm font-semibold">{m.label}</div>
            <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              {m.hint}
            </div>
          </button>
        ))}
      </div>

      {needsOrder && (
        <div className="mb-4">
          <label className="text-label mb-1.5 block font-medium">{t('ResolveEventModal.topUpOrderIdentifier')}</label>
          <input
            {...register('orderId')}
            placeholder={t('ResolveEventModal.pasteTheIdOfTheTop')}
            className="w-full rounded-card border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
          />
          {errors.orderId && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.orderId.message}</p>}
        </div>
      )}

      {needsUser && (
        <div className="mb-4">
          <label className="text-label mb-1.5 block font-medium">{t('ResolveEventModal.personToCredit')}</label>
          {user ? (
            <div className="flex items-center justify-between gap-3 rounded-card border border-[var(--color-border)] px-4 py-2.5">
              <span className="truncate text-sm font-semibold">{user.fullName}</span>
              <Button variant="ghost" size="sm" type="button" onClick={() => setValue('user', null, { shouldValidate: true })}>
                {t('ResolveEventModal.change')}
              </Button>
            </div>
          ) : (
            <EmployeePicker selectedIds={[]} onPick={u => setValue('user', u, { shouldValidate: true })} />
          )}
          {errors.user && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.user.message}</p>}
        </div>
      )}

      <label className="text-label mb-1.5 block font-medium">
        {t('ResolveEventModal.handlingNotes')} <span className="text-[var(--color-error)]">*</span>
      </label>
      <textarea
        {...register('note')}
        rows={3}
        placeholder={t('ResolveEventModal.whyItWasHandledThisWay')}
        className="w-full rounded-card border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
      {errors.note && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.note.message}</p>}

    </Dialog>
  )
}
