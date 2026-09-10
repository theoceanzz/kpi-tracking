import { useState } from 'react'
import { X, Loader2, ShieldAlert, PenLine, Undo2 } from 'lucide-react'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import { useWaterfall, useOverrideMutation } from '../hooks/useBscCascade'
import { BscEmptyPerspectivePolicy } from '../types'

interface BscWaterfallModalProps {
  open: boolean
  onClose: () => void
  evaluationId: string | null
}

/** Lý do ghi đè: danh mục cố định để báo cáo gom nhóm được, kèm ô diễn giải tự do. */
const REASON_CODES = [
  { code: 'CALIBRATION', label: 'Hiệu chỉnh của hội đồng' },
  { code: 'SPECIAL_CONTRIBUTION', label: 'Đóng góp đặc biệt ngoài KPI' },
  { code: 'DATA_ISSUE', label: 'Số liệu nguồn sai/thiếu' },
  { code: 'NEW_JOINER', label: 'Nhân sự mới / nghỉ dài ngày' },
  { code: 'TRANSFER', label: 'Chuyển đơn vị giữa kỳ' },
  { code: 'OTHER', label: 'Lý do khác' },
]

const fmt = (v?: number | null, digits = 1) => (v == null ? '—' : v.toFixed(digits))

/**
 * Diễn giải đầy đủ điểm của một cá nhân — màn hình quyết định nhân viên có chấp nhận kết quả hay không.
 *
 * <p>Trình bày đúng thứ tự của mô hình: điểm gốc → cap 120 → điểm công nhận → ghi đè. Điểm cá nhân
 * KHÔNG bị nhân hệ số của phòng/công ty. Hạng mục chặn nằm TÁCH RIÊNG bên dưới vì nó không đụng vào
 * điểm, chỉ hạ trần xếp loại — vẽ nó như một bước trừ điểm là mô tả sai mô hình.
 */
export default function BscWaterfallModal({ open, onClose, evaluationId }: BscWaterfallModalProps) {
  const { data, isLoading } = useWaterfall(open && evaluationId ? evaluationId : undefined)
  const override = useOverrideMutation()
  const { hasPermission } = usePermission()
  const canOverride = hasPermission('BSC:OVERRIDE_SCORE')

  const [editing, setEditing] = useState(false)
  const [score, setScore] = useState<string>('')
  const [reasonCode, setReasonCode] = useState(REASON_CODES[0]!.code)
  const [comment, setComment] = useState('')

  if (!open) return null

  const submitOverride = () => {
    if (!evaluationId) return
    const value = score.trim() === '' ? null : Number(score)
    override.mutate(
      { evaluationId, data: { score: value, reasonCode, comment: comment.trim() || undefined } },
      { onSuccess: () => setEditing(false) },
    )
  }

  const clearOverride = () => {
    if (!evaluationId) return
    // Huỷ ghi đè vẫn phải có lý do — nó cũng là một quyết định làm đổi điểm đã công bố.
    override.mutate({ evaluationId, data: { score: null, reasonCode: 'OTHER', comment: 'Huỷ ghi đè' } })
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Diễn giải điểm BSC</h3>
            <p className="text-[11px] font-bold text-slate-400">
              {data?.userName || '—'}
              {data?.orgUnitName ? ` · ${data.orgUnitName}` : ''}
              {data?.kpiPeriodName ? ` · ${data.kpiPeriodName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar">
          {isLoading && (
            <div className="flex items-center justify-center py-10 text-slate-400">
              <Loader2 size={20} className="animate-spin" />
            </div>
          )}

          {data && (
            <>
              {/* Hạng mục rỗng là thứ hay làm người xem sốc nhất: làm đúng một hạng mục 25% mà
                  điểm gốc vẫn 150. Nói thẳng ra ngay trên đầu, trước cả chuỗi tính. */}
              {(() => {
                const empty = data.perspectives.filter(p => p.achievementPercent == null)
                if (empty.length === 0) return null
                const presentWeight = data.perspectives
                  .filter(p => p.achievementPercent != null)
                  .reduce((sum, p) => sum + (p.weightPercentage ?? 0), 0)
                const renormalize = data.emptyPerspectivePolicy !== BscEmptyPerspectivePolicy.ZERO_FILL
                return (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
                    <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 mb-1">
                      {empty.length} hạng mục chưa có KPI nào: {empty.map(p => p.name).join(', ')}
                    </p>
                    <p className="text-[11px] font-medium text-amber-700/80 dark:text-amber-400/80 leading-relaxed">
                      {renormalize
                        ? <>Bộ tiêu chí đang để <b>bỏ qua hạng mục rỗng</b>, nên điểm chỉ tính trên{' '}
                            <b>{fmt(presentWeight, 0)}%</b> trọng số có dữ liệu rồi quy về thang 100 — phần
                            trọng số của các hạng mục rỗng không kéo điểm xuống. Muốn hạng mục rỗng bị tính
                            0 điểm thì đổi chính sách sang <b>Tính 0 điểm</b> trong bộ tiêu chí.</>
                        : <>Bộ tiêu chí đang để <b>tính hạng mục rỗng bằng 0</b>, nên các hạng mục trên đã
                            kéo điểm xuống theo đúng trọng số của chúng.</>}
                    </p>
                  </div>
                )
              })()}

              {/* ── Chuỗi tính điểm ───────────────────────────── */}
              <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
                <Step
                  label="Điểm gốc của nhân viên"
                  value={fmt(data.rawBscScore)}
                  hint="Điểm BSC tính từ KPI cá nhân"
                />
                <Step
                  label={`Chặn trần ${fmt(data.recognizedCapPercent, 0)}`}
                  value={fmt(data.cappedScore)}
                  hint="Vượt trần thì cắt về trần"
                  muted={data.rawBscScore != null && data.cappedScore != null && data.rawBscScore <= data.cappedScore}
                />
                <Step
                  label="Điểm công nhận"
                  value={fmt(data.recognizedScore)}
                  hint="MIN(điểm gốc, trần) — kết quả BSC của phòng/công ty không nhân vào điểm cá nhân"
                  strong
                />
                {data.overrideScore != null && (
                  <Step
                    label="Điểm sau ghi đè"
                    value={fmt(data.overrideScore)}
                    hint={`${data.overrideReasonCode || ''}${data.overrideComment ? ` — ${data.overrideComment}` : ''}`
                      + (data.overriddenByName ? ` · ${data.overriddenByName}` : '')}
                    strong
                    accent="amber"
                  />
                )}
              </div>

              <div className="flex items-baseline justify-between px-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Điểm cuối</span>
                <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{fmt(data.finalScore)}</span>
              </div>

              {/* ── Hạng mục chặn: tách riêng, KHÔNG nằm trong chuỗi nhân ── */}
              <div className={cn('rounded-2xl border p-4',
                data.gatePassed === false
                  ? 'border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20'
                  : 'border-slate-100 dark:border-slate-800')}>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldAlert size={14} className={data.gatePassed === false ? 'text-red-500' : 'text-slate-400'} />
                  <span className="text-xs font-black text-slate-700 dark:text-slate-200">Hạng mục chặn</span>
                </div>
                {data.gatePassed === false ? (
                  <p className="text-[11px] font-bold text-red-600 dark:text-red-400">
                    Không đạt: {data.gateFailedItems}
                    {data.gateCapRating != null && (
                      <> · Trần xếp loại bị hạ xuống mức {data.gateCapRating}</>
                    )}
                    <span className="block mt-1 text-slate-500 dark:text-slate-400 font-medium">
                      Điểm số KHÔNG bị trừ — chỉ xếp loại bị giới hạn.
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] font-bold text-slate-400">
                    Không có hạng mục chặn nào bị trượt.
                  </p>
                )}
                {data.matrixRating != null && (
                  <p className="text-[11px] font-bold text-slate-400 mt-1">Xếp loại hiện tại: mức {data.matrixRating}</p>
                )}
              </div>

              {/* ── Ràng buộc trọng số liên kết BSC ───────────── */}
              {data.linkedWeightPercent != null && (
                <div className={cn('rounded-2xl border p-4 text-[11px] font-bold',
                  data.linkedWeightSatisfied === false
                    ? 'border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400'
                    : 'border-slate-100 text-slate-400 dark:border-slate-800')}>
                  Trọng số KPI liên kết BSC: {fmt(data.linkedWeightPercent, 0)}%
                  {data.linkedWeightRequired != null && <> / tối thiểu {fmt(data.linkedWeightRequired, 0)}%</>}
                  {data.linkedWeightSatisfied === false && (
                    <span className="block mt-0.5 font-medium">
                      Phần lớn KPI của người này chưa bám vào chỉ tiêu BSC của phòng.
                    </span>
                  )}
                </div>
              )}

              {/* ── Ghi đè thủ công ───────────────────────────── */}
              {canOverride && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 dark:text-slate-200">Ghi đè điểm</span>
                    {!editing && (
                      <div className="flex gap-1">
                        <button onClick={() => { setEditing(true); setScore(data.overrideScore?.toString() ?? '') }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                          <PenLine size={12} /> {data.overrideScore != null ? 'Sửa' : 'Ghi đè'}
                        </button>
                        {data.overrideScore != null && (
                          <button onClick={clearOverride} disabled={override.isPending}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            <Undo2 size={12} /> Huỷ ghi đè
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {editing && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-slate-400">
                        Ghi đè là hành vi ngoại lệ và phải giải trình được về sau, nên lý do là bắt buộc.
                      </p>
                      <div className="flex gap-2">
                        <input type="number" step="any" value={score} onChange={e => setScore(e.target.value)}
                          placeholder={fmt(data.recognizedScore)}
                          className="w-28 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-black outline-none" />
                        <Select value={reasonCode} onValueChange={setReasonCode}>
                          <SelectTrigger className="flex-1 h-[38px] rounded-xl px-3 text-xs font-bold bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-[1100]">
                            {REASON_CODES.map(r => <SelectItem key={r.code} value={r.code}>{r.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
                        placeholder="Diễn giải cụ thể..."
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-xs font-medium outline-none" />
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditing(false)}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-black text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                          Huỷ
                        </button>
                        <button onClick={submitOverride} disabled={override.isPending}
                          className="px-3 py-1.5 rounded-xl text-[11px] font-black bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                          {override.isPending ? 'Đang lưu...' : 'Lưu ghi đè'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Breakdown hạng mục ────────────────────────── */}
              {data.perspectives?.length > 0 && (
                <div className="rounded-2xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {data.perspectives.map(p => (
                    <div key={p.perspectiveId} className="flex items-center gap-3 px-4 py-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color || '#8b5cf6' }} />
                      <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                        {p.name}
                        {p.isGate && (
                          <span className={cn('ml-1.5 text-[9px] font-black uppercase',
                            p.gatePassed === false ? 'text-red-500' : 'text-slate-400')}>
                            · chặn
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{fmt(p.weightPercentage, 0)}%</span>
                      <span className={cn('w-24 text-right text-xs font-black',
                        p.achievementPercent == null
                          ? 'text-[10px] font-bold text-amber-500'
                          : 'text-slate-700 dark:text-slate-200')}>
                        {p.achievementPercent == null ? 'chưa có KPI' : fmt(p.achievementPercent)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Step({ label, value, hint, strong, muted, accent }: {
  label: string
  value: string
  hint?: string
  strong?: boolean
  muted?: boolean
  accent?: 'amber'
}) {
  return (
    <div className={cn('flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-slate-100 dark:border-slate-800',
      strong && 'bg-slate-50/70 dark:bg-slate-800/40',
      accent === 'amber' && 'bg-amber-50/60 dark:bg-amber-950/20',
      muted && 'opacity-60')}>
      <div className="flex-1 min-w-0">
        <p className={cn('text-xs truncate', strong ? 'font-black text-slate-800 dark:text-slate-100' : 'font-bold text-slate-600 dark:text-slate-300')}>
          {label}
        </p>
        {hint && <p className="text-[10px] font-medium text-slate-400 truncate">{hint}</p>}
      </div>
      <span className={cn('shrink-0 tabular-nums',
        strong ? 'text-base font-black text-slate-900 dark:text-white' : 'text-sm font-bold text-slate-700 dark:text-slate-200')}>
        {value}
      </span>
    </div>
  )
}
