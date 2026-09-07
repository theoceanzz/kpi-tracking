import { ResponsiveContainer, LineChart, XAxis, YAxis, Tooltip, CartesianGrid, Line } from 'recharts'
import { Loader2 } from 'lucide-react'
import type { ComboChartPoint } from '@/types/stats'
import { usePerformanceScale } from '../hooks/usePerformanceScale'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import { TrendModeToggle } from '@/components/common/dashboard/TrendModeToggle'
import { useTrendMode } from '@/components/common/dashboard/useTrendMode'
import ChartTooltip from '@/components/charts/ChartTooltip'
import { yAxisLabel } from '@/components/charts/axisLabel'

/** Màu KPI cũ / mới ở chế độ "Cơ cấu %". Chế độ xu hướng không còn vẽ số lượng thành hình riêng. */
const OLD_COLOR = '#64748b'
const NEW_COLOR = '#4f46e5'

const DOT_R_MIN = 3
const DOT_R_MAX = 9

/** Điểm dữ liệu mà Recharts truyền vào hàm vẽ chấm. */
interface DotRenderProps {
  cx?: number
  cy?: number
  payload?: ComboChartPoint
}

const totalItems = (p?: ComboChartPoint) => (p?.oldItems ?? 0) + (p?.newItems ?? 0)

interface AnalyticsComboChartProps {
  data: ComboChartPoint[]
  isLoading?: boolean
  itemName?: string
  /** Lấp đầy chiều cao vật chứa (h-full) thay vì min-height cố định — dùng khi nhúng vào widget lưới. */
  fillHeight?: boolean
}

const CustomTooltip = ({ active, payload, label, perf, itemName }: any) => {
  if (!active || !payload?.length) return null
  const row: ComboChartPoint | undefined = payload[0]?.payload
  return (
    <ChartTooltip
      title={label}
      rows={payload.map((entry: any) => ({
        color: entry.color,
        label: entry.name,
        // Đường hiệu suất theo đơn vị của org (điểm/%); tiến độ luôn %.
        value: entry.dataKey === 'performanceTrend'
          ? (perf?.isMatrix ? `${entry.value} ${perf.unit}` : `${entry.value}%`)
          : `${entry.value}${entry.dataKey?.includes('Trend') ? '%' : ''}`,
      }))}
      footer={row && (
        <>
          Tính trên{' '}
          <span className="font-bold text-slate-600 dark:text-slate-300 tabular-nums">{totalItems(row)}</span>
          {' '}{String(itemName ?? '').toLowerCase()}{' '}
          <span className="tabular-nums">({row.oldItems ?? 0} cũ · {row.newItems ?? 0} mới)</span>
        </>
      )}
    />
  )
}

export default function AnalyticsComboChart({ data, isLoading, itemName = 'Mục tiêu', fillHeight = false }: AnalyticsComboChartProps) {
  // Khoá theo `itemName` vì component không có prop định danh. Gom theo ý nghĩa biểu đồ là đúng ý:
  // "KPI đảm nhiệm" ở tab của tôi và tab mục tiêu của tôi vốn là cùng một biểu đồ.
  const { mode, setMode, isShare } = useTrendMode(`combo:${itemName}`)
  const perf = usePerformanceScale()

  if (isLoading) {
    return (
      <div className={`w-full ${fillHeight ? 'h-full' : 'h-[400px]'} flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800`}>
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-500 font-medium">Đang tải dữ liệu biểu đồ...</p>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className={`w-full ${fillHeight ? 'h-full' : 'h-[400px]'} flex items-center justify-center bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800`}>
        <p className="text-slate-500 font-medium">Không có dữ liệu trong thời gian này</p>
      </div>
    )
  }

  // Cỡ chấm mang số KPI của kỳ. Thang theo CĂN BẬC HAI vì mắt đọc diện tích chứ không đọc bán
  // kính — nhân đôi bán kính là gấp bốn diện tích, nên thang tuyến tính sẽ thổi phồng chênh lệch
  // số lượng lên gấp đôi mức thật. Chấm nhỏ nhất vẫn giữ DOT_R_MIN để kỳ ít KPI không tàng hình.
  const totals = data.map(totalItems)
  const maxTotal = Math.max(...totals)
  // Mọi kỳ bằng nhau (hoặc không có KPI nào) thì cỡ chấm không mang tin gì — dùng một cỡ trung
  // tính, đừng để chấm co giãn tuỳ tiện trên dữ liệu vốn không có chênh lệch.
  const uniformSize = maxTotal <= 0 || maxTotal === Math.min(...totals)
  const dotRadius = (total: number) => (uniformSize
    ? (DOT_R_MIN + DOT_R_MAX) / 2
    : DOT_R_MIN + (DOT_R_MAX - DOT_R_MIN) * Math.sqrt(total / maxTotal))

  const renderDot = (color: string) => ({ cx, cy, payload }: DotRenderProps) => {
    if (cx == null || cy == null) return <g />
    return (
      <circle
        cx={cx} cy={cy} r={dotRadius(totalItems(payload))}
        fill="#fff" stroke={color} strokeWidth={2.5}
      />
    )
  }

  return (
    <div className={`w-full ${fillHeight ? 'h-full' : 'min-h-[510px]'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm relative flex flex-col`}>
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {isShare ? `Cơ cấu ${itemName} theo thời gian` : `Xu hướng ${itemName}: Tiến độ & Hiệu suất`}
            <span className="text-[10px] text-indigo-500 font-bold" title="API độc lập">*</span>
          </h3>
          <p className="text-sm text-slate-500 mt-1">
            {isShare
              ? `Mỗi mốc cao đúng 100% — cho thấy tỉ trọng ${itemName.toLowerCase()} mới so với cũ dịch chuyển ra sao qua thời gian`
              : `Tiến độ và hiệu suất qua từng kỳ — cỡ chấm cho biết kỳ đó tính trên bao nhiêu ${itemName.toLowerCase()}`}
          </p>
        </div>
        <TrendModeToggle mode={mode} onChange={setMode} />
      </div>

      {isShare ? (
        <div className={`flex-1 ${fillHeight ? 'min-h-0' : 'min-h-[380px]'}`}>
          <StackedComposition
            series={[
              { code: 'old', label: `Số ${itemName} cũ`, color: OLD_COLOR },
              { code: 'new', label: `Số ${itemName} mới`, color: NEW_COLOR },
            ]}
            points={data.map(p => ({
              label: p.label,
              values: { old: p.oldItems, new: p.newItems },
            }))}
            variant="area"
            normalize
            yLabel="Tỉ trọng (%)"
            unit={itemName.toLowerCase()}
            height={fillHeight ? '100%' : 380}
          />
        </div>
      ) : (
      <>
        {/* Nhãn trục nằm TRÊN trục (xem `yAxisLabel`), không còn là một hàng chữ rời phía trên.
            Riêng org dùng ma trận vẫn cần ghú riêng: đường hiệu suất đọc theo thang điểm ẨN,
            không cùng thang với tiến độ, mà trục ẩn thì không gắn nhãn vào đâu được. */}
        {perf.isMatrix && (
          <div className="flex justify-end text-xs font-bold text-slate-400 dark:text-slate-500 mb-2 px-1">
            <span>Hiệu suất: điểm/{perf.maxScore}</span>
          </div>
        )}

        {/* Chiều cao phải XÁC ĐỊNH thì `height="100%"` mới quy chiếu được; `min-h` thì không, phần
            trăm rơi về auto và ResponsiveContainer đo ra 0 — chừa chỗ trống mà không vẽ gì. Nhánh
            "Cơ cấu %" ngay trên đã truyền số cụ thể, chỗ này để đồng nhất. */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height={fillHeight ? '100%' : 380} minHeight={0}>
            <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                dy={10}
              />
              <YAxis
                yAxisId="left"
                label={yAxisLabel(perf.isMatrix ? 'Tiến độ (%)' : 'Tỉ lệ (%)')}
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748B', fontSize: 12, fontWeight: 500 }}
                tickFormatter={(val) => `${Math.round(val)}%`}
                // Sàn 100% để cùng một mức 40% trông giống nhau ở mọi tab và mọi khoảng lọc — dải
                // tự co giãn khiến hai biểu đồ cạnh nhau không so được. Vẫn nới lên khi tiến độ
                // vượt 100% (KPI vượt chỉ tiêu), nếu không đường sẽ bị cắt cụt ở đỉnh.
                domain={[0, (max: number) => Math.max(100, Math.ceil(max / 10) * 10)]}
              />
              {/* Trục ẩn cho hiệu suất khi org dùng matrix (thang điểm 0..max), để đường không bị dí sát đáy. */}
              {perf.isMatrix && <YAxis yAxisId="perf" orientation="right" domain={[0, perf.axisMax]} hide />}

              <Tooltip content={<CustomTooltip perf={perf} itemName={itemName} />} />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="completionTrend"
                name="Xu hướng Tiến độ"
                stroke="#10b981"
                strokeWidth={3}
                dot={renderDot('#10b981')}
                activeDot={{ r: 7, strokeWidth: 0 }}
              />
              <Line
                yAxisId={perf.isMatrix ? 'perf' : 'left'}
                type="monotone"
                dataKey="performanceTrend"
                name="Xu hướng Hiệu suất"
                stroke="#f59e0b"
                strokeWidth={3}
                dot={renderDot('#f59e0b')}
                activeDot={{ r: 7, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Custom legend rendered in normal flow so it never overlaps chart content on narrow screens */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <LegendItem color="#10b981" label="Xu hướng Tiến độ" />
          <LegendItem color="#f59e0b" label="Xu hướng Hiệu suất" />
          {/* Không có dòng này thì cỡ chấm chỉ là nhiễu thị giác. */}
          {!uniformSize && (
            <span className="text-slate-400 dark:text-slate-500">
              Cỡ chấm = số {itemName.toLowerCase()} của kỳ đó
            </span>
          )}
        </div>
      </>
      )}
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </div>
  )
}
