import { useState, useMemo } from 'react'
import { cn, formatNumber } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import type { CycleUserEvaluation } from '@/types/kpi'
import { Search, Mail, Loader2, AlertTriangle, Check, FileSpreadsheet } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

/**
 * Chọn nhân viên để gửi kết quả đánh giá kỳ qua email.
 * Nội dung email lấy từ template `cycle_evaluation_result` — tổ chức tự chỉnh
 * được ở Cài đặt hệ thống → Template email.
 */
export default function SendEvaluationModal({
  onClose, members, cycleName, orgUnitName, isFinalized, isSending, onSend,
}: {
  onClose: () => void
  members: CycleUserEvaluation[]
  cycleName?: string
  orgUnitName?: string
  /** Chưa chốt kỳ thì điểm còn có thể đổi — cảnh báo trước khi gửi. */
  isFinalized: boolean
  isSending: boolean
  onSend: (userIds: string[]) => Promise<unknown>
}) {
  const { t } = useTranslation('kpi')
  // Component chỉ được mount khi modal mở (parent render có điều kiện), nên
  // lựa chọn tự reset mỗi lần mở — không cần effect dọn dẹp.
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? members.filter(m => m.userName?.toLowerCase().includes(q)) : members
  }, [members, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every(m => selected.has(m.userId))

  const toggle = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId); else next.add(userId)
      return next
    })
  }

  // "Chọn tất cả" chỉ tác động lên danh sách ĐANG lọc, để không âm thầm
  // chọn cả những người bị ẩn bởi ô tìm kiếm.
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(m => next.delete(m.userId))
      else filtered.forEach(m => next.add(m.userId))
      return next
    })
  }

  const handleSend = async () => {
    if (blockedByTour()) return
    if (!selected.size) return
    try {
      await onSend([...selected])
      onClose()
    } catch { /* toast ở hook */ }
  }

  return (
    <Dialog {...tourAnchor('send.dialog')}
      open
      onClose={onClose}
      size="lg"
      flush
      dismissible={!isSending}
      title={t('SendEvaluationModal.sendEvaluationResults')}
      description={<>{cycleName ? <b className="font-medium text-[var(--color-foreground)]">{cycleName}</b> : t('SendEvaluationModal.evaluationCycles')}{orgUnitName && <> · {orgUnitName}</>}</>}
      footer={
        <DialogFooter
          note={<span className="flex items-center gap-1.5"><FileSpreadsheet size={13} className="shrink-0" aria-hidden="true" /> {t('SendEvaluationModal.eachRecipientGetsAnExcelFile')}</span>}
          secondary={<Button variant="outline" onClick={onClose} disabled={isSending}>{t('SendEvaluationModal.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('send.submit')} onClick={handleSend} disabled={!selected.size || isSending}>
              {isSending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
              {isSending ? t('SendEvaluationModal.sending') : t('SendEvaluationModal.sendToPeople', { count: selected.size })}
            </Button>
          }
        />
      }
    >
      {!isFinalized && (
        <div className="flex items-start gap-2.5 mx-5 mt-4 p-3.5 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
          <AlertTriangle size={16} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
          <p className="text-xs text-[var(--color-warning)] font-medium leading-relaxed">
            {t('SendEvaluationModal.thisUnit')} <b>{t('SendEvaluationModal.cycleNotFinalized')}</b>{t('SendEvaluationModal.theScoresSentMayStillChange')}
          </p>
        </div>
      )}

      {/* Tìm kiếm + chọn tất cả */}
      <div {...tourAnchor('send.picker')} className="px-5 pt-4 pb-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('SendEvaluationModal.searchEmployees')}
            className="w-full pl-11 pr-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] outline-none transition-all placeholder:text-[var(--color-subtle-foreground)]"
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={toggleAll} disabled={!filtered.length}>
            <span className={cn(
              'w-4 h-4 rounded-control border-2 flex items-center justify-center transition-colors',
              allFilteredSelected ? 'bg-[var(--color-success-solid)] border-[var(--color-success-border)]' : 'border-[var(--color-border-strong)]',
            )}>
              {allFilteredSelected && <Check aria-hidden="true" className="text-white" strokeWidth={3} />}
            </span>
            {allFilteredSelected ? t('SendEvaluationModal.deselectAll') : t('SendEvaluationModal.selectAll')}
            {search.trim() && <span className="normal-case font-semibold opacity-60">{t('SendEvaluationModal.inSearchResults')}</span>}
          </Button>
          <span className="text-eyebrow whitespace-nowrap">
            {t('SendEvaluationModal.selected')} {selected.size}/{members.length}
          </span>
        </div>
      </div>

      {/* Danh sách */}
      <div {...tourAnchor('send.list')} className="px-5 pb-5">
        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--color-subtle-foreground)] italic text-center py-10">{t('SendEvaluationModal.noMatchingEmployeesFound')}</p>
        ) : (
          <div className="space-y-1">
            {filtered.map(m => {
              const checked = selected.has(m.userId)
              return (
                <button
                  key={m.userId}
                  onClick={() => toggle(m.userId)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-card border transition-all text-left',
                    checked
                      ? 'bg-[var(--color-success-bg)] border-[var(--color-success-border)]'
                      : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-[var(--color-muted)]',
                  )}
                >
                  <span className={cn(
                    'w-5 h-5 rounded-control border-2 flex items-center justify-center shrink-0 transition-colors',
                    checked ? 'bg-[var(--color-success-solid)] border-[var(--color-success-border)]' : 'border-[var(--color-border-strong)]',
                  )}>
                    {checked && <Check size={12} className="text-white" strokeWidth={3} />}
                  </span>
                  <UserAvatar
                    fullName={m.userName}
                    avatarUrl={m.userAvatarUrl}
                    className="w-9 h-9 rounded-card"
                    fallbackClassName="bg-[var(--color-primary-soft)] font-semibold text-xs text-[var(--color-primary)]"
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-foreground)] truncate">{m.userName}</span>
                    <span className="block text-caption font-medium truncate">{m.orgUnitName || t('SendEvaluationModal.employee')}</span>
                  </span>
                  <span className="text-sm font-semibold text-[var(--color-success)] shrink-0">
                    {m.finalScore != null ? formatNumber(m.finalScore) : '—'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>

    </Dialog>
  )
}
