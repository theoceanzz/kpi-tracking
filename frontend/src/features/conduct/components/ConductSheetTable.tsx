import { useEffect, useMemo, useState } from 'react'
import { Save, Loader2, Info, Lock, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ConductScoreInput, ConductSheet } from '../api/conductApi'
import { exportConductSheetToExcel, type ConductExportRow } from '../utils/conductSheetExport'

/**
 * Phiếu "Đánh giá xếp loại hành vi theo triết lý giáo dục", dựng đúng theo bảng giấy:
 * mỗi tiêu chí một dòng, hai phía chấm (CBNV tự đánh giá / CBQLTT), và hai cột cuối là
 * điểm ĐÃ TÍNH TRỌNG SỐ. Hàng chân bảng cộng lại thành điểm hạnh kiểm của đợt/kỳ.
 *
 * Bảng rộng nên cuộn ngang TRONG khung của nó (`overflow-x-auto`) — trang không bao giờ
 * bị đẩy ngang theo.
 */

interface Draft {
  selfScore: string
  selfEvidence: string
  managerScore: string
  managerComment: string
}

const toDraft = (sheet: ConductSheet): Record<number, Draft> =>
  Object.fromEntries(
    sheet.items.map(i => [
      i.position,
      {
        selfScore: i.selfScore != null ? String(i.selfScore) : '',
        selfEvidence: i.selfEvidence ?? '',
        managerScore: i.managerScore != null ? String(i.managerScore) : '',
        managerComment: i.managerComment ?? '',
      },
    ])
  )

const EMPTY_DRAFT: Draft = { selfScore: '', selfEvidence: '', managerScore: '', managerComment: '' }

const num = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Điểm đã tính trọng số của MỘT dòng, hoặc null khi dòng chưa chấm. */
const weighted = (score: number | null, weight: number) =>
  score == null ? null : Math.round((score * weight) / 100 * 100) / 100

const fmt = (v: number | null | undefined) =>
  v == null ? '—' : Number(v.toFixed(2)).toString()

export default function ConductSheetTable({
  sheet,
  onSaveSelf,
  onSaveManager,
  isSavingSelf,
  isSavingManager,
}: {
  sheet: ConductSheet
  onSaveSelf: (items: ConductScoreInput[]) => void
  onSaveManager: (payload: { items: ConductScoreInput[]; comment?: string | null }) => void
  isSavingSelf?: boolean
  isSavingManager?: boolean
}) {
  const [draft, setDraft] = useState<Record<number, Draft>>(() => toDraft(sheet))
  const [comment, setComment] = useState(sheet.comment ?? '')

  // Phiếu đổi (chọn người khác, đổi đợt, hoặc vừa lưu xong) ⇒ nạp lại nháp từ server.
  useEffect(() => {
    setDraft(toDraft(sheet))
    setComment(sheet.comment ?? '')
  }, [sheet])

  const max = sheet.maxScore
  const set = (position: number, patch: Partial<Draft>) =>
    setDraft(prev => ({ ...prev, [position]: { ...(prev[position] ?? EMPTY_DRAFT), ...patch } }))

  const totals = useMemo(() => {
    let self = 0
    let manager = 0
    let hasSelf = false
    let hasManager = false
    sheet.items.forEach(i => {
      const d = draft[i.position]
      if (!d) return
      const s = weighted(num(d.selfScore), i.weight)
      const m = weighted(num(d.managerScore), i.weight)
      if (s != null) { self += s; hasSelf = true }
      if (m != null) { manager += m; hasManager = true }
    })
    return {
      self: hasSelf ? Math.round(self * 100) / 100 : null,
      manager: hasManager ? Math.round(manager * 100) / 100 : null,
    }
  }, [draft, sheet.items])

  const totalWeight = sheet.items.reduce((s, i) => s + (i.weight || 0), 0)

  const collect = (side: 'self' | 'manager'): ConductScoreInput[] =>
    sheet.items.map(i => {
      const d = draft[i.position]
      return {
        criteriaId: i.criteriaId ?? null,
        position: i.position,
        score: side === 'self' ? num(d?.selfScore ?? '') : num(d?.managerScore ?? ''),
        note: side === 'self' ? (d?.selfEvidence ?? '') : (d?.managerComment ?? ''),
      }
    })

  // Xuất đúng thứ đang hiển thị (kể cả điểm vừa gõ chưa lưu) — file phải khớp với màn hình.
  const handleExport = async () => {
    const rows: ConductExportRow[] = sheet.items.map(i => {
      const d = draft[i.position] ?? EMPTY_DRAFT
      const selfScore = num(d.selfScore)
      const managerScore = num(d.managerScore)
      return {
        name: i.name,
        description: i.description,
        weight: i.weight,
        selfScore,
        selfEvidence: d.selfEvidence,
        managerScore,
        managerComment: d.managerComment,
        selfWeighted: weighted(selfScore, i.weight),
        managerWeighted: weighted(managerScore, i.weight),
      }
    })
    try {
      await exportConductSheetToExcel(sheet, rows, totals, comment)
    } catch {
      toast.error('Không thể xuất phiếu hạnh kiểm ra Excel')
    }
  }

  const scoreInputCls = (editable: boolean, tone: 'self' | 'manager') =>
    cn(
      'w-20 px-2 py-2 rounded-xl text-center text-sm font-black outline-none transition-all',
      !editable
        ? 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 cursor-not-allowed'
        : tone === 'self'
          ? 'bg-teal-50/50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 focus:ring-2 focus:ring-teal-500/20'
          : 'bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500/20'
    )

  const textAreaCls = (editable: boolean) =>
    cn(
      'w-full min-h-[64px] px-3 py-2 rounded-xl text-xs font-medium leading-relaxed outline-none transition-all resize-y',
      editable
        ? 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20'
        : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 text-slate-500 cursor-not-allowed'
    )

  const th = 'px-3 py-2 text-[10px] font-black uppercase tracking-wider text-white/90 border border-white/15 text-center align-middle'

  return (
    <div className="space-y-4">
      {sheet.locked && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
          <Lock size={16} className="text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Đánh giá kỳ của đơn vị{sheet.lockedByUnitName ? ` "${sheet.lockedByUnitName}"` : ''} đã được chốt —
            phiếu này chỉ còn để xem. Điểm hạnh kiểm là đầu vào của xếp loại kỳ nên phải mở khoá ở đơn vị đó
            trước khi sửa.
          </p>
        </div>
      )}

      {Math.abs(totalWeight - 100) > 0.01 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
          <Info size={16} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
            Tổng trọng số của bộ tiêu chí đang là {fmt(totalWeight)}% (khác 100%) — điểm tổng sẽ không đạt
            đủ thang {fmt(max)}. Hãy chỉnh lại ở phần thiết lập tiêu chí hạnh kiểm.
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="bg-[#1e3a6d]">
                <th className={cn(th, 'w-12')} rowSpan={2}>STT</th>
                <th className={cn(th, 'w-[280px] text-left')} rowSpan={2}>
                  Các tiêu chí định tính
                  <span className="block text-[9px] font-bold normal-case tracking-normal text-white/60">
                    (Thái độ, hành vi…)
                  </span>
                </th>
                <th className={cn(th, 'w-20')} rowSpan={2}>Trọng số</th>
                <th className={th} colSpan={2}>Điểm xếp loại hành vi</th>
                <th className={th} colSpan={2}>Điểm xếp loại hành vi</th>
                <th className={th} colSpan={2}>
                  Điểm xếp loại đã tính đến trọng số
                </th>
              </tr>
              <tr className="bg-[#1e3a6d]">
                <th className={cn(th, 'w-24')}>Do CBNV/giảng viên tự đánh giá</th>
                <th className={cn(th, 'w-[220px]')}>Dẫn chứng</th>
                <th className={cn(th, 'w-24')}>Do CBQLTT đánh giá</th>
                <th className={cn(th, 'w-[220px]')}>Nhận xét của Cán bộ quản lý</th>
                <th className={cn(th, 'w-24')}>Theo mức đánh giá của CBNV/giảng viên</th>
                <th className={cn(th, 'w-24')}>Theo mức đánh giá của CBQLTT</th>
              </tr>
            </thead>

            <tbody className="bg-white dark:bg-slate-900">
              {sheet.items.map((item, idx) => {
                const d = draft[item.position] ?? EMPTY_DRAFT
                const selfW = weighted(num(d.selfScore), item.weight)
                const mgrW = weighted(num(d.managerScore), item.weight)
                return (
                  <tr key={item.position} className="border-b border-slate-100 dark:border-slate-800 align-top">
                    <td className="px-3 py-4 text-center text-sm font-black text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-4">
                      <p className="text-sm font-black text-slate-900 dark:text-white">{item.name}</p>
                      {item.description && (
                        // Mô tả lưu nhiều dòng, mỗi dòng là một biểu hiện — giữ nguyên xuống dòng
                        // thay vì gộp thành một đoạn văn khó đọc.
                        <ul className="mt-1.5 space-y-1">
                          {item.description.split('\n').filter(Boolean).map((line, i) => (
                            <li key={i} className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-relaxed pl-3 relative">
                              <span className="absolute left-0">-</span>
                              {line.trim()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-black text-slate-700 dark:text-slate-200">
                      {fmt(item.weight)}%
                    </td>

                    <td className="px-3 py-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={max}
                        step={0.5}
                        value={d.selfScore}
                        onChange={e => set(item.position, { selfScore: e.target.value })}
                        onWheel={e => e.currentTarget.blur()}
                        disabled={!sheet.canScoreSelf}
                        placeholder="—"
                        className={scoreInputCls(sheet.canScoreSelf, 'self')}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <textarea
                        value={d.selfEvidence}
                        onChange={e => set(item.position, { selfEvidence: e.target.value })}
                        disabled={!sheet.canScoreSelf}
                        placeholder={sheet.canScoreSelf ? 'Nêu dẫn chứng cụ thể…' : ''}
                        className={textAreaCls(sheet.canScoreSelf)}
                      />
                    </td>

                    <td className="px-3 py-4 text-center">
                      <input
                        type="number"
                        min={0}
                        max={max}
                        step={0.5}
                        value={d.managerScore}
                        onChange={e => set(item.position, { managerScore: e.target.value })}
                        onWheel={e => e.currentTarget.blur()}
                        disabled={!sheet.canScoreManager}
                        placeholder="—"
                        className={scoreInputCls(sheet.canScoreManager, 'manager')}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <textarea
                        value={d.managerComment}
                        onChange={e => set(item.position, { managerComment: e.target.value })}
                        disabled={!sheet.canScoreManager}
                        placeholder={sheet.canScoreManager ? 'Nhận xét của cán bộ quản lý…' : ''}
                        className={textAreaCls(sheet.canScoreManager)}
                      />
                    </td>

                    <td className="px-3 py-4 text-center text-sm font-black text-teal-600 dark:text-teal-400">
                      {fmt(selfW)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-black text-indigo-600 dark:text-indigo-400">
                      {fmt(mgrW)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="bg-[#1e3a6d] text-white">
                <td colSpan={7} className="px-4 py-3 text-right text-xs font-black uppercase tracking-widest">
                  Điểm hành vi đã tính đến trọng số (thang {fmt(max)}):
                </td>
                <td className="px-3 py-3 text-center text-base font-black">{fmt(totals.self)}</td>
                <td className="px-3 py-3 text-center text-base font-black">{fmt(totals.manager)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {sheet.canScoreManager && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Nhận xét chung của cán bộ quản lý</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét chung cho cả phiếu…"
            className="w-full min-h-[80px] px-4 py-3 rounded-2xl text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/20 resize-y"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          onClick={handleExport}
          className="mr-auto flex items-center gap-2 px-4 h-10 rounded-xl bg-[var(--color-muted)] text-[var(--color-muted-foreground)] text-sm font-bold hover:text-[var(--color-primary)] border border-[var(--color-border)] transition-all active:scale-95"
        >
          <FileSpreadsheet size={16} /> Xuất Excel
        </button>
        {sheet.canScoreSelf && (
          <button
            onClick={() => onSaveSelf(collect('self'))}
            disabled={isSavingSelf}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-teal-600 text-white text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isSavingSelf ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu tự đánh giá
          </button>
        )}
        {sheet.canScoreManager && (
          <button
            onClick={() => onSaveManager({ items: collect('manager'), comment })}
            disabled={isSavingManager}
            className="flex items-center gap-2 px-5 h-10 rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:opacity-90 shadow-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isSavingManager ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Lưu điểm quản lý
          </button>
        )}
        {!sheet.canScoreSelf && !sheet.canScoreManager && !sheet.locked && (
          <p className="text-xs font-bold text-slate-400">Bạn chỉ có quyền xem phiếu này.</p>
        )}
      </div>
    </div>
  )
}
