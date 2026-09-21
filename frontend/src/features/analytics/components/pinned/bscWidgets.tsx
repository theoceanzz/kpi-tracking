import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import { Gauge, Layers, ShieldCheck, ShieldAlert, GitBranch, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChoiceChip } from '@/components/ui/choice-chip'
import Pagination from '@/components/common/Pagination'
import { useOptionalDashboardUnit } from '@/features/dashboard/context/DashboardFilterContext'
import {
  useBscOverview, useBscUnitAttainment, useBscItemAttainment, useBscAttainmentTrend, useBscCascadeCoverage,
  useBscRankings,
} from '../../hooks/useAnalytics'
import type { BscUnitAttainmentRow, BscItemRow } from '../../api/bscAnalyticsApi'
import type { PinnedFilter } from './pinnedWidgetRegistry'
import { xAxisLabel, yAxisLabel } from '@/components/charts/axisLabel'
import { SeriesTooltip } from '@/components/charts/ChartTooltip'
import { AXIS_COLORS } from '@/components/charts/chartPalette'
import Lollipop from '@/components/charts/primitives/Lollipop'
import BulletChart from '@/components/charts/primitives/BulletChart'
import { useChartTableView, type ChartTableView } from '@/components/common/dashboard/useChartTableView'
import { ViewToggleButtons } from '@/components/common/dashboard/ViewToggleButtons'
import { scorecardStatusMeta } from '@/features/bsc/utils/scorecardStatus'
import type { BscScorecardStatus } from '@/features/bsc/types'
import type { CoverageItemResponse } from '@/features/bsc/types'

/**
 * Widget của tab "Thẻ điểm BSC", dùng ở cả tab lẫn trang chủ.
 *
 * <p>Tất cả dựng trên mô hình THẺ ĐIỂM (cây công ty → đơn vị, kết quả đợt, phân rã, hạng mục
 * chặn) — không phải trên điểm đánh giá cá nhân. Mỗi widget chỉ nhận `filter` rồi tự gọi đúng
 * truy vấn: bên tab, đơn vị + đợt nằm trong cài đặt của ô; trên trang chủ đến từ bộ lọc trang.
 */

const RANK_PAGE_SIZE = 10
/** Chế độ biểu đồ của xếp hạng lấy một lần Top N: bảng xếp hạng sinh ra để xem đầu bảng. */
const RANK_CHART_TOP_N = 15
const DEFAULT_COLOR = '#8b5cf6'

const fmt = (v?: number | null) => (v == null ? '-' : (Math.round(v * 10) / 10).toString())
const fmtPct = (v?: number | null) => (v == null ? '—' : `${Math.round(v * 10) / 10}%`)

/** Màu theo mức đạt BSC: dưới sàn, gần đạt, đạt, vượt. */
const attainColor = (v?: number | null) => {
  if (v == null) return 'text-slate-400'
  if (v < 70) return 'text-rose-500'
  if (v < 90) return 'text-amber-500'
  if (v < 100) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-400'
}
const attainHex = (v?: number | null) => {
  if (v == null) return '#94a3b8'
  if (v < 70) return '#f43f5e'
  if (v < 90) return '#f59e0b'
  if (v < 100) return '#10b981'
  return '#2563eb'
}

/** Màu theo ngưỡng điểm đánh giá (bảng xếp hạng). */
const scoreColor = (v?: number | null) => {
  if (v == null) return 'text-slate-400'
  if (v < 50) return 'text-rose-500'
  if (v < 70) return 'text-amber-500'
  if (v < 90) return 'text-emerald-500'
  return 'text-blue-600 dark:text-blue-400'
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center min-h-[160px] text-sm text-slate-400 font-medium text-center px-4">{children}</div>
}

/**
 * Phạm vi BSC: đơn vị từ `filter.orgUnitId` (tab Thống kê, cài đặt của ô) hoặc từ context bộ lọc
 * trang chủ; đợt từ bộ lọc đi kèm.
 */
function useBscScope(filter?: PinnedFilter) {
  const ctx = useOptionalDashboardUnit()
  return { orgUnitId: filter?.orgUnitId ?? ctx.unitId, periodId: filter?.periodId, periodIdTo: filter?.periodIdTo }
}

/** Đợt đang soi + tình trạng kết quả — dòng phụ cho tiêu đề ô. */
function PeriodNote({ periodName, resultStatus, hasResult }: { periodName?: string | null; resultStatus?: string | null; hasResult: boolean }) {
  if (!periodName) return null
  return (
    <p className="text-xs font-medium text-slate-400">
      Đợt: <span className="text-[var(--color-muted-foreground)]">{periodName}</span>
      {!hasResult
        ? <span className="ml-1.5 text-amber-600">· chưa tính kết quả</span>
        : resultStatus === 'DRAFT' ? <span className="ml-1.5 text-amber-600">· kết quả nháp, chưa chốt</span> : null}
    </p>
  )
}

// ── 1. Thẻ số liệu ─────────────────────────────────────────────────────────

/** Sức khoẻ BSC của đợt: %đạt thẻ gốc, thẻ đơn vị, hạng mục chặn, độ phủ phân rã. */
export function BscOverviewMetrics({ filter }: { filter?: PinnedFilter }) {
  const scope = useBscScope(filter)
  const { data: o } = useBscOverview(scope)
  const mode = o?.scoringMode
  const statusEntries = Object.entries(o?.unitStatusCounts ?? {})
  const active = o?.unitStatusCounts?.ACTIVE ?? 0
  const pending = o?.unitStatusCounts?.SUBMITTED ?? 0
  const cov = o?.coverage

  if (o && !o.scorecardId) {
    return <EmptyState>Đợt {o.periodName ?? 'này'} chưa có thẻ điểm BSC nào. Tạo bộ tiêu chí ở Thiết lập công cụ → Quản lý BSC.</EmptyState>
  }

  return (
    <div className="flex-1 min-h-0 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {mode && (
          <span className={cn(
            'inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full',
            mode === 'SHADOW'
              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
          )}>
            {mode === 'SHADOW' ? 'Chạy song song (SHADOW)' : 'Chính thức (OFFICIAL)'}
          </span>
        )}
        {o?.periodName && (
          <span className="text-xs font-medium text-slate-400">
            Đợt {o.periodName}
            {o.scorecardName ? ` · ${o.scorecardName}` : ''}
            {o.resultStatus === 'DRAFT' ? ' · kết quả nháp' : o.achievementPercent == null ? ' · chưa tính kết quả' : ''}
          </span>
        )}
      </div>
      <div className="@container grid grid-flow-col auto-cols-[minmax(172px,1fr)] gap-3 overflow-x-auto custom-scrollbar pb-1">
        <Tile icon={<Gauge size={22} />} label={o?.level === 'UNIT' ? 'Mức đạt BSC đơn vị' : 'Mức đạt BSC công ty'}>
          <p className={cn('text-2xl font-semibold tabular-nums', attainColor(o?.achievementPercent))}>{fmtPct(o?.achievementPercent)}</p>
          <p className="text-xs font-medium text-slate-400">{o?.itemCount ?? 0} chỉ tiêu · mục tiêu 100%</p>
        </Tile>
        <Tile icon={<Layers size={22} />} label="Thẻ điểm đơn vị">
          <p className="text-2xl font-semibold tabular-nums">{o?.unitScorecardCount ?? 0}</p>
          <p className="text-xs font-medium text-slate-400 truncate" title={statusEntries.map(([k, v]) => `${scorecardStatusMeta(k as BscScorecardStatus).label}: ${v}`).join(', ')}>
            {active} đang áp dụng{pending ? ` · ${pending} chờ duyệt` : ''}
          </p>
        </Tile>
        <Tile
          icon={(o?.unitsGateFailed ?? 0) > 0 ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
          label="Qua hạng mục chặn"
          tone={(o?.unitsGateFailed ?? 0) > 0 ? 'red' : 'neutral'}
        >
          <p className="text-2xl font-semibold tabular-nums">
            {o?.unitsGatePassed ?? 0}<span className="text-base text-slate-400">/{o?.unitsWithResult ?? 0}</span>
          </p>
          <p className={cn('text-xs font-medium', (o?.unitsGateFailed ?? 0) > 0 ? 'text-rose-500' : 'text-slate-400')}>
            {(o?.unitsGateFailed ?? 0) > 0 ? `${o?.unitsGateFailed} đơn vị không qua cửa` : 'Không đơn vị nào vướng cửa chặn'}
          </p>
        </Tile>
        <Tile icon={<GitBranch size={22} />} label="Độ phủ phân rã">
          <p className="text-2xl font-semibold tabular-nums">
            {cov?.ok ?? 0}<span className="text-base text-slate-400">/{cov?.total ?? 0}</span>
          </p>
          <p className="text-xs font-medium text-slate-400 truncate">
            {[cov?.under ? `${cov.under} thiếu` : null, cov?.over ? `${cov.over} vượt` : null, cov?.notCascaded ? `${cov.notCascaded} chưa phân rã` : null]
              .filter(Boolean).join(' · ') || 'Mọi chỉ tiêu phân rã đủ'}
          </p>
        </Tile>
      </div>
    </div>
  )
}

function Tile({ icon, label, tone = 'neutral', children }: {
  icon: React.ReactNode; label: string; tone?: 'neutral' | 'red'; children: React.ReactNode
}) {
  return (
    <div className="bg-[var(--color-card)] rounded-widget p-4 @min-[1100px]:p-5 border border-[var(--color-border)] flex items-center gap-3">
      <div className={cn(
        'w-11 h-11 rounded-full flex items-center justify-center shrink-0',
        tone === 'red' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
      )}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {children}
      </div>
    </div>
  )
}

// ── 2. Mức đạt của các đơn vị (cây thẻ điểm) ───────────────────────────────

/**
 * Mỗi thẻ điểm dưới thẻ gốc một chấm %đạt (lollipop, sắp giảm dần), hoặc bảng giữ thứ tự cây kèm
 * trạng thái thẻ và hạng mục chặn.
 */
export function BscUnitAttainmentWidget({ filter, variant = 'lollipop', meta }: {
  filter?: PinnedFilter
  variant?: 'lollipop' | 'tree'
  meta?: React.ReactNode
}) {
  const scope = useBscScope(filter)
  const { data: rows } = useBscUnitAttainment(scope)
  const { data: overview } = useBscOverview(scope)
  const list = rows ?? []
  const children = list.filter(r => r.depth > 0)
  const withResult = children.filter(r => r.achievementPercent != null)

  const lollipop = useMemo(() => [...withResult]
    .sort((a, b) => (b.achievementPercent ?? 0) - (a.achievementPercent ?? 0))
    .map(r => ({
      id: r.scorecardId,
      name: r.orgUnitName ?? r.name,
      subText: [r.parentScorecardName, r.gatePassed === false ? `Không qua cửa: ${r.gateFailedItems ?? ''}` : null].filter(Boolean).join(' · ') || undefined,
      value: r.achievementPercent ?? 0,
      color: r.gatePassed === false ? '#f43f5e' : attainHex(r.achievementPercent),
    })), [withResult])

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      <PeriodNote periodName={overview?.periodName} resultStatus={overview?.resultStatus} hasResult={withResult.length > 0} />
      {list.length === 0 ? (
        <EmptyState>Chưa có thẻ điểm nào cho đợt này.</EmptyState>
      ) : children.length === 0 ? (
        <EmptyState>Thẻ điểm gốc chưa phân rã xuống đơn vị nào. Gắn thẻ đơn vị ở Quản lý BSC.</EmptyState>
      ) : variant === 'tree' ? (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <UnitTreeTable rows={list} />
        </div>
      ) : withResult.length === 0 ? (
        <EmptyState>Đợt này chưa có đơn vị nào tính kết quả BSC. Bấm "Tính lại" ở tab Kết quả đợt của thẻ điểm.</EmptyState>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <Lollipop
            data={lollipop}
            unit="%"
            valueLabel="Mức đạt BSC (%)"
            reference={{ value: 100, label: 'Mục tiêu' }}
            domainMax={Math.max(120, ...lollipop.map(d => d.value))}
            height={Math.max(220, lollipop.length * 40 + 60)}
          />
          <p className="text-xs text-slate-500 text-center mt-2">
            Chấm đỏ = không qua hạng mục chặn. {children.length - withResult.length > 0 ? `${children.length - withResult.length} đơn vị chưa tính kết quả.` : ''}
          </p>
        </div>
      )}
    </div>
  )
}

function UnitTreeTable({ rows }: { rows: BscUnitAttainmentRow[] }) {
  return (
    <table className="w-full text-left">
      <thead className="bg-[var(--color-muted)] sticky top-0 z-10">
        <tr className="text-xs font-medium text-slate-500">
          <th className="px-3 py-3">Thẻ điểm</th>
          <th className="px-3 py-3 whitespace-nowrap">Trạng thái</th>
          <th className="px-3 py-3 text-right whitespace-nowrap">Mức đạt</th>
          <th className="px-3 py-3 whitespace-nowrap">Hạng mục chặn</th>
          <th className="px-3 py-3 text-right whitespace-nowrap hidden lg:table-cell">Chỉ tiêu</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {rows.map(r => (
          <tr key={r.scorecardId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
            <td className="px-3 py-2.5">
              <div className="flex items-center gap-2" style={{ paddingLeft: r.depth * 16 }}>
                {r.depth > 0 && <span className="w-3 h-px bg-[var(--color-border)] shrink-0" aria-hidden="true" />}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{r.orgUnitName ?? (r.level === 'COMPANY' ? 'Công ty' : r.name)}</p>
                  <p className="text-xs text-slate-400 truncate">{r.name}</p>
                </div>
              </div>
            </td>
            <td className="px-3 py-2.5">
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', scorecardStatusMeta(r.status).badgeClass)}>
                {scorecardStatusMeta(r.status).label}
              </span>
            </td>
            <td className={cn('px-3 py-2.5 text-right text-sm font-semibold tabular-nums', attainColor(r.achievementPercent))}>
              {r.achievementPercent == null ? <span className="text-xs font-medium text-slate-400">chưa tính</span> : fmtPct(r.achievementPercent)}
            </td>
            <td className="px-3 py-2.5">
              {r.gateCount === 0 ? <span className="text-xs text-slate-400">—</span>
                : r.gatePassed == null ? <span className="text-xs text-slate-400">{r.gateCount} cửa · chưa tính</span>
                : r.gatePassed ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><ShieldCheck size={13} /> Qua</span>
                : <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600" title={r.gateFailedItems ?? ''}><ShieldAlert size={13} /> Không qua{r.gateFailedItems ? `: ${r.gateFailedItems}` : ''}</span>}
            </td>
            <td className="px-3 py-2.5 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap hidden lg:table-cell">
              {r.itemCount}{r.assignedCount ? ` · ${r.assignedCount} giao xuống` : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── 3. Mức đạt từng chỉ tiêu (bullet) ──────────────────────────────────────

/** Thực tế / mục tiêu / sàn của từng chỉ tiêu trên thẻ điểm gốc, nhóm theo màu lĩnh vực. */
export function BscItemAttainmentWidget({ filter, meta }: { filter?: PinnedFilter; meta?: React.ReactNode }) {
  const scope = useBscScope(filter)
  const { data } = useBscItemAttainment(scope)
  const items = data?.items ?? []
  const scored = items.filter(i => i.hasResult && i.actualValue != null && (i.targetValue ?? 0) > 0)

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      <PeriodNote periodName={data?.periodName} resultStatus={data?.resultStatus} hasResult={scored.length > 0} />
      {!data?.scorecardId ? (
        <EmptyState>Chưa có thẻ điểm cho phạm vi/đợt này.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>Thẻ điểm {data.scorecardName} chưa có chỉ tiêu nào.</EmptyState>
      ) : scored.length === 0 ? (
        <EmptyState>Đợt {data.periodName} chưa tính kết quả cho thẻ {data.scorecardName}. Bấm "Tính lại" ở tab Kết quả đợt.</EmptyState>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          <BulletChart
            height={Math.max(200, scored.length * 44 + 60)}
            data={scored.map(i => ({
              id: i.scorecardPerspectiveId,
              name: i.name + (i.isGate ? ' (chặn)' : ''),
              actual: i.actualValue ?? 0,
              target: i.targetValue ?? 0,
              minimum: i.minimumValue,
              unit: i.unit,
              subText: [i.fixedPerspectiveName, i.weightPercentage != null ? `trọng số ${i.weightPercentage}%` : null, i.isGate ? `chặn tại ${i.gateMinPercent ?? 70}%` : null].filter(Boolean).join(' · '),
            }))}
            valueLabel="% đạt so với mục tiêu"
          />
          <ItemLegend items={scored} />
        </div>
      )}
    </div>
  )
}

function ItemLegend({ items }: { items: BscItemRow[] }) {
  const failed = items.filter(i => i.isGate && i.gatePassed === false)
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1"><Lock size={11} /> (chặn) = chỉ tiêu chặn: dưới sàn là cả thẻ không qua cửa</span>
      {failed.length > 0 && (
        <span className="inline-flex items-center gap-1 font-medium text-rose-600">
          <ShieldAlert size={12} /> Không qua cửa: {failed.map(f => f.name).join(', ')}
        </span>
      )}
    </div>
  )
}

// ── 4. Xu hướng %đạt qua các đợt ───────────────────────────────────────────

/** %đạt thẻ gốc qua các đợt; biến thể tách theo 4 lĩnh vực. */
export function BscAttainmentTrendWidget({ filter, variant = 'overall', meta }: {
  filter?: PinnedFilter
  variant?: 'overall' | 'perspectives'
  meta?: React.ReactNode
}) {
  const scope = useBscScope(filter)
  const { data } = useBscAttainmentTrend(scope)
  const points = useMemo(() => data?.points ?? [], [data?.points])
  const withResult = useMemo(() => points.filter(p => p.hasResult), [points])
  const rows = useMemo(() => points.map(p => ({
    label: p.label,
    overall: p.hasResult ? p.achievementPercent ?? null : null,
    gateFailed: p.hasResult && p.gatePassed === false,
    ...Object.fromEntries((data?.perspectives ?? []).map(ps => [ps.code, p.byPerspective?.[ps.code] ?? null])),
  })), [points, data?.perspectives])
  const byPerspective = variant === 'perspectives'

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      {withResult.length < 2 ? (
        <EmptyState>Cần từ 2 đợt có kết quả BSC trở lên để vẽ xu hướng{withResult.length === 1 ? ` (mới có ${withResult[0]!.label})` : ''}.</EmptyState>
      ) : (
        <>
          <div className="flex-1 min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 30, left: 8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" label={xAxisLabel('Đợt')} tick={{ fontSize: 11, fill: AXIS_COLORS.tick }} interval={rows.length > 8 ? Math.ceil(rows.length / 8) - 1 : 0} />
                <YAxis domain={[0, (max: number) => Math.max(120, Math.ceil(max / 10) * 10)]} label={yAxisLabel('Mức đạt (%)')} tick={{ fontSize: 11, fill: AXIS_COLORS.tick }} width={48} />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: 'Mục tiêu', position: 'insideTopRight', fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip content={<SeriesTooltip unit="%" />} />
                {byPerspective && (data?.perspectives ?? []).map(ps => (
                  <Line key={ps.code} type="monotone" dataKey={ps.code} name={ps.name} stroke={ps.color} strokeWidth={2}
                    dot={{ r: 3 }} connectNulls isAnimationActive={false} />
                ))}
                <Line type="monotone" dataKey="overall" name="Mức đạt BSC" stroke="#4f46e5" strokeWidth={byPerspective ? 2 : 2.5}
                  strokeDasharray={byPerspective ? '5 4' : undefined}
                  dot={(p: { cx?: number; cy?: number; payload?: { gateFailed?: boolean } }) => (
                    <circle key={`${p.cx}-${p.cy}`} cx={p.cx} cy={p.cy} r={p.payload?.gateFailed ? 5 : 3.5}
                      fill={p.payload?.gateFailed ? '#f43f5e' : '#4f46e5'} stroke="#fff" strokeWidth={1.5} />
                  )}
                  connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 shrink-0">
            <span className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5 bg-[var(--color-primary)]" /> Mức đạt BSC</span>
            {byPerspective && (data?.perspectives ?? []).map(ps => (
              <span key={ps.code} className="inline-flex items-center gap-1.5"><span className="w-4 h-0.5" style={{ background: ps.color }} /> {ps.name}</span>
            ))}
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> đợt không qua hạng mục chặn</span>
          </div>
        </>
      )}
    </div>
  )
}

// ── 5. Độ phủ phân rã ─────────────────────────────────────────────────────

const COVERAGE_LABEL: Record<string, { label: string; cls: string; bar: string }> = {
  OK: { label: 'Đủ', cls: 'bg-[var(--color-success-bg)] text-[var(--color-success)]', bar: '#10b981' },
  UNDER: { label: 'Thiếu', cls: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]', bar: '#f59e0b' },
  OVER: { label: 'Vượt', cls: 'bg-[var(--color-info-bg)] text-[var(--color-info)]', bar: '#2563eb' },
  NOT_CASCADED: { label: 'Chưa phân rã', cls: 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]', bar: '#94a3b8' },
}

/**
 * Mỗi chỉ tiêu của thẻ gốc một thanh: phần đã phân rã xuống đơn vị so với mục tiêu. SHARED/SUPPORT
 * không cộng dồn nên thanh chỉ có nghĩa với chỉ tiêu kiểu SUM; các kiểu khác hiện số đơn vị nhận.
 */
export function BscCascadeCoverageWidget({ filter, viewControl, hideControls, meta }: {
  filter?: PinnedFilter
  viewControl?: { value?: ChartTableView; onChange?: (v: ChartTableView) => void }
  hideControls?: boolean
  meta?: React.ReactNode
}) {
  const scope = useBscScope(filter)
  const { data } = useBscCascadeCoverage(scope)
  const { view, setView } = useChartTableView('bsc-cascade', 'chart', viewControl)
  const items = data?.items ?? []

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {(meta || !hideControls) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{meta}</div>
          {!hideControls && <ViewToggleButtons view={view} onChange={setView} />}
        </div>
      )}
      {!data?.scorecardId ? (
        <EmptyState>Chưa có thẻ điểm cho phạm vi/đợt này.</EmptyState>
      ) : items.length === 0 ? (
        <EmptyState>Thẻ điểm {data.scorecardName} chưa có chỉ tiêu nào.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 shrink-0">
            {(['OK', 'UNDER', 'OVER', 'NOT_CASCADED'] as const).map(k => {
              const n = k === 'OK' ? data.okCount : k === 'UNDER' ? data.underCount : k === 'OVER' ? data.overCount : data.notCascadedCount
              return (
                <span key={k} className={cn('text-xs font-medium px-2 py-0.5 rounded-full', COVERAGE_LABEL[k]!.cls)}>
                  {COVERAGE_LABEL[k]!.label}: {n}
                </span>
              )
            })}
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {view === 'table' ? <CoverageTable items={items} /> : <CoverageBars items={items} />}
          </div>
        </>
      )}
    </div>
  )
}

function CoverageBars({ items }: { items: CoverageItemResponse[] }) {
  return (
    <div className="space-y-3">
      {items.map(it => {
        const meta = COVERAGE_LABEL[it.status] ?? COVERAGE_LABEL.NOT_CASCADED!
        const target = it.targetValue ?? 0
        const cascaded = it.cascadedValue ?? 0
        const pct = target > 0 ? Math.min(150, (cascaded / target) * 100) : 0
        const sumType = it.children.some(c => c.linkType === 'SUM')
        return (
          <div key={it.scorecardPerspectiveId}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-sm font-semibold text-[var(--color-foreground)] truncate flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: it.color ?? DEFAULT_COLOR }} />{it.name}
              </p>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full shrink-0', meta.cls)}>{meta.label}</span>
            </div>
            {sumType && target > 0 ? (
              <>
                <div className="relative h-2.5 rounded-full bg-[var(--color-muted)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: meta.bar }} />
                  {pct > 100 && <div className="absolute inset-y-0 right-0 w-1 bg-[var(--color-info)]" />}
                </div>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Đã phân rã {fmt(cascaded)}{it.unit ? ` ${it.unit}` : ''} / mục tiêu {fmt(target)}{it.unit ? ` ${it.unit}` : ''} ({Math.round(pct)}%)
                  {it.gap != null && it.status !== 'OK' ? ` · ${it.gap > 0 ? 'thiếu' : 'vượt'} ${fmt(Math.abs(it.gap))}` : ''}
                  {` · ${it.children.length} đơn vị nhận`}
                </p>
              </>
            ) : (
              <p className="text-xs text-slate-500">
                {it.children.length === 0 ? 'Chưa giao xuống đơn vị nào'
                  : `Cùng chỉ tiêu cho ${it.children.length} đơn vị (${it.children.map(c => c.orgUnitName).filter(Boolean).slice(0, 4).join(', ')}${it.children.length > 4 ? '…' : ''})`}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

function CoverageTable({ items }: { items: CoverageItemResponse[] }) {
  return (
    <table className="w-full text-left">
      <thead className="bg-[var(--color-muted)] sticky top-0 z-10">
        <tr className="text-xs font-medium text-slate-500">
          <th className="px-3 py-3">Chỉ tiêu</th>
          <th className="px-3 py-3 text-right whitespace-nowrap">Mục tiêu</th>
          <th className="px-3 py-3 text-right whitespace-nowrap">Đã phân rã</th>
          <th className="px-3 py-3">Đơn vị nhận</th>
          <th className="px-3 py-3">Tình trạng</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-[var(--color-border)]">
        {items.map(it => {
          const meta = COVERAGE_LABEL[it.status] ?? COVERAGE_LABEL.NOT_CASCADED!
          return (
            <tr key={it.scorecardPerspectiveId}>
              <td className="px-3 py-2.5 text-sm font-semibold text-[var(--color-foreground)]">{it.name}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums">{it.targetValue == null ? '—' : `${fmt(it.targetValue)}${it.unit ? ` ${it.unit}` : ''}`}</td>
              <td className="px-3 py-2.5 text-right text-sm tabular-nums">{it.cascadedValue == null ? '—' : `${fmt(it.cascadedValue)}${it.unit ? ` ${it.unit}` : ''}`}</td>
              <td className="px-3 py-2.5 text-xs text-slate-500">
                {it.children.length === 0 ? '—' : it.children.map(c => `${c.orgUnitName ?? c.scorecardName}${c.contributionPercent != null ? ` ${c.contributionPercent}%` : c.contributionValue != null ? ` ${fmt(c.contributionValue)}` : ''}`).join(', ')}
              </td>
              <td className="px-3 py-2.5"><span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', meta.cls)}>{meta.label}</span></td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── 6. Hạng mục chặn ──────────────────────────────────────────────────────

/** Đơn vị nào đang vướng cửa chặn trong đợt, vướng ở chỉ tiêu nào. */
export function BscGateWidget({ filter, meta }: { filter?: PinnedFilter; meta?: React.ReactNode }) {
  const scope = useBscScope(filter)
  const { data: rows } = useBscUnitAttainment(scope)
  const { data: overview } = useBscOverview(scope)
  const list = (rows ?? []).filter(r => r.gateCount > 0)
  const judged = list.filter(r => r.gatePassed != null)
  const failed = judged.filter(r => r.gatePassed === false)

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {meta}
      <PeriodNote periodName={overview?.periodName} resultStatus={overview?.resultStatus} hasResult={judged.length > 0} />
      {list.length === 0 ? (
        <EmptyState>Thẻ điểm trong phạm vi này chưa đặt chỉ tiêu chặn nào.</EmptyState>
      ) : judged.length === 0 ? (
        <EmptyState>Chưa tính kết quả đợt nên chưa biết đơn vị nào qua cửa.</EmptyState>
      ) : (
        <>
          <div className="flex items-center gap-3 shrink-0">
            <div className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0',
              failed.length ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400')}>
              {failed.length ? <ShieldAlert size={22} /> : <ShieldCheck size={22} />}
            </div>
            <div>
              <p className="text-2xl font-semibold tabular-nums">{judged.length - failed.length}<span className="text-base text-slate-400">/{judged.length}</span></p>
              <p className="text-xs font-medium text-slate-500">thẻ điểm qua mọi cửa chặn</p>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {failed.length === 0 ? (
              <p className="text-sm text-emerald-600 font-medium">Không đơn vị nào vướng cửa chặn trong đợt này.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {failed.map(r => (
                  <li key={r.scorecardId} className="py-2.5 flex items-start gap-2">
                    <ShieldAlert size={15} className="text-rose-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-foreground)] truncate">{r.orgUnitName ?? r.name}</p>
                      <p className="text-xs text-slate-500">Không qua: {r.gateFailedItems || 'chỉ tiêu chặn'} · mức đạt {fmtPct(r.achievementPercent)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── 7. Xếp hạng nhân sự (giữ lại) ──────────────────────────────────────────

/**
 * Xếp hạng nhân sự theo điểm BSC: lollipop Top 15 hoặc bảng phân trang kèm breakdown hạng mục.
 * `sortBy`/`viewControl` do lưới điều khiển; trang chủ để widget tự vẽ pills + nút chuyển.
 */
export function BscRankingWidget({ filter, sortBy: sortProp, viewControl, hideControls, meta }: {
  filter?: PinnedFilter
  sortBy?: 'bscScore' | 'systemScore'
  viewControl?: { value?: ChartTableView; onChange?: (v: ChartTableView) => void }
  hideControls?: boolean
  meta?: React.ReactNode
}) {
  const scope = useBscScope(filter)
  const [localSort, setSortBy] = useState<'bscScore' | 'systemScore'>('bscScore')
  const sortBy = sortProp ?? localSort
  const { view, setView } = useChartTableView('bsc-rank', 'chart', viewControl)
  // Trang nhớ KÈM khoá sắp xếp: đổi cách sắp là về trang đầu, không cần effect.
  const [pageAt, setPageAt] = useState({ key: sortBy, page: 0 })
  const page = pageAt.key === sortBy ? pageAt.page : 0
  const setPage = (p: number) => setPageAt({ key: sortBy, page: p })
  const chartMode = view === 'chart'
  const { data: ranking } = useBscRankings({
    ...scope, sortBy, sortDir: 'desc',
    page: chartMode ? 0 : page,
    size: chartMode ? RANK_CHART_TOP_N : RANK_PAGE_SIZE,
  })

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      {(meta || !hideControls) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>{meta}</div>
          {!hideControls && <ViewToggleButtons view={view} onChange={setView} />}
        </div>
      )}
      {!hideControls && <div className="flex items-center gap-0.5 bg-[var(--color-muted)] rounded-control p-0.5 self-start shrink-0">
        {([['bscScore', 'Điểm BSC'], ['systemScore', 'Điểm hệ thống']] as const).map(([k, lb]) => (
          <ChoiceChip key={k} selected={sortBy === k} variant="segment" size="sm" onClick={() => setSortBy(k)}>
            {lb}
          </ChoiceChip>
        ))}
      </div>}

      {chartMode ? (
        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
          {(ranking?.content?.length ?? 0) === 0 ? (
            <EmptyState>Không có dữ liệu xếp hạng</EmptyState>
          ) : (
            <>
              <Lollipop
                data={(ranking?.content || []).map(row => ({
                  id: row.userId,
                  name: row.fullName,
                  subText: row.email ?? undefined,
                  value: (sortBy === 'bscScore' ? row.bscScore : row.systemScore) ?? 0,
                }))}
                unit=" điểm"
                valueLabel={sortBy === 'bscScore' ? 'Điểm BSC (điểm)' : 'Điểm hệ thống (điểm)'}
                domainMax={100}
              />
              {(ranking?.totalElements ?? 0) > RANK_CHART_TOP_N && (
                <p className="text-xs text-slate-500 text-center mt-2">
                  Top {RANK_CHART_TOP_N} trong {ranking?.totalElements} nhân sự. Xem đủ ở chế độ bảng.
                </p>
              )}
            </>
          )}
        </div>
      ) : (
      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead className="bg-[var(--color-muted)] sticky top-0 z-10">
            <tr className="text-xs font-medium text-slate-500">
              <th className="px-3 py-3 w-10">#</th>
              <th className="px-3 py-3">Nhân sự</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm BSC</th>
              <th className="px-3 py-3 text-right whitespace-nowrap">Điểm HT</th>
              <th className="px-3 py-3 hidden lg:table-cell">Breakdown hạng mục</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {(ranking?.content || []).map((row, idx) => (
              <tr key={row.userId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-3 py-3 text-sm font-medium text-slate-400 tabular-nums">{page * RANK_PAGE_SIZE + idx + 1}</td>
                <td className="px-3 py-3">
                  <p className="text-sm font-semibold text-[var(--color-foreground)]">{row.fullName}</p>
                  <p className="text-xs text-slate-400">{row.email}</p>
                </td>
                <td className={cn('px-3 py-3 text-right text-sm font-semibold tabular-nums', scoreColor(row.bscScore))}>{fmt(row.bscScore)}</td>
                <td className="px-3 py-3 text-right text-sm font-medium tabular-nums text-slate-500">{fmt(row.systemScore)}</td>
                <td className="px-3 py-3 hidden lg:table-cell">
                  <div className="flex flex-wrap gap-1.5">
                    {(ranking?.perspectives || []).map(p => {
                      const v = row.perspectiveScores?.[p.id]
                      if (v == null) return null
                      return (
                        <span
                          key={p.id} className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${p.color || DEFAULT_COLOR}22`, color: p.color || DEFAULT_COLOR }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color || DEFAULT_COLOR }} />
                          {Math.round(v)}%
                        </span>
                      )
                    })}
                  </div>
                </td>
              </tr>
            ))}
            {!(ranking?.content?.length) && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Không có dữ liệu xếp hạng</td></tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!chartMode && (ranking?.totalElements ?? 0) > RANK_PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={ranking?.totalPages ?? 1}
          onPageChange={setPage}
          totalElements={ranking?.totalElements ?? 0}
          size={RANK_PAGE_SIZE}
          itemLabel="nhân sự"
        />
      )}
    </div>
  )
}
