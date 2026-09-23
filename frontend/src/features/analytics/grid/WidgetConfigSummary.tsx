import { Building2, CalendarRange, SlidersHorizontal, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { DateFilterIntent } from '../filter/dateFilterModel'
import { summarizeIntent } from '../filter/summarizeIntent'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import {
  WIDGET_HAS_TABLE, WIDGET_HAS_UNIT, WIDGET_OPTIONS, WIDGET_VARIANTS, type OptionField, widgetVariant,
} from './analyticsGrid'

/**
 * Một hàng chip nhỏ nói "ô này đang theo cấu hình gì" — để người xem biết mà không phải mở bảng
 * cấu hình. Chip khoảng thời gian tô đậm khi ô đặt RIÊNG, nhạt khi đang theo mặc định trang:
 * nhiều ô cùng theo mặc định nên phải phân biệt được cái nào đã tách ra.
 *
 * Bấm vào hàng chip mở đúng bảng cấu hình của ô đó.
 */
export default function WidgetConfigSummary({
  widget, pageIntent, periods, cycles, unitOptions, extraFields, unitLabel, onOpen,
}: {
  widget: DashboardWidget
  pageIntent: DateFilterIntent
  periods: KpiPeriod[]
  cycles: KpiCycle[]
  unitOptions?: { id: string; label: string; name?: string }[]
  /** Tuỳ chọn động do tab cấp (cùng cái đưa vào bảng cấu hình) — để chip khớp với drawer. */
  extraFields?: OptionField[]
  /**
   * Nhãn đơn vị do TRANG cấp (tab So sánh các đơn vị: đơn vị đang chọn ở cây bên trái). Chip chỉ
   * đọc; bảng cấu hình của ô không có mục Đơn vị vì đơn vị là điều hướng của trang, không phải
   * cài đặt của ô.
   */
  unitLabel?: string
  onOpen?: () => void
}) {
  const custom = !!widget.s?.f
  const time = summarizeIntent(widget.s?.f ?? pageIntent, periods, cycles)

  const chips: { icon: React.ReactNode; text: string; strong?: boolean; hint?: string }[] = [
    { icon: <CalendarRange size={11} />, text: time, strong: custom },
  ]

  if (unitLabel) {
    chips.push({ icon: <Building2 size={11} />, text: unitLabel })
  } else if (WIDGET_HAS_UNIT.has(widget.i)) {
    const id = widget.s?.orgUnitId
    const u = id ? unitOptions?.find(x => x.id === id) : undefined
    const label = id ? (u?.name ?? u?.label ?? 'Một đơn vị') : 'Tất cả đơn vị'
    chips.push({ icon: <Building2 size={11} />, text: label, strong: !!id })
  }

  const variants = WIDGET_VARIANTS[widget.i]
  if (variants?.length) {
    const v = widgetVariant(widget)
    const label = variants.find(o => o.key === v)?.label
    if (label) chips.push({ icon: <SlidersHorizontal size={11} />, text: label })
  }

  ;[...(WIDGET_OPTIONS[widget.i] ?? []), ...(extraFields ?? [])].forEach(f => {
    const val = widget.s?.o?.[f.key] ?? f.default
    const strong = val !== f.default
    // Giá trị đã lưu mà danh sách lựa chọn (tải từ API) chưa có/không còn: vẫn hiện mã thô để
    // người xem biết ô đang bị lọc, thay vì im lặng.
    const label = f.choices.find(c => c.value === val)?.label ?? (strong ? val : undefined)
    // Kèm tên trường mờ phía trước: "Tất cả" đứng một mình không nói được là tất cả CÁI GÌ.
    if (label) chips.push({ icon: null, hint: f.label, text: label, strong })
  })

  if (WIDGET_HAS_TABLE.has(widget.i) && widget.s?.table) {
    chips.push({ icon: <Table2 size={11} />, text: 'Bảng' })
  }

  return (
    <button
      type="button"
      data-config-summary
      onClick={onOpen}
      title="Mở cấu hình biểu đồ"
      className="flex flex-wrap items-center gap-1.5 text-left cursor-pointer group/summary"
    >
      {chips.map((c, i) => (
        <span
          key={i}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium leading-4 transition-colors',
            c.strong
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300 group-hover/summary:bg-indigo-100'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 group-hover/summary:bg-slate-200 dark:group-hover/summary:bg-slate-700'
          )}
          data-strong={c.strong ? '1' : undefined}
        >
          {c.icon && <span className="opacity-70" aria-hidden="true">{c.icon}</span>}
          {c.hint && <span className="font-medium opacity-60">{c.hint}</span>}
          {c.text}
        </span>
      ))}
    </button>
  )
}
