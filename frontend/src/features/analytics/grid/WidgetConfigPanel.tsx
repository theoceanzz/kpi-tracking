import { cn } from '@/lib/utils'
import ChartTypePreview from '@/components/charts/ChartTypePreview'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import type { WidgetSettings } from '@/components/common/dashboard/widgetSettings'
import DateFilterFields from '../filter/DateFilterFields'
import type { DateFilterIntent } from '../filter/dateFilterModel'
import type { KpiCycle, KpiPeriod } from '@/types/kpi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { summarizeIntent } from '../filter/summarizeIntent'
import {
  WIDGET_HAS_TABLE, WIDGET_HAS_UNIT, WIDGET_OPTIONS, WIDGET_VARIANTS, widgetVariant,
  type OptionField,
} from './analyticsGrid'

/**
 * Nội dung bảng cấu hình của một ô: cách biểu diễn và bộ lọc riêng.
 *
 * <p>Bộ lọc mặc định NHIỀU ô cùng dùng nên phải nói rõ ô này đang theo mặc định hay đã tách ra —
 * không thì người dùng đổi một ô rồi tưởng cả trang đã đổi theo.
 */
const ALL_UNITS = '__ALL__'

export default function WidgetConfigPanel({
  widget, update, pageIntent, periods, cycles, unitOptions, extraFields,
}: {
  widget: DashboardWidget
  update: (patch: Partial<WidgetSettings>) => void
  /** Bộ lọc mặc định của trang — thứ ô sẽ dùng khi chưa tách riêng. */
  pageIntent: DateFilterIntent
  periods: KpiPeriod[]
  cycles: KpiCycle[]
  /** Danh sách đơn vị cho mục "Đơn vị" — do tab cấp vì mỗi tab có một nguồn cây đơn vị. */
  unitOptions?: { id: string; label: string }[]
  /**
   * Tuỳ chọn ĐỘNG mà `WIDGET_OPTIONS` không khai tĩnh được (vd danh sách Objective/KR lấy từ phản
   * hồi API). Cùng hình dạng `OptionField`, ghi vào `s.o[key]` như tuỳ chọn tĩnh.
   */
  extraFields?: OptionField[]
}) {
  const variants = WIDGET_VARIANTS[widget.i]
  const currentVariant = widgetVariant(widget)
  const custom = widget.s?.f
  const intent = custom ?? pageIntent

  const hasTable = WIDGET_HAS_TABLE.has(widget.i)
  const asTable = widget.s?.table === true

  const hasUnit = WIDGET_HAS_UNIT.has(widget.i) && !!unitOptions
  const fields = [...(WIDGET_OPTIONS[widget.i] ?? []), ...(extraFields ?? [])]
  const setOption = (key: string, value: string) => {
    const o = { ...widget.s?.o, [key]: value }
    fields.find(f => f.key === key)?.clears?.forEach(k => { delete o[k] })
    update({ o })
  }

  return (
    <div className="space-y-7">
      {hasTable && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Kiểu hiển thị</h4>
          <div className="grid grid-cols-2 gap-2">
            {([['chart', 'Biểu đồ'], ['table', 'Bảng']] as const).map(([key, label]) => {
              const active = (key === 'table') === asTable
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => update({ table: key === 'table' })}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    active
                      ? 'border-[var(--color-primary)] bg-indigo-50/60 dark:bg-indigo-500/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-slate-500 hover:border-indigo-400 hover:text-[var(--color-primary)]'
                  )}
                >
                  <ChartTypePreview shape={key === 'table' ? 'table' : 'bar'} className="w-16 h-11" />
                  <span className="text-xs font-semibold">{label}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs font-medium text-slate-400 leading-relaxed">
            Bảng giữ nguyên sắp xếp, lọc và phân trang; biểu đồ cho thấy toàn cảnh trong một cái liếc.
          </p>
        </section>
      )}

      {variants?.length ? (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Cách biểu diễn</h4>
          <div className="grid grid-cols-2 gap-2">
            {variants.map(v => {
              const active = v.key === currentVariant
              return (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => update({ v: v.key })}
                  aria-pressed={active}
                  title={v.hint}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-2xl border transition-all cursor-pointer',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                    active
                      ? 'border-[var(--color-primary)] bg-indigo-50/60 dark:bg-indigo-500/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-slate-500 hover:border-indigo-400 hover:text-[var(--color-primary)]'
                  )}
                >
                  <ChartTypePreview shape={v.shape} className="w-16 h-11" />
                  <span className="text-xs font-semibold">{v.label}</span>
                </button>
              )
            })}
          </div>
          {variants.find(v => v.key === currentVariant)?.hint && (
            <p className="mt-2 text-xs font-medium text-slate-400 leading-relaxed">
              {variants.find(v => v.key === currentVariant)!.hint}
            </p>
          )}
        </section>
      ) : null}

      {fields.length > 0 && (
        <section>
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Tuỳ chọn</h4>
          <div className="space-y-3">
            {fields.map(f => {
              const value = widget.s?.o?.[f.key] ?? f.default
              return (
                <div key={f.key}>
                  <p className="text-xs font-medium text-[var(--color-muted-foreground)] mb-1.5">{f.label}</p>
                  {f.kind === 'pills' ? (
                    <div className="flex flex-wrap gap-1.5">
                      {f.choices.map(c => {
                        const active = c.value === value
                        return (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setOption(f.key, c.value)}
                            aria-pressed={active}
                            className={cn(
                              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                              active
                                ? 'border-[var(--color-primary)] bg-indigo-50/60 dark:bg-indigo-500/10 text-[var(--color-primary)]'
                                : 'border-[var(--color-border)] text-slate-500 hover:border-indigo-400 hover:text-[var(--color-primary)]'
                            )}
                          >
                            {c.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <Select value={value} onValueChange={v => setOption(f.key, v)}>
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[120]">
                        {f.choices.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {hasUnit && (
        <section>
          <div className="flex items-center justify-between gap-2 mb-3">
            <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Đơn vị</h4>
            {widget.s?.orgUnitId && (
              <button
                type="button"
                onClick={() => update({ orgUnitId: undefined })}
                className="text-xs font-semibold text-[var(--color-primary)] hover:underline underline-offset-2 cursor-pointer"
              >
                Tất cả
              </button>
            )}
          </div>
          <Select
            value={widget.s?.orgUnitId ?? ALL_UNITS}
            onValueChange={v => update({ orgUnitId: v === ALL_UNITS ? undefined : v })}
          >
            <SelectTrigger className="h-9 w-full" aria-label="Đơn vị">
              <SelectValue placeholder="Tất cả đơn vị" />
            </SelectTrigger>
            <SelectContent className="z-[120]">
              <SelectItem value={ALL_UNITS}>Tất cả đơn vị</SelectItem>
              {unitOptions!.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500">Khoảng thời gian</h4>
          {custom && (
            <button
              type="button"
              onClick={() => update({ f: undefined })}
              className="text-xs font-semibold text-[var(--color-primary)] hover:underline underline-offset-2 cursor-pointer"
            >
              Về mặc định
            </button>
          )}
        </div>

        <div
          className={cn(
            'mb-3 rounded-lg px-3 py-2 text-xs font-medium',
            custom
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
              : 'bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
          )}
        >
          {custom ? 'Biểu đồ này đang dùng khoảng riêng.' : `Đang theo mặc định: ${summarizeIntent(pageIntent, periods, cycles)}.`}
        </div>

        {/* Đụng vào bất kỳ ô nào là tách khỏi mặc định — không bắt bấm thêm một nút "tách riêng",
            vì người mở bảng này ra vốn đã có ý định đổi cho riêng biểu đồ đó. */}
        <DateFilterFields
          value={intent}
          onChange={next => update({ f: next })}
          periods={periods}
          cycles={cycles}
          className="!flex-col !items-stretch gap-2"
          selectClassName="h-9"
          fullWidth
        />
      </section>
    </div>
  )
}
