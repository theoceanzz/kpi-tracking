import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts'
import { AXIS_COLORS, METRIC_COLORS, NEUTRAL_COLOR, resolveColor } from '@/components/charts/chartPalette'
import BubbleChart from '@/components/charts/primitives/BubbleChart'
import Waterfall from '@/components/charts/primitives/Waterfall'
import {
  useBscVsSystemScatter, useBscWaterfall, usePerspectiveBubble, useWeightHistory,
} from '../../hooks/useAdvancedAnalytics'
import type { AdvancedFilter } from '../../api/advancedAnalyticsApi'
import StackedComposition from '@/components/charts/primitives/StackedComposition'
import { TrendModeToggle } from '@/components/common/dashboard/TrendModeToggle'
import { useTrendMode } from '@/components/common/dashboard/useTrendMode'

function Empty({ children, height = 240 }: { children: React.ReactNode; height?: number }) {
  return (
    <div className="flex items-center justify-center text-sm text-[var(--color-subtle-foreground)] font-medium text-center px-4" style={{ height }}>
      {children}
    </div>
  )
}

function Loading({ height = 240 }: { height?: number }) {
  return <div className="flex items-center justify-center text-[var(--color-subtle-foreground)] font-semibold" style={{ height }}>Đang tải...</div>
}

// ============================================================
// R2 — Điểm BSC vs điểm hệ thống
// ============================================================

/**
 * Đường chéo y=x là nơi hai cách chấm đồng ý; chấm càng xa đường đó thì hai hệ càng mâu thuẫn
 * về đúng người đó — thứ mà biểu đồ cột đối chiếu không cho thấy vì nó xếp hai giá trị cạnh nhau.
 */
export function BscVsSystemScatterSection({ filter }: { filter: AdvancedFilter }) {
  const { data, isLoading } = useBscVsSystemScatter(filter)
  const points = data?.points ?? []
  const max = data?.axisMax ?? 100

  if (isLoading) return <Loading />
  if (points.length === 0) {
    return <Empty>Chưa có đánh giá nào có đủ cả điểm BSC và điểm hệ thống để đối chiếu</Empty>
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={320}>
        <ScatterChart margin={{ top: 12, right: 20, left: 0, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLORS.grid} />
          <XAxis
            type="number" dataKey="systemScore" name="Điểm hệ thống" domain={[0, max]}
            axisLine={false} tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
            label={{ value: 'Điểm hệ thống', position: 'insideBottom', offset: -12, fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 700 }}
          />
          <YAxis
            type="number" dataKey="bscScore" name="Điểm BSC" domain={[0, max]}
            axisLine={false} tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          />
          {/* Đường đồng thuận: chấm nằm trên đường này nghĩa là hai cách chấm cho cùng kết quả. */}
          <ReferenceLine
            segment={[{ x: 0, y: 0 }, { x: max, y: max }]}
            stroke={NEUTRAL_COLOR}
            strokeDasharray="5 5"
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={<AgreementTooltip />} />
          <Scatter data={points}>
            {points.map((p, i) => (
              <Cell
                key={i}
                fill={Math.abs(p.gap) >= 10 ? '#f59e0b' : METRIC_COLORS.performance.normal}
                fillOpacity={p.isSelf ? 1 : 0.7}
                stroke={p.isSelf ? '#0f172a' : 'none'}
                strokeWidth={p.isSelf ? 2 : 0}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-caption font-medium text-center mt-1">
        {points.length} nhân sự · chấm màu cam là nơi hai cách chấm lệch nhau từ 10 điểm trở lên
        {data?.scoringMode === 'SHADOW' ? ' · BSC đang chạy song song' : ''}
      </p>
    </div>
  )
}

function AgreementTooltip({ active, payload }: {
  active?: boolean
  payload?: { payload: { name?: string | null; systemScore: number; bscScore: number; gap: number; evaluationCount?: number } }[]
}) {
  const d = payload?.[0]?.payload
  if (!active || !d) return null
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card">
      <p className="font-semibold text-[var(--color-foreground)] mb-2">{d.name ?? 'Một nhân sự'}</p>
      <div className="space-y-1 text-sm">
        <p><span className="text-[var(--color-muted-foreground)] font-medium">Điểm BSC: </span><span className="font-semibold tabular-nums">{d.bscScore}</span></p>
        <p><span className="text-[var(--color-muted-foreground)] font-medium">Điểm hệ thống: </span><span className="font-semibold tabular-nums">{d.systemScore}</span></p>
        <p className="pt-1.5 border-t border-[var(--color-border)] mt-1.5">
          <span className="text-[var(--color-muted-foreground)] font-medium">Lệch: </span>
          <span className="font-semibold tabular-nums" style={{ color: Math.abs(d.gap) >= 10 ? '#f59e0b' : '#64748b' }}>
            {d.gap > 0 ? '+' : ''}{d.gap}
          </span>
          <span className="text-caption ml-1">
            {d.gap > 0 ? '(BSC chấm rộng hơn)' : d.gap < 0 ? '(hệ thống chấm rộng hơn)' : ''}
          </span>
        </p>
        {d.evaluationCount != null && <p className="text-caption">{d.evaluationCount} lần đánh giá</p>}
      </div>
    </div>
  )
}

// ============================================================
// R3 — Bong bóng hạng mục
// ============================================================

export function PerspectiveBubbleSection({ filter }: { filter: AdvancedFilter }) {
  const { data, isLoading } = usePerspectiveBubble(filter)
  const bubbles = data?.bubbles ?? []

  if (isLoading) return <Loading />
  if (bubbles.length === 0) return <Empty>Chưa có hạng mục nào được chấm điểm trong kỳ này</Empty>

  return (
    <div className="w-full">
      <BubbleChart
        data={bubbles.map(b => ({
          id: b.perspectiveId,
          name: b.name,
          x: b.weightPercentage,
          y: b.averageScore,
          z: b.kpiCount,
          color: resolveColor(b.color, 0),
          subText: `${b.kpiCount} KPI`,
        }))}
        xLabel="Trọng số" yLabel="Điểm đạt" zLabel="Số KPI"
        xUnit="%" zUnit=" KPI"
        quadrant={{ x: data?.avgWeight ?? undefined, y: data?.avgScore ?? undefined }}
        height={320}
      />
      <p className="text-caption font-medium text-center mt-1">
        Góc phải-dưới là nơi cần xử lý trước: hạng mục được giao trọng số lớn nhưng điểm đạt thấp.
      </p>
    </div>
  )
}

// ============================================================
// P2 — Thác nước cấu thành điểm BSC
// ============================================================

export function BscWaterfallSection({ filter }: { filter: AdvancedFilter }) {
  const { data, isLoading } = useBscWaterfall(filter)
  const steps = data?.steps ?? []

  if (isLoading) return <Loading />
  if (steps.length === 0) return <Empty>Chưa có điểm hạng mục nào để dựng cấu thành</Empty>

  return (
    <div className="w-full">
      <Waterfall
        yLabel="Điểm đóng góp"
        data={steps.map(s => ({
          name: s.name,
          value: s.value,
          isTotal: s.isTotal,
          color: s.isTotal ? undefined : resolveColor(s.color, 0),
        }))}
        unit="điểm"
        height={320}
      />
      <p className="text-caption font-medium text-center mt-1">
        Mỗi cột là phần điểm hạng mục đó góp vào tổng (đã nhân trọng số) · cột cuối là điểm BSC.
      </p>
    </div>
  )
}

// ============================================================
// T3 — Lịch sử thay đổi trọng số hạng mục
// ============================================================

/**
 * Bảng {@code bsc_weight_history} là chỗ duy nhất trong hệ thống giữ lại giá trị CŨ của một cấu
 * hình, nên đây là biểu đồ duy nhất trả lời được "trọng số này từng là bao nhiêu, ai đổi, vì sao".
 */
export function WeightHistorySection({ filter }: { filter: AdvancedFilter }) {
  const { data, isLoading } = useWeightHistory(filter)
  const points = data?.points ?? []
  const perspectives = data?.perspectives ?? []
  // Đường đọc chính xác từng mức ("Tài chính đi từ 30% lên 40%"); vùng chồng cho thấy toàn cảnh
  // phân bổ dịch chuyển. Không cần `normalize` — trọng số hạng mục vốn đã cộng đúng 100.
  const { mode, setMode, isShare } = useTrendMode('bsc:weight-history')

  if (isLoading) return <Loading />
  if (points.length === 0) {
    return (
      <Empty>
        Chưa có lần thay đổi trọng số nào được ghi lại.<br />
        Biểu đồ này chỉ hiện sau khi trọng số hạng mục được điều chỉnh ít nhất một lần.
      </Empty>
    )
  }

  // Trải Record thành khoá phẳng để Recharts đọc được từng chuỗi.
  const rows = points.map(p => {
    const row: Record<string, string | number> = { label: p.label, __note: p.changeNote ?? '' }
    perspectives.forEach(ps => { row[ps.id] = p.values[ps.id] ?? 0 })
    return row
  })

  const toggle = (
    <div className="flex justify-end mb-2">
      <TrendModeToggle mode={mode} onChange={setMode} />
    </div>
  )

  if (isShare) {
    return (
      <div className="w-full">
        {toggle}
        <StackedComposition
          yLabel="Trọng số (%)"
          series={perspectives.map((ps, i) => ({
            code: ps.id, label: ps.name, color: resolveColor(ps.color, i),
          }))}
          points={points.map(p => ({ label: p.label, values: p.values }))}
          variant="area"
          step
          unit="%"
          height={300}
        />
        <p className="text-caption font-medium text-center mt-1">
          {data?.changeCount} lần điều chỉnh · vùng vẽ bậc thang vì trọng số giữ nguyên cho tới lần đổi kế tiếp.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {toggle}
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AXIS_COLORS.grid} />
          <XAxis
            dataKey="label" axisLine={false} tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
          />
          <YAxis
            domain={[0, 100]} axisLine={false} tickLine={false}
            tick={{ fill: AXIS_COLORS.tick, fontSize: 11, fontWeight: 500 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip content={<WeightTooltip perspectives={perspectives} />} />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
          {perspectives.map((ps, i) => (
            <Line
              key={ps.id}
              // Trọng số giữ nguyên cho tới lần đổi kế tiếp, nên bậc thang mới đúng — nội suy
              // mượt sẽ vẽ ra những giá trị chưa từng tồn tại giữa hai mốc.
              type="stepAfter"
              dataKey={ps.id}
              name={ps.name}
              stroke={resolveColor(ps.color, i)}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <p className="text-caption font-medium text-center mt-1">
        {data?.changeCount} lần điều chỉnh · di chuột lên mốc để xem ai đổi và lý do.
      </p>
    </div>
  )
}

function WeightTooltip({ active, payload, label, perspectives }: {
  active?: boolean
  payload?: { payload: Record<string, string | number> }[]
  label?: string
  perspectives: { id: string; name: string; color?: string | null }[]
}) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  const note = String(row['__note'] ?? '')
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-3.5 rounded-card max-w-[320px]">
      <p className="font-semibold text-[var(--color-foreground)] mb-2">{label}</p>
      <div className="space-y-1 text-sm">
        {perspectives.map((ps, i) => (
          <div key={ps.id} className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: resolveColor(ps.color, i) }} />
            <span className="text-[var(--color-muted-foreground)] font-medium min-w-[120px] truncate">{ps.name}:</span>
            <span className="font-semibold tabular-nums">{row[ps.id] ?? 0}%</span>
          </div>
        ))}
      </div>
      {note && (
        <p className="text-caption font-medium mt-2 pt-2 border-t border-[var(--color-border)]">
          {note}
        </p>
      )}
    </div>
  )
}
