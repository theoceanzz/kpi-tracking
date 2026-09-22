import {
  useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ReactNode, type Ref,
} from 'react'
import {
  Check, ChevronDown, FileSpreadsheet, HeartHandshake, Info, Loader2, Lock, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { conductLockMessage, type ConductScoreInput, type ConductSheet, type ConductTarget } from '../api/conductApi'
import { exportConductSheetToExcel } from '../utils/conductSheetExport'
import { useConductSheet } from '../hooks/useConduct'
import { CONDUCT_MIN_SCORE, fmt, num, useConductDraft, weighted } from '../hooks/useConductDraft'
import { Button } from '@/components/ui/button'

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
      <div className={cn('flex items-center gap-3 p-5 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]', className)}>
        <Loader2 size={16} className="animate-spin text-[var(--color-primary)]" />
        <span className="text-caption">Đang tải phiếu hạnh kiểm…</span>
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
  // Server nói thang bắt đầu từ đâu; bản cũ chưa trả thì rơi về 1 (thang 1–5 của ma trận).
  const min = sheet.minScore ?? CONDUCT_MIN_SCORE
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
    <div className={cn('rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] overflow-hidden', className)}>
      <button className="flex w-full items-center gap-3 rounded-card p-3 text-left transition-colors hover:bg-[var(--color-muted)]" type="button" onClick={() => setManualOpen(!open)}>
        <div className="w-9 h-9 rounded-card bg-[var(--color-info-bg)] text-[var(--color-info)] flex items-center justify-center shrink-0">
          <HeartHandshake aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--color-foreground)] flex items-center gap-2">
            Chấm hạnh kiểm
            {sheet.locked && (
              <span className="text-eyebrow inline-flex items-center gap-1 px-1.5 py-0.5 rounded-control bg-[var(--color-border)]" title={conductLockMessage(sheet)}>
                <Lock aria-hidden="true" /> {sheet.lockStage === 'FINALIZED' ? 'Đã khoá kết quả' : 'Đã chốt dữ liệu'}
              </span>
            )}
          </p>
          <p className="text-eyebrow truncate">
            {[sheet.criteriaSetName, `thang ${fmt(min)}–${fmt(max)}`].filter(Boolean).join(' · ')}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {editable && (
            <span className={cn(
              'hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-control text-xs font-semibold tabular-nums',
              done === sheet.items.length
                ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
            )}>
              {done === sheet.items.length && <Check aria-hidden="true" />}
              {done}/{sheet.items.length}
            </span>
          )}
          <p className={cn(
            'text-sm font-semibold tabular-nums',
            side === 'manager' ? 'text-[var(--color-primary)]' : 'text-[var(--color-info)]'
          )}>
            {fmt(myTotal)}
            <span className="text-[var(--color-subtle-foreground)] font-semibold">/{fmt(max)}</span>
          </p>
          <ChevronDown aria-hidden="true" className={cn('text-[var(--color-subtle-foreground)] transition-transform', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2.5 border-t border-[var(--color-border)] pt-4">
          {sheet.locked && (
            <Banner tone="slate" icon={Lock}>{conductLockMessage(sheet)}</Banner>
          )}

          {!!sheet.prefilledFromPeriods && editable && (
            <Banner tone="slate" icon={Info}>
              Điền sẵn bằng trung bình {sheet.prefilledFromPeriods} phiếu hạnh kiểm theo đợt trong kỳ — như điểm chốt kỳ
              lấy TB các đợt. Sửa chỗ nào thấy khác rồi lưu; chưa lưu thì xếp loại vẫn dùng đúng số này.
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
                className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3.5"
              >
                <div className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-control bg-[var(--color-muted)] text-caption font-semibold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[var(--color-foreground)] leading-snug">{item.name}</p>
                      <span className="shrink-0 px-2 py-0.5 rounded-control bg-[var(--color-muted)] text-caption tabular-nums">
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
                      min={min}
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
                      min={min}
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
              className="min-h-[44px] px-4 py-3 rounded-card text-sm bg-[var(--color-card)] border-[var(--color-border)] focus:ring-[var(--color-ring)]"
            />
          )}

          {/* Tổng và hành động gộp một hàng: chấm xong là thấy điểm rồi bấm lưu ngay,
              không phải cuộn qua hai khối riêng. */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-card bg-[#1e3a6d] text-white">
            {/* Nhãn và điểm nằm cùng một dòng — thanh này chỉ có một con số, không đáng
                chiếm hai dòng ở cuối một phiếu vốn đã dài. */}
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-eyebrow text-white/50">
                Điểm hành vi đã tính trọng số
              </p>
              <p className="text-lg font-semibold leading-none tabular-nums">
                {fmt(myTotal)}
                <span className="text-sm text-white/50">/{fmt(max)}</span>
                {/* Điểm phía kia đứng cạnh để so, không cần thêm một khối riêng. */}
                {(dual || otherTotal != null) && (
                  <span className="text-eyebrow ml-2 text-white/50">
                    {side === 'manager' ? 'Tự ĐG' : 'QLTT'} {fmt(otherTotal)}
                  </span>
                )}
              </p>
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-2">
              {showExport && (
                <Button variant="secondary" size="sm" type="button" onClick={handleExport} title="Xuất phiếu ra Excel">
                  <FileSpreadsheet aria-hidden="true" />
                  <span className="hidden sm:inline">Xuất Excel</span>
                </Button>
              )}
              {!hideActions && sheet.canScoreSelf && (
                <Button size="sm" type="button" onClick={() => onSaveSelf(collect('self'))} disabled={isSavingSelf}>
                  {isSavingSelf ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  Lưu tự đánh giá
                </Button>
              )}
              {!hideActions && sheet.canScoreManager && (
                <Button variant="secondary" size="sm" type="button" onClick={() => onSaveManager({ items: collect('manager'), comment })} disabled={isSavingManager}>
                  {isSavingManager ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                  Lưu điểm hạnh kiểm
                </Button>
              )}
              {!editable && !sheet.locked && (
                <p className="text-xs font-medium text-white/60">Bạn chỉ có quyền xem phiếu này.</p>
              )}
            </div>
          </div>

          {editable && done < sheet.items.length && (
            <p className="text-center text-caption">
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
        <li key={i} className="text-caption leading-relaxed pl-3 relative">
          <span className="absolute left-0">-</span>{line}
        </li>
      ))}
      {lines.length > 2 && (
        <li>
          <Button variant="ghost" type="button" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Thu gọn' : `+ ${lines.length - 2} biểu hiện khác`}
          </Button>
        </li>
      )}
    </ul>
  )
}

function ScoreBlock({
  tone, label, min, max, weight, score, note, notePlaceholder, editable, onScore, onNote,
}: {
  tone: Side
  label: string
  min: number
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
    ? 'text-[var(--color-info)]'
    : 'text-[var(--color-primary)]'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-eyebrow', accent)}>{label}</span>
        <span className={cn('text-xs font-semibold tabular-nums', w == null ? 'text-[var(--color-subtle-foreground)]' : accent)}>
          ×TS {fmt(w)}
        </span>
      </div>
      <ScoreScale tone={tone} min={min} max={max} value={score} editable={editable} onChange={onScore} />
      <AutoTextarea
        value={note}
        onChange={onNote}
        disabled={!editable}
        placeholder={editable ? notePlaceholder : 'Chưa có nội dung'}
        className={cn(
          'min-h-[36px] px-3 py-2 rounded-card text-xs',
          editable
            ? 'bg-[var(--color-card)] border-[var(--color-border)] focus:ring-[var(--color-ring)]'
            : 'bg-[var(--color-muted)] border-[var(--color-border)] text-[var(--color-subtle-foreground)] cursor-not-allowed'
        )}
      />
    </div>
  )
}

/**
 * Thang điểm bấm một phát là xong, thay vì gõ số rồi tự nhớ đang thang mấy. Bấm lại đúng
 * mức đang chọn = bỏ chấm. Thang lớn (trên 6 mức) thì số nút quá nhiều nên vẫn dùng ô nhập.
 *
 * Thang chạy `min..max` — mặc định 1–5, ĐÚNG bằng thang xếp loại của ma trận hiệu quả, vì
 * điểm hạnh kiểm chính là thứ lấp trục hành vi của ma trận. Không có mức 0: "chưa chấm" đã
 * là ô trống rồi, thêm 0 chỉ tạo nghĩa thứ hai cho cùng một ô.
 */
function ScoreScale({
  tone, min, max, value, editable, onChange,
}: {
  tone: Side
  min: number
  max: number
  value: string
  editable: boolean
  onChange: (v: string) => void
}) {
  const current = num(value)
  const useChips = Number.isInteger(min) && Number.isInteger(max) && max > min && max - min <= 6

  const options = useMemo(() => {
    if (!useChips) return []
    const list = Array.from({ length: max - min + 1 }, (_, i) => min + i)
    // Điểm ngoài thang lưu từ trước (0.5, hoặc 0 của thang 0–4 cũ) vẫn phải hiện đúng —
    // không thì mở phiếu cũ ra sẽ thấy trống trơn như chưa ai chấm.
    if (current != null && !list.includes(current)) list.push(current)
    return list.sort((a, b) => a - b)
  }, [useChips, min, max, current])

  if (!useChips) {
    return (
      <input
        type="number" min={min} max={max} step={0.5}
        value={value}
        onChange={e => onChange(e.target.value)}
        onWheel={e => e.currentTarget.blur()}
        disabled={!editable}
        placeholder="—"
        className={cn(
          'w-24 px-2 py-1.5 rounded-card text-center text-sm font-semibold outline-none border transition-all',
          !editable
            ? 'bg-[var(--color-muted)] border-[var(--color-border)] text-[var(--color-subtle-foreground)] cursor-not-allowed'
            : tone === 'self'
              ? 'bg-[var(--color-info-bg)] border-[var(--color-info-border)] text-[var(--color-info)] focus:ring-2 focus:ring-[var(--color-info-solid)]'
              : 'bg-[var(--color-primary-soft)] border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]'
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
              'min-w-9 h-9 px-2.5 rounded-card text-sm font-semibold tabular-nums border transition-all',
              !editable && 'cursor-not-allowed',
              active
                ? tone === 'self'
                  ? 'bg-[var(--color-info-solid)] border-[var(--color-info-border)] text-white shadow-sm'
                  : 'bg-[var(--color-primary)] border-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-sm'
                : cn(
                  'bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-subtle-foreground)]',
                  editable && (tone === 'self'
                    ? 'hover:border-[var(--color-info-border)] hover:text-[var(--color-info)]'
                    : 'hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]')
                )
            )}
          >
            {o}
          </button>
        )
      })}
      {editable && current == null && (
        <span className="ml-1 text-caption">Chọn mức {min}–{max}</span>
      )}
    </div>
  )
}

/** Một dòng tham chiếu của phía còn lại — chỉ hiện khi phía đó đã chấm. */
function OtherSide({ tone, score, note }: { tone: Side; score: number | null; note: string }) {
  if (score == null && !note.trim()) return null
  const label = tone === 'self' ? 'Nhân viên tự chấm' : 'Quản lý chấm'
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
      <span className={cn(
        'text-eyebrow shrink-0',
        tone === 'self' ? 'text-[var(--color-info)]' : 'text-[var(--color-primary)]'
      )}>
        {label} {fmt(score)}
      </span>
      {note.trim() && (
        <span className="text-caption leading-relaxed">{note}</span>
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
        'w-full font-medium leading-relaxed outline-none border transition-all resize-none overflow-hidden text-[var(--color-foreground)] focus:ring-2',
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
      'flex items-start gap-2.5 p-3 rounded-card border',
      tone === 'amber'
        ? 'bg-[var(--color-warning-bg)] border-[var(--color-warning-border)]'
        : 'bg-[var(--color-muted)] border-[var(--color-border)]'
    )}>
      <Icon size={14} className={cn('shrink-0 mt-0.5', tone === 'amber' ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted-foreground)]')} />
      <p className={cn(
        'text-xs font-medium leading-relaxed',
        tone === 'amber' ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted-foreground)]'
      )}>
        {children}
      </p>
    </div>
  )
}
