import { useState } from 'react'
import { Award, Calculator, Loader2, Lock, PenLine, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import { cn } from '@/lib/utils'
import type { CycleUnitEvaluation } from '@/types/kpi'

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={busy ? undefined : onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto custom-scrollbar p-8 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-[18px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <Lock size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xl font-black text-slate-900 dark:text-white truncate">Chốt đánh giá phòng ban</h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">
              {summary.orgUnitName} · điểm sẽ được lưu snapshot
            </p>
          </div>
        </div>

        {/* ── Điểm sẽ chốt: một con số, nói rõ đang lấy từ đâu ── */}
        <div className={cn(
          'rounded-2xl border p-4 mb-4',
          'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700',
        )}>
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">Điểm đơn vị sẽ chốt</p>
              <div className="flex items-end gap-2">
                {willFinalize != null ? (
                  <>
                    <span className={cn('text-4xl font-black leading-none', getScoreColor(willFinalize))}>
                      {willFinalize}
                    </span>
                    <span className="text-[11px] font-black uppercase tracking-wide text-slate-400 pb-1">
                      {getScoreLabel(willFinalize)}
                    </span>
                  </>
                ) : (
                  <span className="text-4xl font-black leading-none text-slate-300 dark:text-slate-600">—</span>
                )}
              </div>
            </div>
            <span className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border whitespace-nowrap shrink-0',
              manual
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50'
                : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700',
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
          <div className="flex items-center gap-2.5 mb-5 px-4 py-3 rounded-2xl border"
            style={{
              backgroundColor: `${summary.classificationColor ?? '#64748b'}14`,
              borderColor: `${summary.classificationColor ?? '#64748b'}33`,
            }}>
            <Award size={16} style={{ color: summary.classificationColor ?? '#64748b' }} />
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
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
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Chấm tay cho đơn vị
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number" min={0} max={maxScore} step="0.1" value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder={auto != null ? String(auto) : '0'}
                    className="w-32 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-lg font-black outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50"
                  />
                  <span className="text-[11px] font-bold text-slate-400">/ {maxScore}</span>
                </div>
              </label>
              {manual && (
                <button
                  type="button"
                  onClick={() => { setScore(''); setReason('') }}
                  className="inline-flex items-center gap-2 h-12 px-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw size={14} /> Dùng TB {auto ?? '—'}
                </button>
              )}
            </div>

            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
              Để trống = chốt bằng trung bình điểm của {summary.memberCount} thành viên
              {auto != null ? ` (${auto})` : ''}.
              {isQualMode && ` Kỳ định tính: điểm quy về thang ${maxScore} (mức 5/5 ≈ ${maxScore} điểm).`}
            </p>

            {/* Chỉ hỏi lý do khi thật sự chấm tay — backend từ chối điểm không kèm lý do. */}
            {manual && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Lý do chấm khác TB <span className="text-red-500">*</span>
                </span>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  placeholder="VD: phòng đạt điểm cá nhân cao nhưng trượt mục tiêu doanh thu quý…"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 resize-y"
                />
              </label>
            )}

            {override != null && (summary.overriddenByName || summary.overriddenAt) && (
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">
                Điểm chấm tay hiện tại: {summary.overriddenByName}
                {summary.overriddenAt && ` · ${format(parseISO(summary.overriddenAt), 'HH:mm dd/MM/yyyy')}`}
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl bg-slate-50 dark:bg-slate-800/40 px-4 py-3 mb-5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            <Lock size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Không sửa được điểm đơn vị lúc này — sẽ chốt bằng trung bình thành viên.</span>
          </div>
        )}

        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nhận xét (tuỳ chọn)</label>
        <textarea
          value={comment} onChange={e => setComment(e.target.value)} rows={3}
          placeholder="Nhận xét tổng thể cho phòng ban trong kỳ..."
          className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 resize-none"
        />

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          >
            Huỷ
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            {busy && <Loader2 size={14} className="animate-spin" />}
            {busy ? 'Đang chốt...' : 'Xác nhận chốt'}
          </button>
        </div>
      </div>
    </div>
  )
}
