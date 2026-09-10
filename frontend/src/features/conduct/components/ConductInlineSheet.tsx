import {
  useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type Ref,
} from 'react'
import {
  Check, ChevronDown, FileSpreadsheet, HeartHandshake, Info, Loader2, Lock, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ConductScoreInput, ConductSheet, ConductTarget } from '../api/conductApi'
import { exportConductSheetToExcel } from '../utils/conductSheetExport'
import { useConductSheet } from '../hooks/useConduct'
import { fmt, num, useConductDraft, weighted } from '../hooks/useConductDraft'

/**
 * Phiếu hạnh kiểm nhúng thẳng vào modal chấm đợt và modal chốt kỳ — chấm người nào thì
 * chấm luôn hạnh kiểm của người đó, không phải sang màn khác chọn lại đợt/kỳ và đơn vị.
 *
 * Vì thế phiếu ở đây xếp DỌC (mỗi tiêu chí một thẻ) chứ không dùng bảng chín cột như
 * trang "Hạnh kiểm của tôi": bảng đó rộng 1100px, nhét vào modal thì phải cuộn ngang
 * trong khi đang cuộn dọc. Cách tính điểm vẫn dùng chung useConductDraft nên hai hình
 * dạng không bao giờ ra hai con số.
 *
 * Phiếu chỉ vẽ ĐÚNG phía mà người đang mở được chấm. Nhân viên tự đánh giá thì không
 * phải nhìn nửa màn hình ô "cán bộ quản lý" xám ngắt, còn quản lý chấm thì thấy điểm
 * nhân viên tự chấm dưới dạng một dòng tham chiếu gọn. Chỉ khi một người vừa được tự
 * chấm vừa được chấm quản lý mới hiện cả hai khối.
 */

type Side = 'self' | 'manager'

/**
 * Cho form bọc ngoài lưu hộ phiếu. Modal tự đánh giá có sẵn nút "Gửi đánh giá" nên phiếu
 * không cần nút lưu riêng: form gọi `save()` trước khi gửi, lưu hỏng thì ném lỗi để form
 * dừng lại (toast lỗi đã hiện sẵn từ hook).
 */
export interface ConductSheetHandle {
  save: () => Promise<void>
}

export default function ConductInlineSheet({
  target, userId, className, hideActions, onLiveScore, ref,
}: {
  target: ConductTarget
  /** Bỏ trống = phiếu của chính mình. */
  userId?: string
  className?: string
  /** Ẩn cả hàng nút (lưu và xuất Excel) — dùng khi form bọc ngoài đã lưu hộ qua `ref`. */
  hideActions?: boolean
  /**
   * Báo ra tổng điểm ĐANG gõ của phía người này chấm, mỗi lần nó đổi. Form bọc ngoài dùng
   * để cập nhật xếp loại tại chỗ — không có nút lưu riêng thì không còn nhịp nào làm mới
   * score-preview cho tới lúc chốt.
   */
  onLiveScore?: (total: number | null, max: number) => void
  ref?: Ref<ConductSheetHandle>
}) {
  const {
    data: sheet, isLoading,
    saveSelf, isSavingSelf, saveManager, isSavingManager,
    saveSelfAsync, saveManagerAsync,
  } = useConductSheet(target, userId)

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-3 p-5 rounded-[28px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30', className)}>
        <Loader2 size={16} className="animate-spin text-indigo-500" />
        <span className="text-xs font-bold text-slate-400">Đang tải phiếu hạnh kiểm…</span>
      </div>
    )
  }

  if (!sheet) return null

  return (
    <InlineSheet
      sheet={sheet}
      className={className}
      hideActions={hideActions}
      onLiveScore={onLiveScore}
      // Phiếu của chính mình thì không có nút xuất Excel: người tự chấm không xuất file
      // phiếu của mình giữa lúc đang tự đánh giá, và trang "Hạnh kiểm của tôi" vẫn xuất
      // được. Phiếu của người khác (quản lý mở ra chấm) thì giữ — trừ khi form bọc ngoài
      // đã dọn sạch hàng nút.
      showExport={!!userId && !hideActions}
      handleRef={ref}
      onSaveSelf={saveSelf}
      onSaveManager={saveManager}
      onSaveSelfAsync={saveSelfAsync}
      onSaveManagerAsync={saveManagerAsync}
      isSavingSelf={isSavingSelf}
      isSavingManager={isSavingManager}
    />
  )
}

function InlineSheet({
  sheet, className, hideActions, showExport, handleRef, onLiveScore,
  onSaveSelf, onSaveManager, onSaveSelfAsync, onSaveManagerAsync, isSavingSelf, isSavingManager,
}: {
  sheet: ConductSheet
  className?: string
  hideActions?: boolean
  showExport?: boolean
  handleRef?: Ref<ConductSheetHandle>
  onLiveScore?: (total: number | null, max: number) => void
  onSaveSelf: (items: ConductScoreInput[]) => void
  onSaveManager: (payload: { items: ConductScoreInput[]; comment?: string | null }) => void
  onSaveSelfAsync: (items: ConductScoreInput[]) => Promise<unknown>
  onSaveManagerAsync: (payload: { items: ConductScoreInput[]; comment?: string | null }) => Promise<unknown>
  isSavingSelf?: boolean
  isSavingManager?: boolean
}) {
  // Nháp nằm ở đây (không phải trong phần thân gập được) để đầu phiếu hiện điểm ĐANG gõ:
  // gập lại vẫn theo dõi được mình đang ở mấy điểm.
  const { rowOf, set, comment, setComment, totals, totalWeight, dirty, collect, exportRows } =
    useConductDraft(sheet)

  // Form bọc ngoài lưu hộ: chỉ gọi API khi phiếu có thay đổi, và lưu đúng phía người này
  // được chấm. Lỗi để nguyên cho form bắt — nó phải dừng, không gửi đánh giá tiếp.
  useImperativeHandle(handleRef, () => ({
    save: async () => {
      if (!dirty) return
      if (sheet.canScoreSelf) await onSaveSelfAsync(collect('self'))
      if (sheet.canScoreManager) await onSaveManagerAsync({ items: collect('manager'), comment })
    },
  }))

  // Mở sẵn khi còn phải chấm, gập lại khi đã chấm xong — modal vốn đã dài, không nên
  // bắt người dùng cuộn qua một phiếu đã xong để tới nút lưu.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const open = manualOpen ?? sheet.status !== 'REVIEWED'

  const max = sheet.maxScore
  const dual = sheet.canScoreSelf && sheet.canScoreManager
  /** Phía người đang mở phiếu chấm — quyết định khối nào có ô nhập, khối nào chỉ để xem. */
  const side: Side = sheet.canScoreManager ? 'manager' : 'self'
  const editable = sheet.canScoreSelf || sheet.canScoreManager

  // Tiến độ tính trên đúng phía người này phải chấm: "2/5" là thứ họ cần biết còn mấy ô
  // nữa mới xong, chứ không phải tổng số ô của cả phiếu.
  const done = sheet.items.filter(i => {
    const d = rowOf(i.position)
    return num(side === 'manager' ? d.managerScore : d.selfScore) != null
  }).length
  const myTotal = side === 'manager' ? totals.manager : totals.self
  const otherTotal = side === 'manager' ? totals.self : totals.manager

  // Báo điểm đang gõ ra ngoài. Chỉ chạy khi con số thật sự đổi nên không gây vòng lặp
  // render với state của form cha.
  const liveRef = useRef(onLiveScore)
  useEffect(() => { liveRef.current = onLiveScore })
  useEffect(() => {
    liveRef.current?.(myTotal, max)
  }, [myTotal, max])

  const handleExport = async () => {
    try {
      await exportConductSheetToExcel(sheet, exportRows(), totals, comment)
    } catch {
      toast.error('Không thể xuất phiếu hạnh kiểm ra Excel')
    }
  }

  return (
    <div className={cn('rounded-[28px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        className="w-full px-5 py-3.5 flex items-center gap-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-all"
      >
        <div className="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <HeartHandshake size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
            Chấm hạnh kiểm
            {sheet.locked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
                <Lock size={9} /> Đã khoá
              </span>
            )}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
            {[sheet.criteriaSetName, `thang ${fmt(max)}`].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {editable && (
            <span className={cn(
              'hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black tabular-nums',
              done === sheet.items.length
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
            )}>
              {done === sheet.items.length && <Check size={10} />}
              {done}/{sheet.items.length}
            </span>
          )}
          <p className={cn(
            'text-sm font-black tabular-nums',
            side === 'manager' ? 'text-indigo-600 dark:text-indigo-400' : 'text-teal-600 dark:text-teal-400'
          )}>
            {fmt(myTotal)}
            <span className="text-slate-400 font-bold">/{fmt(max)}</span>
          </p>
          <ChevronDown size={16} className={cn('text-slate-400 transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
          {sheet.locked && (
            <Banner tone="slate" icon={Lock}>
              Đánh giá kỳ của đơn vị{sheet.lockedByUnitName ? ` "${sheet.lockedByUnitName}"` : ''} đã chốt —
              phiếu chỉ còn để xem. Điểm hạnh kiểm là đầu vào của xếp loại kỳ nên phải mở khoá ở đơn vị đó trước.
            </Banner>
          )}

          {Math.abs(totalWeight - 100) > 0.01 && (
            <Banner tone="amber" icon={Info}>
              Tổng trọng số của bộ tiêu chí đang là {fmt(totalWeight)}% (khác 100%) — điểm tổng sẽ không đạt đủ
              thang {fmt(max)}. Sửa ở "Thiết lập công cụ › Thang điểm › Hạnh kiểm".
            </Banner>
          )}

          {sheet.items.map((item, idx) => {
            const d = rowOf(item.position)
            return (
              <div
                key={item.position}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{item.name}</p>
                      <span className="shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 tabular-nums">
                        {fmt(item.weight)}%
                      </span>
                    </div>
                    <Expectations text={item.description} />
                  </div>
                </div>

                {/* Ô chấm thụt vào cho thẳng hàng với tên tiêu chí. */}
                <div className="mt-3 pl-[30px] space-y-2.5">
                  {(dual || side === 'self') && (
                    <ScoreBlock
                      tone="self"
                      label={dual ? 'Bạn tự đánh giá' : sheet.canScoreSelf ? 'Điểm bạn tự chấm' : 'Nhân viên tự đánh giá'}
                      max={max}
                      weight={item.weight}
                      score={d.selfScore}
                      note={d.selfEvidence}
                      notePlaceholder="Nêu dẫn chứng cụ thể…"
                      editable={sheet.canScoreSelf}
                      onScore={v => set(item.position, { selfScore: v })}
                      onNote={v => set(item.position, { selfEvidence: v })}
                    />
                  )}

                  {(dual || side === 'manager') && (
                    <ScoreBlock
                      tone="manager"
                      label={dual ? 'Cán bộ quản lý chấm' : 'Điểm bạn chấm'}
                      max={max}
                      weight={item.weight}
                      score={d.managerScore}
                      note={d.managerComment}
                      notePlaceholder="Nhận xét của cán bộ quản lý…"
                      editable={sheet.canScoreManager}
                      onScore={v => set(item.position, { managerScore: v })}
                      onNote={v => set(item.position, { managerComment: v })}
                    />
                  )}

                  {/* Phía kia chỉ hiện khi ĐÃ có điểm, và gói trong một dòng: quản lý cần
                      biết nhân viên tự chấm bao nhiêu, nhân viên cần biết mình được chấm
                      lại thế nào — không ai cần cả một cột trống. */}
                  {!dual && (
                    <OtherSide
                      tone={side === 'manager' ? 'self' : 'manager'}
                      score={num(side === 'manager' ? d.selfScore : d.managerScore)}
                      note={side === 'manager' ? d.selfEvidence : d.managerComment}
                    />
                  )}
                </div>
              </div>
            )
          })}

          {sheet.canScoreManager && (
            <AutoTextarea
              value={comment}
              onChange={setComment}
              placeholder="Nhận xét chung cho cả phiếu…"
              className="min-h-[44px] px-4 py-3 rounded-2xl text-sm bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20"
            />
          )}

          {/* Tổng và hành động gộp một hàng: chấm xong là thấy điểm rồi bấm lưu ngay,
              không phải cuộn qua hai khối riêng. */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-[#1e3a6d] text-white">
            {/* Nhãn và điểm nằm cùng một dòng — thanh này chỉ có một con số, không đáng
                chiếm hai dòng ở cuối một phiếu vốn đã dài. */}
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-white/50">
                Điểm hành vi đã tính trọng số
              </p>
              <p className="text-lg font-black leading-none tabular-nums">
                {fmt(myTotal)}
                <span className="text-sm text-white/50">/{fmt(max)}</span>
                {/* Điểm phía kia đứng cạnh để so, không cần thêm một khối riêng. */}
                {(dual || otherTotal != null) && (
                  <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/50">
                    {side === 'manager' ? 'Tự ĐG' : 'QLTT'} {fmt(otherTotal)}
                  </span>
                )}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {showExport && (
                <button
                  type="button"
                  onClick={handleExport}
                  title="Xuất phiếu ra Excel"
                  className="flex items-center gap-2 px-3 h-9 rounded-xl bg-white/10 text-white/80 text-xs font-bold hover:bg-white/20 transition-all active:scale-95"
                >
                  <FileSpreadsheet size={14} />
                  <span className="hidden sm:inline">Xuất Excel</span>
                </button>
              )}
              {!hideActions && sheet.canScoreSelf && (
                <button
                  type="button"
                  onClick={() => onSaveSelf(collect('self'))}
                  disabled={isSavingSelf}
                  className="flex items-center gap-2 px-4 h-9 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-400 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingSelf ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu tự đánh giá
                </button>
              )}
              {!hideActions && sheet.canScoreManager && (
                <button
                  type="button"
                  onClick={() => onSaveManager({ items: collect('manager'), comment })}
                  disabled={isSavingManager}
                  className="flex items-center gap-2 px-4 h-9 rounded-xl bg-white text-[#1e3a6d] text-xs font-bold hover:bg-white/90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSavingManager ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Lưu điểm hạnh kiểm
                </button>
              )}
              {!editable && !sheet.locked && (
                <p className="text-[11px] font-bold text-white/60">Bạn chỉ có quyền xem phiếu này.</p>
              )}
            </div>
          </div>

          {editable && done < sheet.items.length && (
            <p className="text-center text-[11px] font-bold text-slate-400">
              Còn {sheet.items.length - done} tiêu chí chưa chấm — phiếu vẫn lưu được phần đang dở.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Biểu hiện của tiêu chí: dài nên chỉ mở hai dòng đầu, phần còn lại bấm mới xem. */
function Expectations({ text }: { text?: string | null }) {
  const lines = useMemo(
    () => (text ?? '').split('\n').map(l => l.trim()).filter(Boolean),
    [text]
  )
  const [expanded, setExpanded] = useState(false)
  if (!lines.length) return null

  const shown = expanded ? lines : lines.slice(0, 2)
  return (
    <ul className="mt-1 space-y-0.5">
      {shown.map((line, i) => (
        <li key={i} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pl-3 relative">
          <span className="absolute left-0">-</span>{line}
        </li>
      ))}
      {lines.length > 2 && (
        <li>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-[var(--color-primary)] transition-colors"
          >
            {expanded ? 'Thu gọn' : `+ ${lines.length - 2} biểu hiện khác`}
          </button>
        </li>
      )}
    </ul>
  )
}

function ScoreBlock({
  tone, label, max, weight, score, note, notePlaceholder, editable, onScore, onNote,
}: {
  tone: Side
  label: string
  max: number
  weight: number
  score: string
  note: string
  notePlaceholder: string
  editable: boolean
  onScore: (v: string) => void
  onNote: (v: string) => void
}) {
  const w = weighted(num(score), weight)
  const accent = tone === 'self'
    ? 'text-teal-600 dark:text-teal-400'
    : 'text-indigo-600 dark:text-indigo-400'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[9px] font-black uppercase tracking-widest', accent)}>{label}</span>
        <span className={cn('text-[10px] font-black tabular-nums', w == null ? 'text-slate-300 dark:text-slate-600' : accent)}>
          ×TS {fmt(w)}
        </span>
      </div>
      <ScoreScale tone={tone} max={max} value={score} editable={editable} onChange={onScore} />
      <AutoTextarea
        value={note}
        onChange={onNote}
        disabled={!editable}
        placeholder={editable ? notePlaceholder : 'Chưa có nội dung'}
        className={cn(
          'min-h-[36px] px-3 py-2 rounded-xl text-xs',
          editable
            ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20'
            : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 cursor-not-allowed'
        )}
      />
    </div>
  )
}

/**
 * Thang điểm bấm một phát là xong, thay vì gõ số rồi tự nhớ đang thang mấy. Bấm lại đúng
 * mức đang chọn = bỏ chấm. Thang lớn (trên 6) thì số nút quá nhiều nên vẫn dùng ô nhập.
 */
function ScoreScale({
  tone, max, value, editable, onChange,
}: {
  tone: Side
  max: number
  value: string
  editable: boolean
  onChange: (v: string) => void
}) {
  const current = num(value)
  const useChips = Number.isInteger(max) && max > 0 && max <= 6

  const options = useMemo(() => {
    if (!useChips) return []
    const list = Array.from({ length: max + 1 }, (_, i) => i)
    // Điểm lẻ (0.5) lưu từ trước vẫn phải hiện đúng, nên chèn thêm mức đó vào thang.
    if (current != null && !list.includes(current)) list.push(current)
    return list.sort((a, b) => a - b)
  }, [useChips, max, current])

  if (!useChips) {
    return (
      <input
        type="number" min={0} max={max} step={0.5}
        value={value}
        onChange={e => onChange(e.target.value)}
        onWheel={e => e.currentTarget.blur()}
        disabled={!editable}
        placeholder="—"
        className={cn(
          'w-24 px-2 py-1.5 rounded-xl text-center text-sm font-black outline-none border transition-all',
          !editable
            ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed'
            : tone === 'self'
              ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 focus:ring-2 focus:ring-teal-500/20'
              : 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
        )}
      />
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {options.map(o => {
        const active = current === o
        return (
          <button
            key={o}
            type="button"
            disabled={!editable}
            aria-pressed={active}
            title={editable ? (active ? 'Bấm lại để bỏ chấm' : `Chấm ${o}/${max}`) : undefined}
            onClick={() => onChange(active ? '' : String(o))}
            className={cn(
              'min-w-9 h-9 px-2.5 rounded-xl text-sm font-black tabular-nums border transition-all',
              !editable && 'cursor-not-allowed',
              active
                ? tone === 'self'
                  ? 'bg-teal-600 border-teal-600 text-white shadow-sm'
                  : 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                : cn(
                  'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400',
                  editable && (tone === 'self'
                    ? 'hover:border-teal-400 hover:text-teal-600 active:scale-95'
                    : 'hover:border-indigo-400 hover:text-indigo-600 active:scale-95')
                )
            )}
          >
            {o}
          </button>
        )
      })}
      {editable && current == null && (
        <span className="ml-1 text-[10px] font-bold text-slate-300 dark:text-slate-600">Chọn mức 0–{max}</span>
      )}
    </div>
  )
}

/** Một dòng tham chiếu của phía còn lại — chỉ hiện khi phía đó đã chấm. */
function OtherSide({ tone, score, note }: { tone: Side; score: number | null; note: string }) {
  if (score == null && !note.trim()) return null
  const label = tone === 'self' ? 'Nhân viên tự chấm' : 'Quản lý chấm'
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
      <span className={cn(
        'shrink-0 text-[10px] font-black uppercase tracking-wider',
        tone === 'self' ? 'text-teal-600 dark:text-teal-400' : 'text-indigo-500 dark:text-indigo-400'
      )}>
        {label} {fmt(score)}
      </span>
      {note.trim() && (
        <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed">{note}</span>
      )}
    </div>
  )
}

/** Ô ghi chú tự cao dần theo nội dung — bắt đầu bằng một dòng để phiếu không bị dài. */
function AutoTextarea({
  value, onChange, disabled, placeholder, className,
}: {
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      placeholder={placeholder}
      className={cn(
        'w-full font-medium leading-relaxed outline-none border transition-all resize-none overflow-hidden text-slate-700 dark:text-slate-200 focus:ring-2',
        className
      )}
    />
  )
}

function Banner({
  tone, icon: Icon, children,
}: {
  tone: 'slate' | 'amber'
  icon: typeof Info
  children: ReactNode
}) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 p-3 rounded-2xl border',
      tone === 'amber'
        ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/50'
        : 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
    )}>
      <Icon size={14} className={cn('shrink-0 mt-0.5', tone === 'amber' ? 'text-amber-600' : 'text-slate-500')} />
      <p className={cn(
        'text-[11px] font-bold leading-relaxed',
        tone === 'amber' ? 'text-amber-800 dark:text-amber-300' : 'text-slate-600 dark:text-slate-300'
      )}>
        {children}
      </p>
    </div>
  )
}
