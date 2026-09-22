import { useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, Area, Bar, Line, Cell,
} from 'recharts'
import { Scale, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import CollapsibleCard from '@/components/common/CollapsibleCard'
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
          {complete && d.under && <p className="font-semibold text-[var(--color-warning)] mt-1">Dưới sàn {(d.minCount ?? 0) - d.count} người</p>}
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
export default function CycleBellCurveCard({ curve, orgUnitName, defaultOpen = false, id, bare = false, compact = false }: {
  curve: CycleCurve
  orgUnitName?: string
  defaultOpen?: boolean
  id?: string
  /** Chỉ vẽ ruột (kết luận + biểu đồ), không khung — dùng khi thẻ bọc ngoài đã có header riêng. */
  bare?: boolean
  /** Biểu đồ thấp hơn, chú giải gọn — cho ô nửa hàng cạnh luồng duyệt. */
  compact?: boolean
}) {
  const rows = useMemo(() => [...(curve.buckets ?? [])].reverse().map(toRow), [curve.buckets])
  // Chưa chấm đủ người thì mức nào cũng "thiếu" — kêu lúc đó là kêu một câu vô nghĩa; chỉ
  // vượt trần mới đáng nói giữa chừng. Cùng luật với backend (bellCurveMessage).
  const complete = curve.evaluated >= curve.headcount
  const issues = useMemo(
    () => rows.filter(r => r.over || (complete && r.under)),
    [rows, complete],
  )
  const hasBand = rows.some(r => r.band)

  if (!rows.length) return null

  const overs = issues.filter(r => r.over)
  const unders = issues.filter(r => r.under)
  const headline = !curve.configured
    ? 'Chưa áp khung — chỉ hiện phân bố thực tế'
    : curve.evaluated === 0
      ? 'Chưa ai có điểm kỳ'
      : overs.length
        ? `Vượt trần: ${overs.map(r => `${r.level} ${r.count}/${r.maxCount}`).join(' · ')}`
        : unders.length
          ? `Dưới sàn: ${unders.map(r => `${r.level} ${r.count}/${r.minCount}`).join(' · ')}`
          : complete ? 'Phân bố nằm trong khung' : `Chưa vượt trần · ${curve.evaluated}/${curve.headcount} người có điểm`

  const modeBadge = curve.configured && (
    <span className={cn(
      'text-eyebrow inline-flex items-center gap-1.5 px-2.5 py-1 rounded-card border whitespace-nowrap',
      curve.mode === 'block'
        ? 'bg-[var(--color-error-bg)] text-[var(--color-error)] border-[var(--color-error-border)]'
        : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] border-[var(--color-warning-border)]',
    )}>
      {curve.mode === 'block' ? 'Chặn khi vượt trần' : 'Chỉ cảnh báo'}
    </span>
  )
  const headlineCls = cn(
    'text-sm',
    overs.length ? 'font-semibold text-[var(--color-error)]'
      : unders.length ? 'font-semibold text-[var(--color-warning)]'
      : curve.configured && complete && curve.evaluated > 0 ? 'font-semibold text-[var(--color-success)]' : 'text-[var(--color-muted-foreground)]',
  )

  if (bare) {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-4'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={cn(headlineCls, compact && 'text-xs')}>
            {headline}
            <span className="text-caption font-medium">
              {curve.configured && curve.profileName ? ` · khung "${curve.profileName}" ±${curve.tolerance}%` : ''}
              {` · ${curve.evaluated}/${curve.headcount} người có điểm`}
            </span>
          </p>
          {!compact && modeBadge}
        </div>
        <Chart />
      </div>
    )
  }

  return (
    <CollapsibleCard
      id={id}
      defaultOpen={defaultOpen}
      icon={<Scale size={18} aria-hidden="true" />}
      title={`Bell curve của kỳ${orgUnitName ? ` · ${orgUnitName}` : ''}`}
      summary={
        <span className={cn(
          overs.length ? 'font-semibold text-[var(--color-error)]'
            : unders.length ? 'font-semibold text-[var(--color-warning)]'
            : curve.configured && complete && curve.evaluated > 0 ? 'font-semibold text-[var(--color-success)]' : undefined,
        )}>
          {headline}
          {curve.configured && curve.profileName ? ` · khung "${curve.profileName}" ±${curve.tolerance}%` : ''}
        </span>
      }
      badge={modeBadge}
    >
      <Chart />
    </CollapsibleCard>
  )

  // Biểu đồ + chú giải + lệch khung — dùng chung cho cả hai kiểu bọc.
  function Chart() {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-4'}>
        {!curve.configured && (
          <div className="flex items-start gap-2 rounded-card bg-[var(--color-muted)] px-4 py-3 text-caption">
            <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Đơn vị này <b>chưa áp khung bell curve</b> nào — biểu đồ chỉ hiện phân bố thực tế.
              Bật khung ở <b>Cấu hình → Xếp loại đơn vị → tab Bell curve</b> để có hạn mức đối chiếu.
            </span>
          </div>
        )}

        <div className={cn('w-full', compact ? 'h-[170px]' : 'h-[260px] max-sm:h-[210px]')}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 6, left: compact ? -6 : 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" vertical={false} />
              <XAxis
                dataKey="level" tickLine={false} axisLine={false} interval={0}
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                tickFormatter={(v: string) => (v.length > 9 ? `${v.slice(0, 8)}…` : v)}
              />
              <YAxis
                tickLine={false} axisLine={false} width={36} unit="%"
                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              />
              <Tooltip content={<CurveTooltip headcount={curve.headcount} complete={complete} />} cursor={{ fill: 'rgba(99,102,241,0.06)' }} />
              {/* Dải cho phép vẽ trước để nằm dưới cột thực tế. */}
              {hasBand && (
                <Area dataKey="band" stroke="none" fill="#6366f1" fillOpacity={0.12} isAnimationActive={false} />
              )}
              <Bar dataKey="percent" barSize={compact ? 18 : 26} radius={[5, 5, 0, 0]} isAnimationActive={false}>
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
          {compact && modeBadge}
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
          {!compact && <span className="ml-auto">% tính trên tổng {curve.headcount} nhân sự</span>}
        </div>

        {/* Lệch khung gom thành tối đa hai dòng "thực tế/hạn mức" — năm cái chip cho năm mức
            đọc như năm cái lỗi, trong khi thứ cần biết chỉ là mức nào thừa, mức nào thiếu. */}
        {curve.configured && (
          issues.length ? (
            <dl className="space-y-1 text-xs">
              {issues.some(r => r.over) && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <dt className="inline-flex items-center gap-1 font-semibold text-[var(--color-error)]">
                    <AlertTriangle size={12} aria-hidden="true" /> Vượt trần
                  </dt>
                  {issues.filter(r => r.over).map(r => (
                    <dd key={r.level} className="tabular-nums text-[var(--color-foreground)]">
                      {r.level} <b>{r.count}</b><span className="text-[var(--color-muted-foreground)]">/{r.maxCount}</span>
                    </dd>
                  ))}
                </div>
              )}
              {issues.some(r => r.under) && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <dt className="inline-flex items-center gap-1 font-semibold text-[var(--color-warning)]">
                    <AlertTriangle size={12} aria-hidden="true" /> Dưới sàn
                  </dt>
                  {issues.filter(r => r.under).map(r => (
                    <dd key={r.level} className="tabular-nums text-[var(--color-foreground)]">
                      {r.level} <b>{r.count}</b><span className="text-[var(--color-muted-foreground)]">/{r.minCount}</span>
                    </dd>
                  ))}
                </div>
              )}
            </dl>
          ) : curve.evaluated > 0 && complete ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-success)]">
              <CheckCircle2 size={12} aria-hidden="true" /> Phân bố nằm trong khung
            </p>
          ) : (
            <p className="text-caption">
              {curve.evaluated === 0 ? 'Chưa ai có điểm kỳ nên chưa đối chiếu được.' : `Còn ${curve.headcount - curve.evaluated} người chưa có điểm — sàn chỉ xét khi đã chấm đủ.`}
            </p>
          )
        )}
      </div>
    )
  }
}
