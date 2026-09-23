import { useState } from 'react'
import { AlertTriangle, Award, CheckCircle2, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CycleUnitEvaluation } from '@/types/kpi'
import type { CalibrationPlan } from '../api/kpiCycleEvaluationApi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

/**
 * Bước 4 — KHOÁ KẾT QUẢ đánh giá kỳ của phòng ban.
 *
 * Hộp thoại này từng gộp cả ô chấm điểm đơn vị; phần đó đã dọn ra thẻ {@code UnitScoreCard}
 * ở bước 2 để khoá thật sự là bước cuối. Ở đây chỉ còn: con số sẽ chụp vào snapshot, xếp loại
 * đi kèm, tình trạng so với khung bell curve, và một ô nhận xét.
 *
 * Khung ở chế độ chặn mà còn vượt trần thì backend từ chối — nút xác nhận tắt luôn, khỏi bấm
 * rồi ăn lỗi. Chế độ cảnh báo thì vẫn khoá được nhưng phải nhìn thấy cảnh báo trước khi bấm.
 */
export default function FinalizeUnitDialog({
  summary, plan, onFinalize, onClose, getScoreColor, getScoreLabel,
}: {
  summary: CycleUnitEvaluation
  plan?: CalibrationPlan
  onFinalize: (comment: string) => Promise<unknown>
  onClose: () => void
  getScoreColor: (score: number) => string
  getScoreLabel: (score: number) => string
}) {
  const [comment, setComment] = useState(summary.comment ?? '')
  const [busy, setBusy] = useState(false)

  const score = summary.managerScore ?? null
  const blocked = !!plan?.blocked
  const offFrame = !!plan?.configured && !plan.withinFrame && !blocked

  const confirm = async () => {
    setBusy(true)
    try {
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
      title="Khoá kết quả đánh giá kỳ"
      description={`${summary.orgUnitName} · các con số dưới đây sẽ được chụp lại và khoá`}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={busy}>Huỷ</Button>}
          primary={
            <Button onClick={confirm} disabled={busy || blocked} title={blocked ? 'Còn mức vượt trần — hiệu chỉnh trước' : undefined}>
              {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Lock aria-hidden="true" />}
              {busy ? 'Đang khoá...' : 'Xác nhận khoá'}
            </Button>
          }
        />
      }
    >
      <div className="space-y-4">
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-eyebrow mb-1">Điểm đơn vị sẽ khoá</p>
              <div className="flex items-end gap-2">
                {score != null ? (
                  <>
                    <span className={cn('text-4xl font-semibold leading-none tabular-nums', getScoreColor(score))}>{score}</span>
                    <span className="text-eyebrow pb-1">{getScoreLabel(score)}</span>
                  </>
                ) : (
                  <span className="text-4xl font-semibold leading-none text-[var(--color-subtle-foreground)]">—</span>
                )}
              </div>
              <p className="text-caption mt-1">
                {summary.overrideScore != null
                  ? `Chấm tay (TB thành viên ${summary.autoScore ?? '—'})`
                  : `Trung bình ${summary.memberCount} thành viên`}
              </p>
            </div>
            {summary.classification && (
              <span
                className="text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-3 py-1.5"
                style={{
                  color: summary.classificationColor ?? undefined,
                  backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
                  borderColor: `${summary.classificationColor ?? '#64748b'}33`,
                }}
              >
                <Award size={12} /> Xếp loại {summary.classification}
              </span>
            )}
          </div>
        </div>

        {/* Tình trạng so với khung — thứ quyết định có khoá được không. */}
        {plan?.configured && (
          blocked ? (
            <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)]">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Khung "{plan.profileName}" đang chặn: còn mức vượt trần</p>
                <p className="text-xs">
                  {plan.slots.filter(s => s.over).map(s => `${s.level} ${s.currentCount}/${s.maxCount}`).join(' · ')}.
                  Áp dụng đề xuất hiệu chỉnh rồi khoá lại.
                </p>
              </div>
            </div>
          ) : offFrame ? (
            <div className="flex items-start gap-2.5 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Phân bố còn lệch khung "{plan.profileName}"</p>
                <p className="text-xs">
                  {plan.slots.filter(s => s.over || s.under)
                    .map(s => s.over ? `${s.level} vượt ${s.currentCount - s.maxCount}` : `${s.level} thiếu ${s.minCount - s.currentCount}`)
                    .join(' · ')}. Khung chỉ cảnh báo nên vẫn khoá được — hãy chắc là có chủ ý.
                </p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-success)]">
              <CheckCircle2 size={16} aria-hidden="true" /> Phân bố nằm trong khung "{plan.profileName}".
            </p>
          )
        )}

        <div>
          <label htmlFor="finalize-unit-comment" className="text-label">Nhận xét (tuỳ chọn)</label>
          <Textarea
            id="finalize-unit-comment"
            value={comment} onChange={e => setComment(e.target.value)} rows={3}
            placeholder="Nhận xét tổng thể cho phòng ban trong kỳ..."
            className="mt-2"
          />
        </div>

        <p className="text-caption leading-relaxed">
          Sau khi khoá, điểm kỳ cá nhân và điểm phòng không sửa được nữa; cấp trên sẽ thấy đơn vị này
          đã xong để duyệt tiếp. Cần sửa thì "Mở khoá" — đơn vị quay về bước hiệu chỉnh.
        </p>
      </div>
    </Dialog>
  )
}
