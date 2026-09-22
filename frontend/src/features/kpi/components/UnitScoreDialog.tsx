import { useState } from 'react'
import { Award, Calculator, Loader2, Lock, MessageSquare, PenLine, RotateCcw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CycleUnitEvaluation } from '@/types/kpi'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/**
 * Bước 2 của luồng đánh giá kỳ: CHẤM ĐIỂM PHÒNG BAN — mở từ nút "Chấm" trên dải bước.
 *
 * Từng là một thẻ nằm sẵn trên trang; nhưng 90% thời gian người ta chỉ cần biết phòng đang
 * mấy điểm (đã có ngay trên ô bước ②), còn việc chấm tay là chuyện làm một lần. Để thẻ nằm
 * đó chỉ tổ đẩy bảng nhân viên xuống dưới.
 *
 * Điểm nền là TRUNG BÌNH điểm chốt kỳ của thành viên. Nhập số KHÁC trung bình là chấm tay và
 * backend bắt buộc kèm lý do; nhập đúng bằng trung bình vẫn là chốt bằng TB.
 */
export default function UnitScoreDialog({
  summary, maxScore, isQualMode, canEdit, isSaving, onSave, onClose, getScoreColor, getScoreLabel,
}: {
  summary: CycleUnitEvaluation
  maxScore: number
  isQualMode: boolean
  canEdit: boolean
  isSaving: boolean
  onSave: (score: number | null, reason: string) => Promise<unknown>
  onClose: () => void
  getScoreColor: (score: number) => string
  getScoreLabel: (score: number) => string
}) {
  const auto = summary.autoScore ?? null
  const override = summary.overrideScore ?? null

  const [score, setScore] = useState(override != null ? String(override) : '')
  const [reason, setReason] = useState(summary.overrideReason ?? '')

  const trimmed = score.trim()
  const typed = trimmed !== '' ? Number(trimmed) : null
  const manual = typed != null && (!Number.isFinite(typed) || auto == null || typed !== auto)
  const parsed = manual ? typed : null
  const effective = manual ? (Number.isFinite(parsed) ? parsed : null) : auto
  const dirty = (manual ? parsed : null) !== override || (manual && reason.trim() !== (summary.overrideReason ?? ''))

  const save = async () => {
    if (manual) {
      if (parsed == null || !Number.isFinite(parsed)) { toast.error('Điểm đơn vị không hợp lệ'); return }
      if (parsed < 0 || parsed > maxScore) { toast.error(`Điểm đơn vị phải nằm trong khoảng 0 đến ${maxScore}`); return }
      if (!reason.trim()) { toast.error('Nhập lý do chấm điểm đơn vị khác trung bình thành viên'); return }
      await onSave(parsed, reason.trim())
    } else if (override != null) {
      await onSave(null, '')
    }
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!isSaving}
      title="Chấm điểm phòng ban"
      description={`${summary.orgUnitName} · TB ${summary.memberCount} thành viên là ${auto ?? '—'}`}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSaving}>Đóng</Button>}
          primary={canEdit && (
            <Button onClick={save} disabled={isSaving || !dirty}>
              {isSaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Lưu điểm phòng
            </Button>
          )}
        />
      }
    >
      <div className="space-y-4">
        {/* Con số sẽ có hiệu lực — đổi màu/nhãn theo từng phím gõ. */}
        <div className="flex flex-wrap items-end justify-between gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] p-4">
          <div>
            <p className="text-eyebrow mb-1">Điểm đơn vị</p>
            {effective != null ? (
              <span className="flex items-end gap-2">
                <span className={cn('text-4xl font-semibold leading-none tabular-nums', getScoreColor(effective))}>{effective}</span>
                <span className="text-eyebrow pb-1">{getScoreLabel(effective)}</span>
              </span>
            ) : (
              <span className="text-4xl font-semibold leading-none text-[var(--color-subtle-foreground)]">—</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn(
              'text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1',
              manual
                ? 'border-[var(--color-border)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-muted-foreground)]',
            )}>
              {manual ? <><PenLine size={12} /> Chấm tay</> : <><Calculator size={12} /> Trung bình</>}
            </span>
            {summary.classification && (
              <span
                className="text-eyebrow inline-flex items-center gap-1.5 whitespace-nowrap rounded-card border px-2.5 py-1"
                style={{
                  color: summary.classificationColor ?? undefined,
                  backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
                  borderColor: `${summary.classificationColor ?? '#64748b'}33`,
                }}
                title={summary.classificationProfileName ? `Hồ sơ: ${summary.classificationProfileName}` : undefined}
              >
                <Award size={12} /> {summary.classification}
              </span>
            )}
          </div>
        </div>

        {canEdit ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow">Chấm tay cho đơn vị</span>
                <Input
                  type="number" size="lg" min={0} max={maxScore} step={0.1} value={score}
                  onChange={e => setScore(e.target.value)}
                  onWheel={e => e.currentTarget.blur()}
                  placeholder={auto != null ? String(auto) : '0'}
                  suffix={<span className="text-sm">/ {maxScore}</span>}
                  className="w-36"
                  inputClassName="text-lg font-semibold tabular-nums"
                />
              </label>
              {trimmed !== '' ? (
                <Button variant="ghost" size="sm" type="button" className="h-10" onClick={() => { setScore(''); setReason('') }} title="Quay về trung bình thành viên">
                  <RotateCcw aria-hidden="true" /> Dùng TB {auto ?? '—'}
                </Button>
              ) : (
                <span className="pb-2.5 text-caption">Để trống = trung bình {auto ?? '—'}</span>
              )}
            </div>
            {typed != null && !manual && (
              <p className="text-caption">Bằng đúng trung bình ({auto}) — không cần lý do.</p>
            )}
            {isQualMode && <p className="text-caption">Kỳ định tính: mức 5/5 ≈ {maxScore} điểm.</p>}

            {manual && (
              <label className="flex flex-col gap-1.5">
                <span className="text-eyebrow">
                  Lý do chấm khác TB <span className="text-[var(--color-error)]">*</span>
                </span>
                <Textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="VD: phòng đạt điểm cá nhân cao nhưng trượt mục tiêu doanh thu quý…"
                />
              </label>
            )}
            {override != null && (summary.overriddenByName || summary.overriddenAt) && (
              <p className="text-caption">
                Đang chấm tay: {summary.overriddenByName}
                {summary.overriddenAt && ` · ${format(parseISO(summary.overriddenAt), 'HH:mm dd/MM/yyyy')}`}
              </p>
            )}
          </>
        ) : (
          <p className="flex items-start gap-2 text-caption">
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {summary.status === 'FINALIZED'
              ? 'Đã khoá kết quả — mở khoá nếu cần chấm lại điểm phòng.'
              : 'Bạn không sửa được điểm đơn vị lúc này.'}
            {override != null && summary.overrideReason && <span className="italic"> · Lý do: {summary.overrideReason}</span>}
          </p>
        )}

        {summary.comment && (
          <p className="flex items-start gap-2 border-t border-[var(--color-border)] pt-3 text-caption">
            <MessageSquare size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="italic">{summary.comment}</span>
          </p>
        )}
      </div>
    </Dialog>
  )
}
