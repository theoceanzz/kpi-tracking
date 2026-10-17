import { useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import RadarScore from '@/components/charts/primitives/RadarScore'
import TrendLine from '@/components/charts/primitives/TrendLine'
import { useFormat } from '@/i18n/useFormat'
import { useUnitDetail } from '../../hooks/useUnitDetail'
import type { UnitDetail } from '../../api/unitDetailApi'

/** Rê qua rồi đi tiếp thì không nạp gì; dừng lại chừng này mới coi là muốn xem. */
const HOVER_DELAY_MS = 400

/**
 * Thẻ xem nhanh một đơn vị khi rê chuột lên hàng bảng xếp hạng: chỉ số, radar bốn lĩnh vực BSC,
 * đường %đạt BSC, và một dòng nhắc bấm vào để xem đầy đủ.
 *
 * <p>Cùng khuôn với `PersonHoverCard` — xem docblock bên đó cho ba điều phải nhớ khi dùng Radix
 * Tooltip làm thẻ xem nhanh (`disableHoverableContent`, chỉ nạp khi mở, hợp thật nằm ở popper
 * wrapper chứ không phải span `role=tooltip` ẩn).
 */
export default function UnitHoverCard({ orgUnitId, scope, cycleId, children }: {
  orgUnitId?: string | null
  scope: { periodId?: string; periodIdTo?: string }
  cycleId?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  if (!orgUnitId) return <>{children}</>

  return (
    <TooltipProvider delayDuration={HOVER_DELAY_MS} disableHoverableContent>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          collisionPadding={12}
          className="w-[21rem] max-w-none border border-[var(--color-border)] bg-[var(--color-card)] p-0 text-[var(--color-foreground)] shadow-lg"
        >
          <UnitPreview orgUnitId={orgUnitId} scope={scope} cycleId={cycleId} enabled={open} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function UnitPreview({ orgUnitId, scope, cycleId, enabled }: {
  orgUnitId: string
  scope: { periodId?: string; periodIdTo?: string }
  cycleId?: string
  enabled: boolean
}) {
  const { t } = useTranslation('analytics')
  const { data, isLoading, error } = useUnitDetail(orgUnitId, { ...scope, cycleId, light: true }, enabled)

  return (
    <div className="flex flex-col">
      <div className="space-y-3 px-3 py-3">
        {isLoading || !data ? (
          <PreviewSkeleton error={!!error} />
        ) : (
          <>
            <Header data={data} />
            <Metrics data={data} />
            <BscRadar data={data} />
            <BscTrend data={data} />
          </>
        )}
      </div>
      <p className="flex items-center justify-center gap-1 border-t border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1.5 text-[11px] font-medium text-[var(--color-primary)]">
        {t('leaderboard.previewOpen')}
        <ArrowRight size={12} aria-hidden="true" />
      </p>
    </div>
  )
}

function PreviewSkeleton({ error }: { error: boolean }) {
  const { t } = useTranslation('analytics')
  if (error) {
    return <p className="py-6 text-center text-xs text-slate-400">{t('leaderboard.previewFailed')}</p>
  }
  return (
    <div className="space-y-2" aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded bg-[var(--color-muted)]" />
      <div className="h-10 animate-pulse rounded bg-[var(--color-muted)]" />
      <div className="h-32 animate-pulse rounded bg-[var(--color-muted)]" />
    </div>
  )
}

function Header({ data }: { data: UnitDetail }) {
  const { t } = useTranslation('analytics')
  const members = data.metrics?.memberCount
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{data.name}</p>
      <p className="truncate text-[11px] text-slate-400">
        {[data.parentName, data.periodName, members ? t('detail.members', { count: members }) : null]
          .filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

function Metrics({ data }: { data: UnitDetail }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const m = data.metrics

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Chip label={t('detail.bscContribution')} value={m?.bscPercent == null ? '—' : fmt.percent(m.bscPercent)} />
      <Chip label={t('detail.avgKpi')} value={m?.avgKpiPercent == null ? '—' : fmt.percent(m.avgKpiPercent)} />
      <Chip label={t('detail.kpiCount')} value={fmt.number(m?.kpiCount ?? 0)} />
      <Chip
        label={t('detail.coreValues')}
        value={m?.conductScore == null ? '—'
          : `${fmt.number(m.conductScore)}${m.conductMax ? `/${fmt.number(m.conductMax)}` : ''}`}
      />
    </div>
  )
}

function Chip({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-control border border-[var(--color-border)] px-2 py-1">
      <p className="truncate text-[10px] text-slate-400" title={label}>{label}</p>
      <p className="truncate text-xs font-semibold tabular-nums">
        {value}
        {sub && <span className="ml-1 font-normal text-slate-400">{sub}</span>}
      </p>
    </div>
  )
}

function BscRadar({ data }: { data: UnitDetail }) {
  const { t } = useTranslation('analytics')
  if (!data.bscEnabled) {
    return <p className="py-3 text-center text-xs text-slate-400">{t('leaderboard.bscOff')}</p>
  }
  if (!data.bsc.some(a => a.percent != null)) {
    return <p className="py-3 text-center text-xs text-slate-400">{t('detail.noBsc')}</p>
  }

  // Thang 0..120%: %đạt vượt 100 là chuyện thường, cắt ở 100 thì đơn vị vượt chỉ tiêu bị bóp lại
  // bằng đơn vị vừa đủ.
  return (
    <RadarScore
      data={data.bsc.map(a => ({ axis: a.name ?? '', percent: a.percent ?? null }))}
      axisKey="axis"
      series={[{ key: 'percent', label: t('detail.bscContribution') }]}
      min={0}
      max={Math.max(120, ...data.bsc.map(a => a.percent ?? 0))}
      unit="%"
      height={150}
      emptyText={t('detail.noBsc')}
    />
  )
}

function BscTrend({ data }: { data: UnitDetail }) {
  const { t } = useTranslation('analytics')
  if (!data.trend.length) return null

  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {t('detail.bscAxis')}
      </p>
      <TrendLine
        data={data.trend.map(p => ({ period: p.periodName ?? '', bsc: p.bscPercent ?? null }))}
        categoryKey="period"
        series={[{ key: 'bsc', label: t('detail.bscContribution') }]}
        unit="%"
        height={110}
        showValues={false}
        xInterval="preserveStartEnd"
      />
    </div>
  )
}
