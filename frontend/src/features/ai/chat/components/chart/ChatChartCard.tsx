import { useMemo, useState } from 'react'
import { BarChart3, Table2 } from 'lucide-react'
import type { ChatChart } from '../../api/aiApi'
import { resolveColorToken } from './colorTokens'
import SimpleBar from '@/components/charts/primitives/SimpleBar'
import TrendLine from '@/components/charts/primitives/TrendLine'
import Donut from '@/components/charts/primitives/Donut'
import Lollipop from '@/components/charts/primitives/Lollipop'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import BulletChart from '@/components/charts/primitives/BulletChart'
import Histogram from '@/components/charts/primitives/Histogram'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { formatNumber } from '@/lib/utils'

interface Props {
  chart: ChatChart
  /** Vùng vẽ hẹp (bong bóng chat ~390px) thì thu gọn chiều cao và nhãn. */
  compact?: boolean
}

/**
 * Thẻ biểu đồ trong khung chat: trợ lý chọn loại và nhãn, client dựng bằng ĐÚNG bộ biểu đồ của ứng
 * dụng (cùng tooltip, cùng bảng màu, cùng quy tắc nhãn trục) nên số liệu trong chat và trên màn hình
 * trông như một.
 *
 * <p>Luôn kèm nút xem BẢNG: biểu đồ trả lời câu "hơn kém thế nào", bảng trả lời câu "chính xác bao
 * nhiêu" — và người dùng cần chép số thì bảng là thứ duy nhất dùng được.
 */
export default function ChatChartCard({ chart, compact }: Props) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const height = compact ? 220 : 280

  const series = useMemo(
    () => (chart.series ?? []).map((s, i) => ({ ...s, resolved: resolveColorToken(s.color, i) })),
    [chart.series],
  )

  const format = useMemo(() => {
    switch (chart.valueFormat) {
      case 'percent': return (v: number | string) => `${formatNumber(Number(v), 1)}%`
      case 'score5': return (v: number | string) => `${formatNumber(Number(v), 1)}/5`
      case 'currency': return (v: number | string) => formatNumber(Number(v), 0)
      default: return undefined
    }
  }, [chart.valueFormat])

  const num = (row: Record<string, unknown>, key: string) => {
    const v = row[key]
    return typeof v === 'number' ? v : Number(v) || 0
  }

  return (
    <div className="mt-2 w-full rounded-card border border-[var(--color-ai-line)] bg-[var(--color-card)] p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-foreground)]">{chart.title}</p>
          {chart.subtitle && <p className="text-caption">{chart.subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <ChoiceChip variant="segment" selected={view === 'chart'} onClick={() => setView('chart')} title="Xem biểu đồ">
            <BarChart3 size={13} aria-hidden="true" />
          </ChoiceChip>
          <ChoiceChip variant="segment" selected={view === 'table'} onClick={() => setView('table')} title="Xem bảng số liệu">
            <Table2 size={13} aria-hidden="true" />
          </ChoiceChip>
        </div>
      </div>

      {view === 'table' ? (
        <div className="overflow-x-auto rounded-control border border-[var(--color-border)]">
          <table className="w-full min-w-max border-collapse text-sm">
            <thead className="bg-[var(--color-ai-soft)] text-left">
              <tr>
                <th className="px-3 py-2 text-xs font-medium text-[var(--color-ai)] whitespace-nowrap">{chart.xLabel ?? 'Hạng mục'}</th>
                {series.map(s => (
                  <th key={s.key} className="px-3 py-2 text-xs font-medium text-[var(--color-ai)] whitespace-nowrap">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.map((row, i) => (
                <tr key={i}>
                  <td className="border-t border-[var(--color-border)] px-3 py-2 align-top">{String(row[chart.categoryKey] ?? '')}</td>
                  {series.map(s => (
                    <td key={s.key} className="border-t border-[var(--color-border)] px-3 py-2 align-top tabular-nums">
                      {row[s.key] == null ? '—' : format ? format(num(row, s.key)) : formatNumber(num(row, s.key))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        renderChart(chart, series, height, format, num, !!compact)
      )}

      {chart.note && <p className="mt-2 text-xs italic text-[var(--color-muted-foreground)]">{chart.note}</p>}
    </div>
  )
}

type ResolvedSeries = ChatChart['series'][number] & { resolved: string }

/** Cắt tên quá dài, giữ dấu ba chấm để người đọc biết là còn nữa. */
function shorten(text: string, max: number) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text
}

function renderChart(
  chart: ChatChart,
  series: ResolvedSeries[],
  height: number,
  format: ((v: number | string) => string) | undefined,
  num: (row: Record<string, unknown>, key: string) => number,
  compact: boolean,
) {
  const cat = chart.categoryKey
  const first = series[0]
  if (!first) return null
  const barSeries = series.map(s => ({ key: s.key, label: s.label, color: s.resolved }))
  const reference = chart.reference?.value != null
    ? { value: chart.reference.value, label: chart.reference.label ?? '' }
    : undefined

  switch (chart.type) {
    case 'line':
    case 'area':
      return (
        <TrendLine
          data={chart.data} categoryKey={cat} series={barSeries} variant={chart.type === 'area' ? 'area' : 'line'}
          unit={chart.unit} xLabel={chart.xLabel} yLabel={chart.yLabel} reference={reference}
          height={height} format={format}
        />
      )

    case 'lollipop':
      return (
        <Lollipop
          // Khung hẹp: cắt tên dài và thu cột tên lại, nếu không tên chiếm hơn một phần ba chỗ vẽ.
          // Tên đầy đủ vẫn còn nguyên ở chế độ xem Bảng.
          data={chart.data.map(r => ({
            name: shorten(String(r[cat] ?? ''), compact ? 18 : 40),
            value: num(r, first.key),
            color: first.resolved,
          }))}
          unit={chart.unit ?? ''} valueLabel={chart.yLabel ?? chart.xLabel} reference={reference}
          yAxisWidth={compact ? 104 : undefined}
        />
      )

    case 'stackedBar':
    case 'stacked100':
      return (
        <StackedComposition
          series={series.map(s => ({ code: s.key, label: s.label, color: s.resolved }))}
          points={chart.data.map(r => ({
            label: String(r[cat] ?? ''),
            values: Object.fromEntries(series.map(s => [s.key, num(r, s.key)])),
          }))}
          variant="bar" normalize={chart.type === 'stacked100'}
          unit={chart.unit} xLabel={chart.xLabel} yLabel={chart.yLabel} height={height}
        />
      )

    case 'donut':
      return (
        <Donut
          data={chart.data.map((r, i) => ({
            name: String(r[cat] ?? ''), value: num(r, first.key),
            color: series.length > 1 ? series[i]?.resolved : undefined,
          }))}
          unit={chart.unit ?? ''} height={height}
        />
      )

    case 'bullet': {
      const pick = (role: string) => series.find(s => s.role === role)?.key
      const actual = pick('actual') ?? first.key
      const target = pick('target') ?? series[1]?.key
      return (
        <BulletChart
          data={chart.data.map(r => ({
            name: String(r[cat] ?? ''),
            actual: num(r, actual),
            target: target ? num(r, target) : 0,
            unit: chart.unit,
          }))}
          valueLabel={chart.yLabel ?? 'Tiến độ (%)'}
        />
      )
    }

    case 'histogram':
      return (
        <Histogram
          bins={chart.data.map(r => ({
            label: String(r[cat] ?? ''), from: 0, to: 0, count: num(r, first.key),
          }))}
          unit={chart.unit} countLabel={chart.yLabel} height={height}
        />
      )

    case 'metricCards':
      return (
        <div className="grid grid-cols-2 gap-2">
          {chart.data.map((r, i) => (
            <div key={i} className="rounded-control border border-[var(--color-border)] bg-[var(--color-background)] p-2.5">
              <p className="text-caption truncate">{String(r[cat] ?? '')}</p>
              <p className="text-lg font-semibold tabular-nums text-[var(--color-foreground)]">
                {format ? format(num(r, first.key)) : formatNumber(num(r, first.key))}
                {!format && chart.unit ? <span className="ml-1 text-xs font-normal text-[var(--color-muted-foreground)]">{chart.unit}</span> : null}
              </p>
            </div>
          ))}
        </div>
      )

    // bar, groupedBar và mọi loại còn lại
    default:
      return (
        <SimpleBar
          data={chart.data} categoryKey={cat} series={barSeries}
          unit={chart.unit} xLabel={chart.xLabel} yLabel={chart.yLabel} reference={reference}
          highlight={chart.highlight} height={height} format={format}
        />
      )
  }
}
