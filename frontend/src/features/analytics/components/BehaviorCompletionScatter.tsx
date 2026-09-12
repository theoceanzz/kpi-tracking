import { useMemo } from 'react'
import {
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import { Loader2, EyeOff } from 'lucide-react'
import { AXIS_COLORS, NEUTRAL_COLOR, ratingColor } from '@/components/charts/chartPalette'
import { xAxisLabel, yAxisLabel } from '@/components/charts/axisLabel'
import type { BehaviorCompletionResponse, ScatterPoint } from '../api/advancedAnalyticsApi'

interface Props {
  data?: BehaviorCompletionResponse
  isLoading?: boolean
  /** Lấp đầy chiều cao ô lưới thay vì chiều cao cố định. */
  fillHeight?: boolean
}

interface PointTooltipProps {
  active?: boolean
  payload?: { payload: ScatterPoint }[]
  xLabel: string
  yLabel: string
}

function PointTooltip({ active, payload, xLabel, yLabel }: PointTooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  const anonymous = !p.name
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] p-4 rounded-card">
      <p className="font-semibold text-[var(--color-foreground)] mb-1">
        {p.isSelf ? 'Bạn' : anonymous ? 'Một thành viên khác' : p.name}
      </p>
      {p.orgUnitName && <p className="text-xs text-[var(--color-muted-foreground)] mb-3">{p.orgUnitName}</p>}
      <div className="space-y-1.5 text-sm">
        <Row label={xLabel} value={`${p.completion}%`} />
        <Row label={yLabel} value={String(p.behavior)} />
        {p.kpiCount != null && <Row label="Số KPI đang gánh" value={`${p.kpiCount} KPI`} />}
        {p.rating != null && (
          <Row label="Xếp loại" value={`${p.rating}/5`} color={ratingColor(p.rating)} />
        )}
      </div>
    </div>
  )
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-3">
      {color && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />}
      <span className="text-[var(--color-muted-foreground)] font-medium min-w-[120px]">{label}:</span>
      <span className="font-semibold text-[var(--color-foreground)]">{value}</span>
    </div>
  )
}

function Shell({ children, fillHeight }: { children: React.ReactNode; fillHeight?: boolean }) {
  return (
    <div className={`w-full ${fillHeight ? 'h-full' : 'h-[420px]'} flex flex-col items-center justify-center bg-[var(--color-muted)] rounded-card border border-[var(--color-border)]`}>
      {children}
    </div>
  )
}

/**
 * R1 — Phân tán "điểm hành vi × % hoàn thành KPI": mỗi chấm là một người trong một đợt.
 *
 * Heatmap ma trận đang có gộp mọi người vào ô và chỉ còn lại con số đếm, nên một người xuất sắc
 * lệch hẳn khỏi nhóm trông y hệt một người sát mép ô. Ở đây giữ nguyên toạ độ thật của từng người;
 * các vạch chia lấy đúng cấu hình ma trận của tổ chức nên vẫn đọc được theo ô như cũ.
 *
 * Ẩn danh do SERVER quyết định (`anonymized`), không phải component này — ở cấp nhân viên, dữ liệu
 * người khác về tới trình duyệt đã không còn tên.
 */
export default function BehaviorCompletionScatter({ data, isLoading, fillHeight }: Props) {
  // Chấm của mình vẽ SAU cùng để luôn nằm trên các chấm khác, không bị che khuất.
  const ordered = useMemo(
    () => [...(data?.points ?? [])].sort((a, b) => Number(a.isSelf ?? false) - Number(b.isSelf ?? false)),
    [data?.points],
  )

  if (isLoading) {
    return (
      <Shell fillHeight={fillHeight}>
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)] mb-4" />
        <p className="text-[var(--color-muted-foreground)] font-medium">Đang tải dữ liệu biểu đồ...</p>
      </Shell>
    )
  }

  if (!ordered.length) {
    return (
      <Shell fillHeight={fillHeight}>
        <p className="text-[var(--color-muted-foreground)] font-medium">Chưa có đánh giá nào trong phạm vi này</p>
      </Shell>
    )
  }

  const xLabel = data?.xLabel ?? '% Hoàn thành KPI'
  const yLabel = data?.yLabel ?? 'Điểm hành vi'

  return (
    <div className={`w-full ${fillHeight ? 'h-full' : ''} flex flex-col`}>
      <div className="flex items-center justify-end gap-3 mb-2">
        <div className="flex items-center gap-3">
          {data?.anonymized && (
            <span className="text-eyebrow inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--color-muted)]">
              <EyeOff size={11} /> Người khác đã ẩn danh
            </span>
          )}
          <p className="text-caption">{data?.totalCount ?? 0} đánh giá</p>
        </div>
      </div>

      {/* `height="100%"` chỉ quy chiếu được khi vật chứa có chiều cao XÁC ĐỊNH. Trước đây chỗ này
          là `min-h-[380px]` — min-height không phải chiều cao xác định, nên phần trăm rơi về auto,
          ResponsiveContainer đo ra 0 và không vẽ gì, trong khi div vẫn chừa đủ 380px trống. Ở chế
          độ không lấp đầy phải đưa số cụ thể; ở chế độ lấp đầy thì vật chứa đã có `h-full`. */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height={fillHeight ? '100%' : 380} minHeight={0}>
          <ScatterChart margin={{ top: 10, right: 20, left: 8, bottom: 28 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={AXIS_COLORS.grid} />
            <XAxis
              type="number"
              dataKey="completion"
              name={xLabel}
              label={xAxisLabel(xLabel)}
              domain={[0, data?.xMax ?? 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: AXIS_COLORS.tick, fontSize: 12, fontWeight: 500 }}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="number"
              dataKey="behavior"
              name={yLabel}
              label={yAxisLabel(yLabel)}
              domain={[0, data?.yMax ?? 5]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: AXIS_COLORS.tick, fontSize: 12, fontWeight: 500 }}
            />
            {/* Chấm của mình to hơn hẳn để tìm thấy ngay giữa đám đông. */}
            <ZAxis type="number" dataKey="z" range={[70, 260]} />

            {/* Lưới ô của ma trận xếp loại — giữ đúng cách đọc mà người dùng đã quen ở heatmap. */}
            {(data?.xDividers ?? []).map((x) => (
              <ReferenceLine key={`x-${x}`} x={x} stroke={NEUTRAL_COLOR} strokeDasharray="4 4" />
            ))}
            {(data?.yDividers ?? []).map((y) => (
              <ReferenceLine key={`y-${y}`} y={y} stroke={NEUTRAL_COLOR} strokeDasharray="4 4" />
            ))}

            <Tooltip
              cursor={{ strokeDasharray: '3 3' }}
              content={<PointTooltip xLabel={xLabel} yLabel={yLabel} />}
            />

            <Scatter data={ordered.map(p => ({ ...p, z: p.isSelf ? 3 : 1 }))}>
              {ordered.map((p, i) => (
                <Cell
                  key={i}
                  fill={ratingColor(p.rating)}
                  fillOpacity={p.isSelf ? 1 : 0.65}
                  stroke={p.isSelf ? '#0f172a' : 'none'}
                  strokeWidth={p.isSelf ? 2 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 pt-3 text-xs font-medium text-[var(--color-muted-foreground)]">
        {[1, 2, 3, 4, 5].map(r => (
          <span key={r} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ratingColor(r) }} />
            <span>Xếp loại {r}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
