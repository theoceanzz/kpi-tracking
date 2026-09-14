import { cn } from '@/lib/utils'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import type { UnitWeightBudget } from '@/features/dashboard/api/orgUnitKpiApi'

/** Mốc mà mỗi đơn vị phải chạm trước khi gửi duyệt chỉ tiêu. */
const TARGET = 100
/** Dưới ngưỡng này coi như bằng đúng mốc — tránh báo lệch vì sai số dấu phẩy động. */
const EPS = 0.01

/**
 * Ngân sách trọng số của từng đơn vị trong một đợt, đối chiếu với mốc 100%.
 *
 * <p>Treemap trả lời "trọng số dồn vào đâu, chỗ nào đỏ" — nó KHÔNG trả lời được "đơn vị nào chưa
 * đủ, đơn vị nào thừa", vì các đơn vị nằm chung một hình nên không còn phần-trên-tổng của riêng ai.
 * Dải này mới là phần-trên-tổng: mỗi đơn vị một thanh, mốc 100% là vạch chuẩn cố định.
 *
 * <p>Thừa và thiếu tô hai màu khác nhau chứ không gộp thành một màu "sai": thiếu trọng số là chưa
 * giao hết việc, thừa là giao quá tay — hai vấn đề khác nhau, xử lý khác nhau.
 */
export function WeightBudgetStrip({ rows }: { rows: UnitWeightBudget[] }) {
  if (rows.length === 0) return null

  const off = rows.filter(r => Math.abs(r.totalWeight - TARGET) > EPS)

  // Cả đợt đều đủ thì thu về một dòng. Đo trên dữ liệu thật: 11 trong 12 đợt chỉ có đúng một đơn
  // vị lệch, nên bảy thanh xanh giống hệt nhau chỉ tổ chiếm chỗ của phần đáng nhìn.
  if (off.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 size={14} className="shrink-0" />
        {rows.length}/{rows.length} đơn vị đủ trọng số (100%)
      </div>
    )
  }

  // Thang chung cho mọi thanh, để so được giữa các đơn vị. Tối thiểu 100 nên vạch chuẩn không bao
  // giờ chạm mép phải khi mọi đơn vị đều thiếu.
  const scaleMax = Math.max(TARGET, ...rows.map(r => r.totalWeight))
  const sorted = [...rows].sort((a, b) => Math.abs(b.totalWeight - TARGET) - Math.abs(a.totalWeight - TARGET))

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <AlertTriangle size={13} className="shrink-0" />
        {off.length}/{rows.length} đơn vị lệch trọng số
        <span className="font-medium text-slate-500 dark:text-slate-400 normal-case">
          tính theo phân bổ nhân sự cao nhất, đúng con số chặn lúc gửi duyệt
        </span>
      </div>

      <div className="space-y-1">
        {sorted.map(r => {
          const delta = r.totalWeight - TARGET
          const ok = Math.abs(delta) <= EPS
          const over = delta > 0
          return (
            <div key={`${r.periodId}-${r.orgUnitId}`} className="flex items-center gap-2">
              <span className="w-[132px] shrink-0 truncate text-xs font-semibold text-slate-600 dark:text-slate-300">
                {r.orgUnitName}
              </span>

              <div className="relative flex-1 h-3.5 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-l',
                    ok ? 'bg-emerald-400' : over ? 'bg-orange-400' : 'bg-sky-400')}
                  style={{ width: `${Math.min(100, (r.totalWeight / scaleMax) * 100)}%` }}
                />
                {/* Vạch 100% vẽ ĐÈ lên thanh: đây là thứ mắt phải bắt được trước tiên, thanh chỉ
                    là khoảng cách tới nó. */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-slate-900/70 dark:bg-white/70"
                  style={{ left: `${(TARGET / scaleMax) * 100}%` }}
                />
              </div>

              <span className={cn('w-[92px] shrink-0 text-right text-xs font-semibold tabular-nums',
                ok ? 'text-emerald-600' : over ? 'text-orange-600' : 'text-sky-600')}>
                {Math.round(r.totalWeight * 10) / 10}%
                <span className="font-semibold opacity-70">
                  {ok ? '' : over ? ` (+${Math.round(delta)})` : ` (${Math.round(delta)})`}
                </span>
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeightBudgetStrip
