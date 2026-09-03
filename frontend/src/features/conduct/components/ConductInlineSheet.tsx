import { useState } from 'react'
import {
  ChevronDown, FileSpreadsheet, HeartHandshake, Info, Loader2, Lock, Save,
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
 */

export default function ConductInlineSheet({
  target, userId, className,
}: {
  target: ConductTarget
  /** Bỏ trống = phiếu của chính mình. */
  userId?: string
  className?: string
}) {
  const {
    data: sheet, isLoading,
    saveSelf, isSavingSelf, saveManager, isSavingManager,
  } = useConductSheet(target, userId)

  // Mở sẵn khi còn phải chấm, gập lại khi đã chấm xong — modal vốn đã dài, không nên
  // bắt người dùng cuộn qua một phiếu đã xong để tới nút lưu.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null)
  const open = manualOpen ?? (sheet ? sheet.status !== 'REVIEWED' : false)

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
    <div className={cn('rounded-[28px] border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setManualOpen(!open)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-slate-100/60 dark:hover:bg-slate-800/60 transition-all"
      >
        <div className="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
          <HeartHandshake size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-900 dark:text-white">Chấm hạnh kiểm</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 truncate">
            {[sheet.criteriaSetName, `thang ${fmt(sheet.maxScore)}`, sheet.locked ? 'đã khoá' : null]
              .filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tự đánh giá</p>
            <p className="text-sm font-black text-teal-600 dark:text-teal-400">{fmt(sheet.selfScore)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Quản lý</p>
            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400">{fmt(sheet.managerScore)}</p>
          </div>
        </div>
        <ChevronDown size={16} className={cn('text-slate-400 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <SheetBody
          sheet={sheet}
          onSaveSelf={saveSelf}
          onSaveManager={saveManager}
          isSavingSelf={isSavingSelf}
          isSavingManager={isSavingManager}
        />
      )}
    </div>
  )
}

function SheetBody({
  sheet, onSaveSelf, onSaveManager, isSavingSelf, isSavingManager,
}: {
  sheet: ConductSheet
  onSaveSelf: (items: ConductScoreInput[]) => void
  onSaveManager: (payload: { items: ConductScoreInput[]; comment?: string | null }) => void
  isSavingSelf?: boolean
  isSavingManager?: boolean
}) {
  const { rowOf, set, comment, setComment, totals, totalWeight, collect, exportRows } =
    useConductDraft(sheet)
  const max = sheet.maxScore

  const handleExport = async () => {
    try {
      await exportConductSheetToExcel(sheet, exportRows(), totals, comment)
    } catch {
      toast.error('Không thể xuất phiếu hạnh kiểm ra Excel')
    }
  }

  const scoreCls = (editable: boolean, tone: 'self' | 'manager') =>
    cn(
      'w-20 px-2 py-1.5 rounded-xl text-center text-sm font-black outline-none transition-all',
      !editable
        ? 'bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed'
        : tone === 'self'
          ? 'bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 focus:ring-2 focus:ring-teal-500/20'
          : 'bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
    )

  const noteCls = (editable: boolean) =>
    cn(
      'w-full min-h-[52px] px-3 py-2 rounded-xl text-xs font-medium leading-relaxed outline-none transition-all resize-y',
      editable
        ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20'
        : 'bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-slate-500 cursor-not-allowed'
    )

  return (
    <div className="px-5 pb-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
      {sheet.locked && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <Lock size={14} className="text-slate-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
            Đánh giá kỳ của đơn vị{sheet.lockedByUnitName ? ` "${sheet.lockedByUnitName}"` : ''} đã chốt —
            phiếu chỉ còn để xem. Điểm hạnh kiểm là đầu vào của xếp loại kỳ nên phải mở khoá ở đơn vị đó trước.
          </p>
        </div>
      )}

      {Math.abs(totalWeight - 100) > 0.01 && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 leading-relaxed">
            Tổng trọng số của bộ tiêu chí đang là {fmt(totalWeight)}% (khác 100%) — điểm tổng sẽ không đạt đủ
            thang {fmt(max)}. Sửa ở "Thiết lập công cụ › Thang điểm › Hạnh kiểm".
          </p>
        </div>
      )}

      {sheet.items.map((item, idx) => {
        const d = rowOf(item.position)
        const selfW = weighted(num(d.selfScore), item.weight)
        const mgrW = weighted(num(d.managerScore), item.weight)
        return (
          <div
            key={item.position}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3"
          >
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{item.name}</p>
                {item.description && (
                  // Mô tả lưu nhiều dòng, mỗi dòng là một biểu hiện — giữ nguyên xuống dòng.
                  <ul className="mt-1.5 space-y-1">
                    {item.description.split('\n').filter(Boolean).map((line, i) => (
                      <li key={i} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pl-3 relative">
                        <span className="absolute left-0">-</span>{line.trim()}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-500">
                {fmt(item.weight)}%
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-teal-600 dark:text-teal-400">
                    Nhân viên tự đánh giá
                  </span>
                  <span className="text-[10px] font-black text-teal-600 dark:text-teal-400">×TS {fmt(selfW)}</span>
                </div>
                <input
                  type="number" min={0} max={max} step={0.5}
                  value={d.selfScore}
                  onChange={e => set(item.position, { selfScore: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  disabled={!sheet.canScoreSelf}
                  placeholder="—"
                  className={scoreCls(sheet.canScoreSelf, 'self')}
                />
                <textarea
                  value={d.selfEvidence}
                  onChange={e => set(item.position, { selfEvidence: e.target.value })}
                  disabled={!sheet.canScoreSelf}
                  placeholder={sheet.canScoreSelf ? 'Nêu dẫn chứng cụ thể…' : 'Chưa có dẫn chứng'}
                  className={noteCls(sheet.canScoreSelf)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                    Cán bộ quản lý chấm
                  </span>
                  <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">×TS {fmt(mgrW)}</span>
                </div>
                <input
                  type="number" min={0} max={max} step={0.5}
                  value={d.managerScore}
                  onChange={e => set(item.position, { managerScore: e.target.value })}
                  onWheel={e => e.currentTarget.blur()}
                  disabled={!sheet.canScoreManager}
                  placeholder="—"
                  className={scoreCls(sheet.canScoreManager, 'manager')}
                />
                <textarea
                  value={d.managerComment}
                  onChange={e => set(item.position, { managerComment: e.target.value })}
                  disabled={!sheet.canScoreManager}
                  placeholder={sheet.canScoreManager ? 'Nhận xét của cán bộ quản lý…' : 'Chưa có nhận xét'}
                  className={noteCls(sheet.canScoreManager)}
                />
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-2xl bg-[#1e3a6d] text-white">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
          Điểm hành vi đã tính trọng số (thang {fmt(max)})
        </span>
        <div className="flex items-center gap-5 shrink-0">
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">Tự ĐG</p>
            <p className="text-base font-black">{fmt(totals.self)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-white/50">QLTT</p>
            <p className="text-base font-black">{fmt(totals.manager)}</p>
          </div>
        </div>
      </div>

      {sheet.canScoreManager && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Nhận xét chung của cán bộ quản lý
          </p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét chung cho cả phiếu…"
            className="w-full min-h-[64px] px-4 py-3 rounded-2xl text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={handleExport}
          className="mr-auto flex items-center gap-2 px-3.5 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 text-xs font-bold hover:text-[var(--color-primary)] transition-all active:scale-95"
        >
          <FileSpreadsheet size={14} /> Xuất Excel
        </button>
        {sheet.canScoreSelf && (
          <button
            type="button"
            onClick={() => onSaveSelf(collect('self'))}
            disabled={isSavingSelf}
            className="flex items-center gap-2 px-4 h-9 rounded-xl bg-teal-600 text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isSavingSelf ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu tự đánh giá
          </button>
        )}
        {sheet.canScoreManager && (
          <button
            type="button"
            onClick={() => onSaveManager({ items: collect('manager'), comment })}
            disabled={isSavingManager}
            className="flex items-center gap-2 px-4 h-9 rounded-xl bg-[var(--color-primary)] text-white text-xs font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isSavingManager ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Lưu điểm hạnh kiểm
          </button>
        )}
        {!sheet.canScoreSelf && !sheet.canScoreManager && !sheet.locked && (
          <p className="text-[11px] font-bold text-slate-400">Bạn chỉ có quyền xem phiếu này.</p>
        )}
      </div>
    </div>
  )
}
