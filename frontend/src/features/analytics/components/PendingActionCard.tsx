import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { aiApi, type PendingAction } from '../api/aiApi'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

interface Props {
  action: PendingAction
  /** Báo lại kết quả để khung chat chèn thành một lời của trợ lý. */
  onDone?: (text: string) => void
  /**
   * Lời mời này đã được chạy ở NƠI KHÁC — người dùng nhắn "xác nhận" vào khung chat thay vì bấm
   * nút. Thẻ tự khoá lại thay vì mời bấm một cái nút chắc chắn sẽ trả về "không còn hiệu lực".
   */
  consumed?: boolean
}

/** Nhãn tiếng Việt của từng loại việc, dùng cho câu cảnh báo. */
const KIND_LABEL = perLanguage((): Record<PendingAction['kind'], string> => ({
  SUBMISSION_REVIEW: i18n.t('analytics:PendingActionCard.submissions'),
  KPI_CRITERIA_REVIEW: i18n.t('analytics:PendingActionCard.kpis'),
  KPI_ADJUSTMENT_REVIEW: i18n.t('analytics:PendingActionCard.adjustmentRequests'),
  SEND_REMINDER: i18n.t('analytics:PendingActionCard.reminders'),
  KPI_SUBMIT: i18n.t('analytics:PendingActionCard.kpisSubmittedForApproval'),
  REWARD_GRANT_REVIEW: i18n.t('analytics:PendingActionCard.rewardProposals'),
  CYCLE_FINALIZE: i18n.t('analytics:PendingActionCard.evaluationPeriodsFinalize'),
  CYCLE_REOPEN: i18n.t('analytics:PendingActionCard.evaluationPeriodsReopen'),
  CYCLE_SEND: i18n.t('analytics:PendingActionCard.evaluationPeriodsSendResults'),
  KPI_DECOMPOSE: i18n.t('analytics:PendingActionCard.childUnitsReceivingTheKpi'),
}))

/**
 * Thẻ xác nhận một thao tác GHI do trợ lý đề nghị.
 *
 * <p>Cùng khuôn với {@link FormPatchPreview}: hiện trước từng mục, cho bỏ chọn, rồi mới cho bấm.
 * Khác ở hai chỗ, và cả hai đều quan trọng:
 * <ul>
 *   <li>bấm xong thì <b>backend ghi thật</b> (form patch chỉ điền vào ô, người dùng còn phải tự
 *       bấm Lưu) — nên màu và chữ ở đây phải nói rõ mức độ, không dùng lại tông tím nhẹ nhàng;</li>
 *   <li>việc này <b>không có nút hoàn tác</b>, nên danh sách phải nêu đủ tên và số liệu để người
 *       dùng thẩm định được, chứ không chỉ đếm "3 mục".</li>
 * </ul>
 *
 * <p>Bấm một lần là xong: backend tiêu mất lời mời sau lần xác nhận đầu, nên thẻ tự khoá lại thay
 * vì để người dùng bấm lần hai rồi nhận câu "không còn hiệu lực".
 */
export default function PendingActionCard({ action, onDone, consumed }: Props) {
  const { t } = useTranslation('analytics')
  const [skipped, setSkipped] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const chosen = useMemo(
    () => action.items.filter(i => !skipped.has(i.id)),
    [action.items, skipped],
  )

  const isReject = action.decision === 'REJECT'
  const what = KIND_LABEL()[action.kind]

  const toggle = (id: string) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const run = async () => {
    if (busy || chosen.length === 0) return
    setBusy(true)
    try {
      // Gửi danh sách đã chọn kể cả khi chọn hết: backend vẫn lọc theo lời mời gốc, và gửi tường
      // minh thì hành vi giống nhau ở mọi trường hợp.
      const res = await aiApi.confirmAction(action.id, chosen.map(i => i.id))
      setResult(res.text)
      onDone?.(res.text)
      if (res.failed > 0) toast.warning(t('PendingActionCard.itemsDoneItemsCouldNotBe', { succeeded: res.succeeded, failed: res.failed }))
      else toast.success(res.text)
    } catch (e) {
      const message =
        getApiErrorMessage(e, t('PendingActionCard.couldNotCompleteItPleaseTry'))
      setResult(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  // Đã chạy ở lượt sau bằng cách nhắn "xác nhận": nói rõ là xong rồi, và KHÔNG còn nút để bấm.
  if (consumed && !result) {
    return (
      <div className="mt-2 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-sm">
        <div className="flex items-start gap-1.5 text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('PendingActionCard.confirmedViaMessageSeeTheResult')}</span>
        </div>
      </div>
    )
  }

  if (result) {
    return (
      <div className="mt-2 w-full rounded-control border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3 text-sm dark:border-[var(--color-success-border)] dark:bg-[var(--color-success-bg)]">
        <div className="flex items-start gap-1.5 text-[var(--color-success)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="whitespace-pre-line">{result}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 w-full rounded-control border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3 dark:border-[var(--color-warning-border)] dark:bg-[var(--color-warning-bg)]">
      <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)]">
        <ShieldCheck className="h-4 w-4" />
        {action.title}
      </div>

      <p className="mb-2 flex items-start gap-1.5 text-xs text-[var(--color-warning)]">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {t('PendingActionCard.thisAction')} {isReject ? t('PendingActionCard.rejects') : t('PendingActionCard.changes')} {t('PendingActionCard.realDataAnd')}{' '}
          <strong>{t('PendingActionCard.cannotBeUndone')}</strong>{t('PendingActionCard.pleaseReviewTheListBeforeConfirming')}
        </span>
      </p>

      <ul className="space-y-1.5">
        {action.items.map(item => {
          const off = skipped.has(item.id)
          return (
            <li key={item.id}>
              <label className="text-label flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={!off}
                  disabled={busy}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--color-warning-solid)]"
                />
                <span className={off ? 'opacity-40' : undefined}>
                  <span className="font-medium text-[var(--color-foreground)]">{item.label}</span>
                  {item.detail && (
                    <span className="text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]"> — {item.detail}</span>
                  )}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {action.note && (
        <p className="mt-2 text-xs italic text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">
          {t('PendingActionCard.theNoteWillBeSavedWith')} {action.note}
        </p>
      )}

      <button
        type="button"
        onClick={run}
        disabled={busy || chosen.length === 0}
        className={`mt-2.5 rounded-control px-3 py-1.5 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
          isReject ? 'bg-[var(--color-error-solid)] hover:bg-[var(--color-error-solid)]' : 'bg-[var(--color-warning-solid)] hover:bg-[var(--color-warning-solid)]'
        }`}
      >
        {busy
          ? t('PendingActionCard.working')
          : t('PendingActionCard.confirm', { value: isReject ? t('PendingActionCard.reject') : '', length: chosen.length, what }).replace(/\s+/g, ' ')}
      </button>
    </div>
  )
}
