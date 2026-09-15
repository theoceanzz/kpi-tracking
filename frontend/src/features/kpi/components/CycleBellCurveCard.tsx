import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Bar, Line, Cell,
} from 'recharts'
import { Scale, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
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

function CurveTooltip({ active, payload, headcount }: {
  active?: boolean
  payload?: { payload: Row }[]
  headcount: number
}) {
  if (!active || !payload?.length) return null
  const d = payload[0]!.payload
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] px-3 py-2 rounded-card text-xs">
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
          {d.under && <p className="font-semibold text-[var(--color-warning)] mt-1">Dưới sàn {(d.minCount ?? 0) - d.count} người</p>}
        </>
      ) : (
        <p className="text-[var(--color-subtle-foreground)] italic">Mức này không nằm trong khung</p>
      )}
    </div>
  )
}

/**
 * Bell curve của KỲ cho đơn vị đang xem: phân bố THỰC TẾ của thành viên đặt cạnh khung hạn mức
 * đã cấu hình ở "Xếp loại đơn vị".
 *
 * Trục X xếp từ mức THẤP → CAO (ngược thứ tự thang) để hình chuông đọc trái sang phải; mẫu số
 * của mọi con số % là TỔNG nhân sự — cùng mẫu số mà hệ thống dùng lúc chặn ở đánh giá đợt, nếu
 * lấy "số người đã chấm" thì biểu đồ và lúc bị chặn sẽ nói hai chuyện khác nhau.
 */
export default function CycleBellCurveCard({ curve, orgUnitName }: {
  curve: CycleCurve
  orgUnitName?: string
}) {
  const rows = useMemo(() => [...(curve.buckets ?? [])].reverse().map(toRow), [curve.buckets])
  const issues = useMemo(() => rows.filter(r => r.over || r.under), [rows])
  const hasBand = rows.some(r => r.band)

  if (!rows.length) return null

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 shrink-0 rounded-card bg-[var(--color-primary-soft)] text-[var(--color-primary)] flex items-center justify-center">
          <Scale size={18} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-section-title text-[var(--color-foreground)] leading-tight">
            Bell curve của kỳ{orgUnitName ? ` · ${orgUnitName}` : ''}
          </h3>
          <p className="text-caption font-medium">
            {curve.evaluated}/{curve.headcount} người đã có điểm kỳ
            {curve.configured && curve.profileName ? ` · hồ sơ "${curve.profileName}"` : ''}
            {curve.configured ? ` · dung sai ±${curve.tolerance}%` : ''}
          </p>
        </div>
        {curve.configured && (
          <span className={cn(
            'text-eyebrow inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card border whitespace-nowrap',
            curve.mode === 'block'
              ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
          )}>
            {curve.mode === 'block' ? 'Chặn khi vượt trần' : 'Chỉ cảnh báo'}
          </span>
        )}
      </div>

      <div className="p-5 space-y-4">
        {!curve.configured && (
          <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)] px-4 py-3 text-caption">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Đơn vị này <b>chưa áp khung bell curve</b> nào — biểu đồ chỉ hiện phân bố thực tế.
              Bật khung ở <b>Cấu hình → Xếp loại đơn vị → tab Bell curve</b> để có hạn mức đối chiếu.
            </span>
          </div>
        )}

        <div className="h-[260px] max-sm:h-[210px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
              <XAxis
                dataKey="level" tickLine={false} axisLine={false} interval={0}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)}
              />
              <YAxis
                tickLine={false} axisLine={false} width={44} unit="%"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <Tooltip content={<CurveTooltip headcount={curve.headcount} />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              {/* Dải cho phép vẽ trước để nằm dưới cột thực tế. */}
              {hasBand && (
                <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.12} isAnimationActive={false} />
              )}
              <Bar dataKey="percent" barSize={26} radius={[6, 6, 0, 0]} isAnimationActive={false}>
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
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-caption">
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

        {curve.configured && (
          issues.length ? (
            <div className="flex flex-wrap gap-2">
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
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-card text-xs font-medium bg-[var(--color-success-bg)] text-[var(--color-success)] border border-[var(--color-success-border)]">
              <CheckCircle2 size={12} aria-hidden="true" /> Phân bố nằm trong khung
            </div>
          )
        )}
      </div>
    </div>
  )
}
