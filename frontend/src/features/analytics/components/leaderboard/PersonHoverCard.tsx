import { useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import RadarScore from '@/components/charts/primitives/RadarScore'
import TrendLine from '@/components/charts/primitives/TrendLine'
import { useFormat } from '@/i18n/useFormat'
import { usePersonDetail } from '../../hooks/usePersonDetail'
import { RatingPill } from './rankStyle'
import type { PersonDetail } from '../../api/personDetailApi'

/** Rê qua rồi đi tiếp thì không nạp gì; dừng lại chừng này mới coi là muốn xem. */
const HOVER_DELAY_MS = 400

/**
 * Thẻ xem nhanh một người khi rê chuột lên hàng bảng xếp hạng: chỉ số, radar giá trị cốt lõi,
 * đường hiệu suất, và một dòng nhắc bấm vào để xem đầy đủ.
 *
 * <p>Bảng xếp hạng chỉ có ba con số một hàng, mà câu hỏi tiếp theo gần như luôn là "người này mạnh
 * yếu mặt nào, đang lên hay xuống" — trả lời ngay tại chỗ thì đỡ một vòng mở trang rồi quay lại.
 *
 * <p>Gọi `light` để BỎ sổ đánh giá kỳ → đợt → KPI: rê chuột bắn nhiều lần hơn hẳn mở trang, mà
 * phần đó là phần nặng nhất của endpoint (mỗi kỳ một lượt tính điểm chốt).
 *
 * <p>Dùng Radix Tooltip chứ không thêm `react-hover-card`: cái đã cài sẵn lo đủ cổng portal, lật
 * cạnh khi chạm mép và độ trễ; chỉ phải ghi đè phần da của nó (tooltip gốc là chip nền primary).
 */
export default function PersonHoverCard({ userId, scope, cycleId, children }: {
  userId?: string | null
  scope: { periodId?: string; periodIdTo?: string }
  cycleId?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Hàng đã ẩn danh không có id — không có gì để xem trước.
  if (!userId) return <>{children}</>

  return (
    // `disableHoverableContent`: thẻ không có gì để bấm bên trong, nên rời hàng là đóng ngay. Để
    // mặc định thì Radix giữ thẻ mở trong một vùng ân hạn giữa hàng và thẻ, và nó treo lại trên
    // màn hình sau khi chuột đã đi chỗ khác.
    <TooltipProvider delayDuration={HOVER_DELAY_MS} disableHoverableContent>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          collisionPadding={12}
          className="w-[21rem] max-w-none border border-[var(--color-border)] bg-[var(--color-card)] p-0 text-[var(--color-foreground)] shadow-lg"
        >
          {/* `open` làm điều kiện nạp: thẻ chưa mở thì không có lời gọi nào. */}
          <PersonPreview userId={userId} scope={scope} cycleId={cycleId} enabled={open} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PersonPreview({ userId, scope, cycleId, enabled }: {
  userId: string
  scope: { periodId?: string; periodIdTo?: string }
  cycleId?: string
  enabled: boolean
}) {
  const { t } = useTranslation('analytics')
  const { data, isLoading, error } = usePersonDetail(userId, { ...scope, cycleId, light: true }, enabled)

  return (
    <div className="flex flex-col">
      <div className="space-y-3 px-3 py-3">
        {isLoading || !data ? (
          <PreviewSkeleton error={!!error} />
        ) : (
          <>
            <Header data={data} />
            <Metrics data={data} />
            <Radar data={data} />
            <Trend data={data} />
          </>
        )}
      </div>
      {/* Hàng bảng xếp hạng bấm được nhưng không có gì nói ra điều đó — dòng này nói. */}
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

function Header({ data }: { data: PersonDetail }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{data.fullName}</p>
      <p className="truncate text-[11px] text-slate-400">
        {[data.orgUnitName, data.periodName].filter(Boolean).join(' · ')}
      </p>
    </div>
  )
}

function Metrics({ data }: { data: PersonDetail }) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const m = data.metrics

  return (
    <div className="grid grid-cols-2 gap-1.5">
      <Chip label={t('detail.performance')} value={m?.performancePercent == null ? '—' : fmt.percent(m.performancePercent)} />
      <Chip
        label={t('detail.coreValues')}
        value={m?.conductScore == null ? '—'
          : `${fmt.number(m.conductScore)}${m.conductMax ? `/${fmt.number(m.conductMax)}` : ''}`}
      />
      <Chip
        label={t('detail.rating')}
        value={m?.ratingName ? <RatingPill name={m.ratingName} color={m.ratingColor} /> : '—'}
      />
      <Chip
        label={t('detail.latePercent')}
        value={m?.latePercent == null ? '—' : fmt.percent(m.latePercent)}
        sub={m?.totalCount ? `${m.lateCount ?? 0}/${m.totalCount}` : undefined}
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

function Radar({ data }: { data: PersonDetail }) {
  const { t } = useTranslation('analytics')
  const scale = data.conduct[0]
  if (!scale) return null

  return (
    <RadarScore
      data={data.conduct.map(c => ({
        axis: c.criteriaName ?? '',
        manager: c.managerScore ?? null,
      }))}
      axisKey="axis"
      series={[{ key: 'manager', label: t('detail.managerScore') }]}
      min={scale.minScore ?? 1}
      max={scale.maxScore ?? 5}
      unit={t('detail.pointUnit')}
      height={150}
      emptyText={t('detail.noConduct')}
    />
  )
}

function Trend({ data }: { data: PersonDetail }) {
  const { t } = useTranslation('analytics')
  if (!data.trend.length) return null

  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {t('detail.performanceAxis')}
      </p>
      {/* Khung hẹp: chỉ giữ mốc đầu và mốc cuối trên trục, không thì 12 tên đợt đè lên nhau. */}
      <TrendLine
        data={data.trend.map(p => ({ period: p.periodName ?? '', performance: p.performancePercent ?? null }))}
        categoryKey="period"
        series={[{ key: 'performance', label: t('detail.performance') }]}
        unit="%"
        height={110}
        showValues={false}
        xInterval="preserveStartEnd"
      />
    </div>
  )
}
