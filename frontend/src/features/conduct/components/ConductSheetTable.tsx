import { Save, Loader2, Info, Lock, FileSpreadsheet } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { conductLockMessage, type ConductScoreInput, type ConductSheet } from '../api/conductApi'
import { exportConductSheetToExcel } from '../utils/conductSheetExport'
import EvidenceAttachments from '@/features/evidence/EvidenceAttachments'
import { evidenceKey } from '@/features/evidence/evidenceApi'
import { CONDUCT_MIN_SCORE, EMPTY_DRAFT, fmt, num, useConductDraft, weighted } from '../hooks/useConductDraft'
import { Button } from '@/components/ui/button'

/**
 * Phiếu "Đánh giá xếp loại hành vi theo triết lý giáo dục", dựng đúng theo bảng giấy:
 * mỗi tiêu chí một dòng, hai phía chấm (CBNV tự đánh giá / CBQLTT), và hai cột cuối là
 * điểm ĐÃ TÍNH TRỌNG SỐ. Hàng chân bảng cộng lại thành điểm hạnh kiểm của đợt/kỳ.
 *
 * Bảng rộng nên cuộn ngang TRONG khung của nó (`overflow-x-auto`) — trang không bao giờ
 * bị đẩy ngang theo.
 */

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
  const { draft, set, comment, setComment, totals, totalWeight, collect, exportRows } =
    useConductDraft(sheet)

  const max = sheet.maxScore
  // Thang chạy min..max (1–5 mặc định) cho khớp ma trận xếp loại; bản server cũ chưa trả thì rơi về 1.
  const min = sheet.minScore ?? CONDUCT_MIN_SCORE

  const handleExport = async () => {
    try {
      await exportConductSheetToExcel(sheet, exportRows(), totals, comment)
    } catch {
      toast.error('Không thể xuất phiếu hạnh kiểm ra Excel')
    }
  }

  const scoreInputCls = (editable: boolean, tone: 'self' | 'manager') =>
    cn(
      'w-20 px-2 py-2 rounded-card text-center text-sm font-semibold outline-none transition-all',
      !editable
        ? 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed'
        : tone === 'self'
          ? 'bg-[var(--color-info-bg)] border border-[var(--color-info-border)] text-[var(--color-info)] focus:ring-2 focus:ring-[var(--color-info-solid)]'
          : 'bg-[var(--color-primary-soft)] border border-[var(--color-border)] text-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]'
    )

  const textAreaCls = (editable: boolean) =>
    cn(
      'w-full min-h-[64px] px-3 py-2 rounded-card text-xs font-medium leading-relaxed outline-none transition-all resize-y',
      editable
        ? 'bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] focus:ring-2 focus:ring-[var(--color-ring)]'
        : 'bg-[var(--color-muted)] border border-[var(--color-border)] text-[var(--color-muted-foreground)] cursor-not-allowed'
    )

  const th = 'text-eyebrow px-3 py-2 text-white/90 border border-white/15 text-center align-middle'

  return (
    <div className="space-y-4">
      {sheet.locked && (
        <div className="flex items-start gap-3 p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
          <Lock size={16} className="text-[var(--color-muted-foreground)] shrink-0 mt-0.5" />
          <p className="text-caption">{conductLockMessage(sheet)}</p>
        </div>
      )}

      {Math.abs(totalWeight - 100) > 0.01 && (
        <div className="flex items-start gap-3 p-4 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
          <Info size={16} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-[var(--color-warning)]">
            Tổng trọng số của bộ tiêu chí đang là {fmt(totalWeight)}% (khác 100%) — điểm tổng sẽ không đạt
            đủ thang {fmt(max)}. Hãy chỉnh lại ở phần thiết lập tiêu chí hạnh kiểm.
          </p>
        </div>
      )}

      <div id="tour-conduct-sheet" className="rounded-widget border border-[var(--color-border)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse">
            <thead>
              <tr className="bg-[#1e3a6d]">
                <th className={cn(th, 'w-12')} rowSpan={2}>STT</th>
                <th className={cn(th, 'w-[280px] text-left')} rowSpan={2}>
                  Các tiêu chí định tính
                  <span className="block text-xs font-medium normal-case tracking-normal text-white/60">
                    (Thái độ, hành vi…)
                  </span>
                </th>
                <th className={cn(th, 'w-20')} rowSpan={2}>Trọng số</th>
                <th className={th} colSpan={2}>Điểm xếp loại hành vi ({fmt(min)}–{fmt(max)})</th>
                <th className={th} colSpan={2}>Điểm xếp loại hành vi ({fmt(min)}–{fmt(max)})</th>
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

            <tbody className="bg-[var(--color-card)]">
              {sheet.items.map((item, idx) => {
                const d = draft[item.position] ?? EMPTY_DRAFT
                const selfW = weighted(num(d.selfScore), item.weight)
                const mgrW = weighted(num(d.managerScore), item.weight)
                return (
                  <tr key={item.position} className="border-b border-[var(--color-border)] align-top">
                    <td className="px-3 py-4 text-center text-sm font-semibold text-[var(--color-muted-foreground)]">{idx + 1}</td>
                    <td className="px-3 py-4">
                      <p className="text-sm font-semibold text-[var(--color-foreground)]">{item.name}</p>
                      {item.description && (
                        // Mô tả lưu nhiều dòng, mỗi dòng là một biểu hiện — giữ nguyên xuống dòng
                        // thay vì gộp thành một đoạn văn khó đọc.
                        <ul className="mt-1.5 space-y-1">
                          {item.description.split('\n').filter(Boolean).map((line, i) => (
                            <li key={i} className="text-caption leading-relaxed pl-3 relative">
                              <span className="absolute left-0">-</span>
                              {line.trim()}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-semibold text-[var(--color-foreground)]">
                      {fmt(item.weight)}%
                    </td>

                    <td className="px-3 py-4 text-center">
                      <input
                        type="number"
                        min={min}
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
                        min={min}
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

                    <td className="px-3 py-4 text-center text-sm font-semibold text-[var(--color-info)]">
                      {fmt(selfW)}
                    </td>
                    <td className="px-3 py-4 text-center text-sm font-semibold text-[var(--color-primary)]">
                      {fmt(mgrW)}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="bg-[#1e3a6d] text-white">
                <td colSpan={7} className="px-4 py-3 text-right text-sm font-medium">
                  Điểm hành vi đã tính đến trọng số (thang {fmt(max)}):
                </td>
                <td className="px-3 py-3 text-center text-base font-semibold">{fmt(totals.self)}</td>
                <td className="px-3 py-3 text-center text-base font-semibold">{fmt(totals.manager)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {sheet.canScoreManager && (
        <div className="space-y-2">
          <p className="text-eyebrow">Nhận xét chung của cán bộ quản lý</p>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Nhận xét chung cho cả phiếu…"
            className="w-full min-h-[80px] px-4 py-3 rounded-card text-sm font-medium bg-[var(--color-card)] border border-[var(--color-border)] text-[var(--color-foreground)] outline-none focus:ring-2 focus:ring-[var(--color-ring)] resize-y"
          />
        </div>
      )}

      {/* Tệp bằng chứng cho cả phiếu (ngoài ô dẫn chứng bằng chữ ở từng tiêu chí). Khoá theo
          (phạm vi, đợt/kỳ, người) nên nhân viên và quản lý cùng nhìn một danh sách. */}
      {(sheet.kpiPeriodId || sheet.kpiCycleId) && (
        <EvidenceAttachments
          target={evidenceKey.conduct(sheet.scope, (sheet.scope === 'CYCLE' ? sheet.kpiCycleId : sheet.kpiPeriodId) as string, sheet.userId)}
          readOnly={!!sheet.locked || (!sheet.canScoreSelf && !sheet.canScoreManager)}
          title="Minh chứng hạnh kiểm"
        />
      )}

      <div id="tour-conduct-sheet-actions" className="flex flex-wrap items-center justify-end gap-3">
        <Button variant="outline" className="mr-auto" onClick={handleExport}>
          <FileSpreadsheet aria-hidden="true" /> Xuất Excel
        </Button>
        {sheet.canScoreSelf && (
          <Button onClick={() => onSaveSelf(collect('self'))} disabled={isSavingSelf}>
            {isSavingSelf ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Lưu tự đánh giá
          </Button>
        )}
        {sheet.canScoreManager && (
          <Button onClick={() => onSaveManager({ items: collect('manager'), comment })} disabled={isSavingManager}>
            {isSavingManager ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            Lưu điểm quản lý
          </Button>
        )}
        {!sheet.canScoreSelf && !sheet.canScoreManager && !sheet.locked && (
          <p className="text-caption">Bạn chỉ có quyền xem phiếu này.</p>
        )}
      </div>
    </div>
  )
}
