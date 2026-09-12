import { useState } from 'react'
import { Award, Calculator, Loader2, Lock, PenLine, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CycleUnitEvaluation } from '@/types/kpi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

/**
 * Hộp thoại "Chốt đánh giá phòng ban" — gộp luôn phần chấm điểm cho CẢ ĐƠN VỊ.
 *
 * Trước đây điểm đơn vị là một thẻ riêng nằm giữa trang, có nút "Lưu điểm đơn vị" của
 * riêng nó. Nhưng hai việc luôn đi cùng một nhịp: quyết định phòng được mấy điểm rồi chốt.
 * Tách làm hai chỗ chỉ khiến người chốt phải nhớ bấm lưu trước khi bấm chốt — quên là chốt
 * bằng trung bình.
 *
 * Điểm nền vẫn là TRUNG BÌNH điểm chốt kỳ của thành viên: để trống ô nhập nghĩa là chốt
 * bằng trung bình đó. Nhập số vào là chấm tay, và backend BẮT BUỘC kèm lý do
 * (KpiCycleEvaluationService.saveUnitScore).
 */
export default function FinalizeUnitDialog({
  summary, maxScore, isQualMode, canScoreUnit,
  onSaveUnitScore, onFinalize, onClose,
  getScoreColor, getScoreLabel,
}: {
  summary: CycleUnitEvaluation
  maxScore: number
  isQualMode: boolean
  /** Đơn vị cha đã chốt ⇒ chỉ còn chốt được, không sửa điểm nữa. */
  canScoreUnit: boolean
  onSaveUnitScore: (score: number | null, reason: string) => Promise<unknown>
  onFinalize: (comment: string) => Promise<unknown>
  onClose: () => void
  getScoreColor: (score: number) => string
  getScoreLabel: (score: number) => string
}) {
  const auto = summary.autoScore ?? null
  const override = summary.overrideScore ?? null

  const [score, setScore] = useState(override != null ? String(override) : '')
  const [reason, setReason] = useState(summary.overrideReason ?? '')
  const [comment, setComment] = useState(summary.comment ?? '')
  const [busy, setBusy] = useState(false)

  const trimmed = score.trim()
  const manual = trimmed !== ''
  const parsed = manual ? Number(trimmed) : null
  // Con số sẽ đi vào bản chụp: người chốt phải thấy nó trước khi bấm, không phải suy ra.
  const willFinalize = manual ? (Number.isFinite(parsed) ? parsed : null) : auto

  const confirm = async () => {
    if (manual) {
      if (parsed == null || !Number.isFinite(parsed)) {
        toast.error('Điểm đơn vị không hợp lệ')
        return
      }
      if (parsed < 0 || parsed > maxScore) {
        toast.error(`Điểm đơn vị phải nằm trong khoảng 0 đến ${maxScore}`)
        return
      }
      if (!reason.trim()) {
        toast.error('Nhập lý do chấm điểm đơn vị khác trung bình thành viên')
        return
      }
    }
    setBusy(true)
    try {
      // Lưu điểm TRƯỚC rồi mới chốt: chốt là chụp lại số đang có, chụp xong mới sửa thì bản
      // chụp mang số cũ — mà backend cũng chặn sửa điểm sau khi đã chốt.
      if (canScoreUnit) {
        if (manual) await onSaveUnitScore(parsed, reason.trim())
        else if (override != null) await onSaveUnitScore(null, '')
      }
      await onFinalize(comment)
      onClose()
    } catch {
      /* toast đã hiện trong hook */
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      title="Chốt đánh giá phòng ban"
      description={`${summary.orgUnitName} · điểm sẽ được lưu snapshot`}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>Huỷ</Button>}
          primary={
            <Button onClick={confirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              {busy ? 'Đang chốt...' : 'Xác nhận chốt'}
            </Button>
          }
        />
      }
    >
    {/* ── Điểm sẽ chốt: một con số, nói rõ đang lấy từ đâu ── */}
    <div className={cn(
      'rounded-card border p-4 mb-4',
      'bg-[var(--color-muted)] border-[var(--color-border)]',
    )}>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-eyebrow mb-1">Điểm đơn vị sẽ chốt</p>
          <div className="flex items-end gap-2">
            {willFinalize != null ? (
              <>
                <span className={cn('text-4xl font-semibold leading-none', getScoreColor(willFinalize))}>
                  {willFinalize}
                </span>
                <span className="text-eyebrow pb-1">
                  {getScoreLabel(willFinalize)}
                </span>
              </>
            ) : (
              <span className="text-4xl font-semibold leading-none text-[var(--color-subtle-foreground)]">—</span>
            )}
          </div>
        </div>
        <span className={cn(
          'text-eyebrow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border whitespace-nowrap shrink-0',
          manual
            ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)] border-[var(--color-border)]'
            : 'bg-[var(--color-card)] text-[var(--color-muted-foreground)] border-[var(--color-border)]',
        )}>
          {manual
            ? <><PenLine size={12} /> Chấm tay</>
            : <><Calculator size={12} /> TB {summary.memberCount} thành viên</>}
        </span>
      </div>
    </div>

    {/* Xếp loại cũng bị khoá theo, nên phải nói trước khi bấm chứ không để người dùng
        phát hiện sau lúc sửa luật mà con số không đổi. */}
    {summary.classification && (
      <div className="flex items-center gap-2.5 mb-5 px-4 py-3 rounded-card border"
        style={{
          backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
          borderColor: `${summary.classificationColor ?? '#64748b'}33`,
        }}>
        <Award size={16} style={{ color: summary.classificationColor ?? '#64748b' }} />
        <p className="text-caption">
          Xếp loại đơn vị{' '}
          <b style={{ color: summary.classificationColor ?? '#64748b' }}>{summary.classification}</b>
          {' '}sẽ được chụp lại cùng điểm.
        </p>
      </div>
    )}

    {canScoreUnit ? (
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-eyebrow">
              Chấm tay cho đơn vị
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} max={maxScore} step="0.1" value={score}
                onChange={e => setScore(e.target.value)}
                placeholder={auto != null ? String(auto) : '0'}
                className="w-32 h-12 px-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-lg font-semibold outline-none focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)]"
              />
              <span className="text-caption">/ {maxScore}</span>
            </div>
          </label>
          {manual && (
            <Button variant="outline" type="button" onClick={() => { setScore(''); setReason('') }}>
              <RotateCcw aria-hidden="true" /> Dùng TB {auto ?? '—'}
            </Button>
          )}
        </div>

        <p className="text-caption leading-relaxed">
          Để trống = chốt bằng trung bình điểm của {summary.memberCount} thành viên
          {auto != null ? ` (${auto})` : ''}.
          {isQualMode && ` Kỳ định tính: điểm quy về thang ${maxScore} (mức 5/5 ≈ ${maxScore} điểm).`}
        </p>

        {/* Chỉ hỏi lý do khi thật sự chấm tay — backend từ chối điểm không kèm lý do. */}
        {manual && (
          <label className="flex flex-col gap-1.5">
            <span className="text-eyebrow">
              Lý do chấm khác TB <span className="text-[var(--color-error)]">*</span>
            </span>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder="VD: phòng đạt điểm cá nhân cao nhưng trượt mục tiêu doanh thu quý…"
              className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-success-solid)] focus:border-[var(--color-success-border)] resize-y"
            />
          </label>
        )}

        {override != null && (summary.overriddenByName || summary.overriddenAt) && (
          <p className="text-caption leading-relaxed">
            Điểm chấm tay hiện tại: {summary.overriddenByName}
            {summary.overriddenAt && ` · ${format(parseISO(summary.overriddenAt), 'HH:mm dd/MM/yyyy')}`}
          </p>
        )}
      </div>
    ) : (
      <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)] px-4 py-3 mb-5 text-caption">
        <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>Không sửa được điểm đơn vị lúc này — sẽ chốt bằng trung bình thành viên.</span>
      </div>
    )}

    <label className="text-label">Nhận xét (tuỳ chọn)</label>
    <textarea
      value={comment} onChange={e => setComment(e.target.value)} rows={3}
      placeholder="Nhận xét tổng thể cho phòng ban trong kỳ..."
      className="w-full mt-2 px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-success-solid)] resize-none"
    />

    </Dialog>
  )
}
