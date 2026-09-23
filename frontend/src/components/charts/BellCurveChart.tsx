import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Bar, Line, Cell,
} from 'recharts'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { yAxisLabel } from '@/components/charts/axisLabel'
import type { CycleCurve, CycleCurveBucket } from '@/types/kpi'

type Row = {
  level: string
  color: string
  count: number
  percent: number
  target: number | null
  min: number | null
  max: number | null
  minCount: number | null
  maxCount: number | null
  over: boolean
  under: boolean
  band: [number, number] | null
}

function toRow(b: CycleCurveBucket): Row {
  return {
    level: b.level,
    color: b.color,
    count: b.count,
    percent: b.percent,
    target: b.targetPercent,
    min: b.minPercent,
    max: b.maxPercent,
    minCount: b.minCount,
    maxCount: b.maxCount,
    over: b.over,
    under: b.under,
    band: b.minPercent != null && b.maxPercent != null ? [b.minPercent, b.maxPercent] : null,
  }
}

function CurveTooltip({ active, payload, headcount, complete }: {
  active?: boolean
  payload?: { payload: Row }[]
  headcount: number
  /** Đã chấm đủ người chưa — chưa đủ thì "dưới sàn" là chuyện đương nhiên, không nói. */
  complete: boolean
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2 rounded-card text-xs shadow-sm">
      <p className="font-semibold text-[var(--color-foreground)] mb-1.5 flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />{d.level}
      </p>
      <p className="font-semibold text-[var(--color-muted-foreground)]">
        Thực tế: {d.count}/{headcount} người ({d.percent}%)
      </p>
      {d.target != null ? (
        <>
          <p className="text-[var(--color-muted-foreground)]">Khung: {d.target}% (cho phép {d.min}%–{d.max}%)</p>
          <p className="text-[var(--color-muted-foreground)]">≈ {d.minCount}–{d.maxCount} người</p>
          {d.over && <p className="font-semibold text-[var(--color-error)] mt-1">Vượt trần {d.count - (d.maxCount ?? 0)} người</p>}
          {complete && d.under && <p className="font-semibold text-[var(--color-warning)] mt-1">Dưới sàn {(d.minCount ?? 0) - d.count} người</p>}
        </>
      ) : (
        <p className="text-[var(--color-subtle-foreground)] italic">Mức này không nằm trong khung</p>
      )}
    </div>
  )
}

/**
 * Bell curve: phân bố THỰC TẾ của thành viên theo mức xếp loại, đặt cạnh khung hạn mức (forced
 * distribution) đã cấu hình ở "Xếp loại đơn vị". Một biểu đồ dùng chung cho màn đánh giá kỳ và
 * khối Xếp loại đơn vị ở Thống kê, để hai nơi không mỗi nơi vẽ một kiểu.
 *
 * <p>Trục X xếp từ mức THẤP → CAO (ngược thứ tự thang) để hình chuông đọc trái sang phải; mẫu số
 * của mọi con số % là TỔNG nhân sự — cùng mẫu số mà hệ thống dùng lúc chặn ở đánh giá đợt.
 *
 * <p>Chưa cấu hình khung thì chỉ có cột thực tế + một dòng chỉ chỗ bật khung.
 */
export default function BellCurveChart({ curve, height = 260, compact = false, showIssues = true, className }: {
  curve: CycleCurve
  /** Chiều cao vùng vẽ (px). `'100%'` để lấp đầy vật chứa có chiều cao xác định. */
  height?: number | '100%'
  /** Bỏ dòng hướng dẫn bật khung và chip cảnh báo — dùng khi ô lưới hẹp. */
  compact?: boolean
  /** Tắt khi thẻ bọc ngoài đã tự tóm tắt lệch khung (đánh giá kỳ) — khỏi nói hai lần. */
  showIssues?: boolean
  className?: string
}) {
  const rows = useMemo(() => [...(curve.buckets ?? [])].reverse().map(toRow), [curve.buckets])
  // Chưa chấm đủ người thì mức nào cũng "thiếu" — kêu lúc đó là kêu một câu vô nghĩa; chỉ
  // vượt trần mới đáng nói giữa chừng. Cùng luật với backend (bellCurveMessage).
  const complete = curve.evaluated >= curve.headcount
  const issues = useMemo(() => rows.filter(r => r.over || (complete && r.under)), [rows, complete])
  const hasBand = rows.some(r => r.band)

  if (!rows.length) return null

  return (
    <div className={cn('flex flex-col gap-3 min-h-0', className)}>
      {!curve.configured && !compact && (
        <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)] px-4 py-3 text-caption">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Đơn vị này <b>chưa áp khung bell curve</b> nào — biểu đồ chỉ hiện phân bố thực tế.
            Bật khung ở <b>Cấu hình → Xếp loại đơn vị → tab Bell curve</b> để có hạn mức đối chiếu.
          </span>
        </div>
      )}

      <div className={cn('w-full', height === '100%' ? 'flex-1 min-h-[180px]' : 'max-sm:h-[210px]')} style={height === '100%' ? undefined : { height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="level" tickLine={false} axisLine={false} interval={0}
              tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
              tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)}
            />
            <YAxis
              tickLine={false} axisLine={false} width={48} unit="%" label={yAxisLabel('% người')}
              tick={{ fontSize: 11, fontWeight: 500, fill: '#94a3b8' }}
            />
            <Tooltip content={<CurveTooltip headcount={curve.headcount} complete={complete} />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
            {/* Dải cho phép vẽ trước để nằm dưới cột thực tế. */}
            {hasBand && (
              <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.12} isAnimationActive={false} />
            )}
            <Bar dataKey="percent" barSize={26} radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {/* Mức vượt trần tô đỏ ngay trên cột — không bắt người chấm dò tooltip từng cột. */}
              {rows.map(r => (
                <Cell key={r.level} fill={r.over ? '#ef4444' : r.color} fillOpacity={r.over ? 0.95 : 0.85} />
              ))}
            </Bar>
            {curve.configured && (
              <Line
                type="monotone" dataKey="target" stroke="#4f46e5" strokeWidth={2.5}
                strokeDasharray="5 4" dot={{ r: 3, fill: '#4f46e5' }} isAnimationActive={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Chú giải: cột = thực tế, đường đứt = khung. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-2.5 rounded-sm bg-[var(--color-border)]" aria-hidden="true" /> Thực tế
        </span>
        {curve.configured && (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[var(--color-primary)]" aria-hidden="true" /> Khung mục tiêu
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-2.5 rounded-sm bg-[var(--color-primary-soft)]" aria-hidden="true" /> Dải cho phép
            </span>
          </>
        )}
        <span className="ml-auto">% tính trên tổng {curve.headcount} nhân sự</span>
      </div>

      {curve.configured && showIssues && !compact && (
        issues.length ? (
          <div className="flex flex-wrap gap-2 shrink-0">
            {issues.map(r => (
              <span
                key={r.level}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium border',
                  r.over
                    ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
                    : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
                )}
              >
                <AlertTriangle size={12} aria-hidden="true" />
                {r.level}: {r.count} người
                {r.over ? ` · vượt trần ${r.maxCount}` : ` · dưới sàn ${r.minCount}`}
              </span>
            ))}
          </div>
        ) : (
          <div className="self-start inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
            <CheckCircle2 size={12} aria-hidden="true" /> Phân bố nằm trong khung
          </div>
        )
      )}
      {/* Ô hẹp: gói cảnh báo thành một dòng ngắn thay vì dãy chip. */}
      {curve.configured && showIssues && compact && (
        issues.length ? (
          <p className="text-xs font-medium text-[var(--color-error)] shrink-0">
            <AlertTriangle size={12} className="inline -mt-0.5 mr-1" aria-hidden="true" />
            {issues.map(r => `${r.level}: ${r.count} người${r.over ? ` (trần ${r.maxCount})` : ` (sàn ${r.minCount})`}`).join(' · ')}
          </p>
        ) : (
          <p className="text-xs font-medium text-[var(--color-success)] shrink-0">
            <CheckCircle2 size={12} className="inline -mt-0.5 mr-1" aria-hidden="true" /> Phân bố nằm trong khung
          </p>
        )
      )}
    </div>
  )
}
