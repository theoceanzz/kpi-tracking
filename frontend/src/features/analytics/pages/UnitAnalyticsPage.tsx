import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Building2, Gauge, Heart, ListChecks, Medal, Radar as RadarIcon, TrendingUp, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { ChartWrapper } from '@/components/common/dashboard/ChartWrapper'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import RadarScore from '@/components/charts/primitives/RadarScore'
import TrendLine from '@/components/charts/primitives/TrendLine'
import { useFormat } from '@/i18n/useFormat'
import { getApiErrorMessage } from '@/lib/apiError'
import UnitEvaluationTree from '../components/unit/UnitEvaluationTree'
import { useUnitDetail } from '../hooks/useUnitDetail'

/**
 * Thống kê chi tiết của MỘT đơn vị — đích đến khi bấm một hàng trên bảng xếp hạng đơn vị.
 *
 * <p>Cùng bố cục với {@code PersonAnalyticsPage} nhưng đổi bộ hình cho đúng thứ đo một đơn vị:
 * radar bốn lĩnh vực BSC, xu hướng từng lĩnh vực qua các đợt, và KHÔNG có danh sách KPI — câu hỏi
 * về một đơn vị là "lĩnh vực nào đang kéo lùi".
 *
 * <p>Mọi con số do server tính và hàng chỉ số lấy ĐÚNG cột mà bảng xếp hạng lấy.
 */
export default function UnitAnalyticsPage() {
  const { t } = useTranslation('analytics')
  const { orgUnitId } = useParams<{ orgUnitId: string }>()
  const navigate = useNavigate()
  const fmt = useFormat()
  const { data, isLoading, error } = useUnitDetail(orgUnitId)

  const pct = (v?: number | null) => (v == null ? '—' : fmt.percent(v))
  const m = data?.metrics
  const hasBsc = !!data?.bscEnabled && (data?.bscTrend.length ?? 0) > 0

  // Trục Y của biểu đồ bậc xếp loại: mỗi bậc một vạch, bậc thấp nhất ở đáy.
  const ratingTicks = (data?.ratingLevels ?? []).map((l, i) => ({ value: i + 1, label: l.name ?? '' }))
  const ratingName = (v: number | string) => ratingTicks.find(x => x.value === Number(v))?.label ?? `${v}`

  const trendData = (data?.trend ?? []).map(p => ({
    period: p.periodName ?? '',
    bsc: p.bscPercent ?? null,
    rating: p.ratingIndex ?? null,
  }))

  // Mỗi lĩnh vực một chuỗi; khoá là mã lĩnh vực nên thứ tự chuỗi luôn trùng thứ tự trục radar.
  const axisSeries = (data?.bsc ?? []).map(a => ({
    key: a.code ?? '',
    label: a.name ?? a.code ?? '',
    color: a.color ?? undefined,
  }))
  const missingAxes = (data?.bsc ?? []).filter(a => a.percent == null).map(a => a.name ?? a.code ?? '')
  const axisTrendData = (data?.bscTrend ?? []).map(p => {
    const row: Record<string, string | number | null> = { period: p.periodName ?? '' }
    p.axes.forEach(a => { if (a.code) row[a.code] = a.percent ?? null })
    return row
  })

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 px-4 pb-20 md:px-0">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> {t('detail.back')}
      </Button>

      {error ? (
        <div className="rounded-widget border border-[var(--color-border)] p-10 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">{getApiErrorMessage(error)}</p>
        </div>
      ) : isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : (
        <>
          {/* ── Đơn vị nào ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)]">
              <Building2 size={20} className="text-slate-400" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-[var(--color-foreground)]">{data?.name}</h1>
              <p className="truncate text-xs text-slate-400">
                {[data?.parentName, data?.periodName].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {/* ── Chỉ số của đợt gần nhất có số ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard
              label={t('detail.bscContribution')} icon={<Gauge />} color="indigo"
              value={pct(m?.bscPercent)} sub={data?.periodName ?? undefined}
            />
            <StatCard label={t('detail.avgKpi')} icon={<TrendingUp />} color="emerald" value={pct(m?.avgKpiPercent)} />
            <StatCard label={t('detail.kpiCount')} icon={<ListChecks />} color="amber" value={fmt.number(m?.kpiCount ?? 0)} />
            <StatCard
              label={t('detail.coreValues')} icon={<Heart />} color="red"
              value={m?.conductScore == null ? '—'
                : `${fmt.number(m.conductScore)}${m.conductMax ? `/${fmt.number(m.conductMax)}` : ''}`}
            />
            <StatCard label={t('detail.memberCount')} icon={<Users />} color="indigo" value={fmt.number(m?.memberCount ?? 0)} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ── Radar bốn lĩnh vực ────────────────────────────────────── */}
            <ChartWrapper
              title={t('detail.bscRadarTitle')}
              icon={<RadarIcon size={20} className="text-slate-400" />}
            >
              {!hasBsc ? (
                <p className="py-10 text-center text-sm text-slate-400">
                  {data?.bscEnabled ? t('detail.noBsc') : t('leaderboard.bscOff')}
                </p>
              ) : (
                <>
                  <p className="-mt-3 text-xs text-slate-400">{t('detail.bscRadarHint')}</p>
                  {/* Trục không có chỉ tiêu nào bị Recharts vẽ về TÂM, nhìn y hệt "đạt 0%". Không
                      bỏ trục đi được (radar hai trục là một đoạn thẳng), nên nói thẳng ra. */}
                  {missingAxes.length > 0 && (
                    <p className="mb-2 text-xs text-amber-600 dark:text-amber-400">
                      {t('detail.bscMissingAxes', { names: missingAxes.join(', ') })}
                    </p>
                  )}
                  <div className={missingAxes.length > 0 ? '' : 'mt-2'} />
                  {/* Thang chạy tới ÍT NHẤT 120%: %đạt vượt chỉ tiêu là chuyện thường, cắt ở 100
                      thì đơn vị vượt bị bóp lại bằng đơn vị vừa đủ. */}
                  <RadarScore
                    data={(data?.bsc ?? []).map(a => ({ axis: a.name ?? '', percent: a.percent ?? null }))}
                    axisKey="axis"
                    series={[{ key: 'percent', label: t('detail.bscContribution') }]}
                    min={0}
                    max={Math.max(120, ...(data?.bsc ?? []).map(a => a.percent ?? 0))}
                    unit="%"
                    height={280}
                    emptyText={t('detail.noBsc')}
                  />
                </>
              )}
            </ChartWrapper>

            {/* ── Diễn biến %đạt chung ──────────────────────────────────── */}
            <ChartWrapper
              title={t('detail.bscOverallTitle')}
              icon={<TrendingUp size={20} className="text-slate-400" />}
            >
              <TrendLine
                data={trendData}
                categoryKey="period"
                series={[{ key: 'bsc', label: t('detail.bscContribution') }]}
                unit="%"
                yLabel={t('detail.bscAxis')}
                reference={{ value: 100, label: t('detail.targetLine') }}
                height={280}
                xInterval="preserveStartEnd"
              />
            </ChartWrapper>
          </div>

          {/* ── Từng lĩnh vực qua các đợt ───────────────────────────────── */}
          {hasBsc && (
            <ChartWrapper
              title={t('detail.bscTrendTitle')}
              icon={<TrendingUp size={20} className="text-slate-400" />}
            >
              {/* Bốn chuỗi cùng một đơn vị %, nên chung một trục — và vì có nhiều màu nên bắt buộc
                  có chú giải; màu lấy từ server để trùng với màu lĩnh vực ở mọi màn BSC khác. */}
              <TrendLine
                data={axisTrendData}
                categoryKey="period"
                series={axisSeries}
                unit="%"
                yLabel={t('detail.bscAxis')}
                height={300}
                showValues={false}
                xInterval="preserveStartEnd"
              />
              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-slate-500">
                {axisSeries.map(s => (
                  <span key={s.key} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </ChartWrapper>
          )}

          {/* ── Bậc xếp loại qua các đợt ────────────────────────────────── */}
          <ChartWrapper
            title={t('detail.ratingTrendTitle')}
            icon={<Medal size={20} className="text-slate-400" />}
          >
            {ratingTicks.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{t('detail.noRatingLevels')}</p>
            ) : (
              <TrendLine
                data={trendData}
                categoryKey="period"
                series={[{ key: 'rating', label: t('detail.rating') }]}
                yLabel={t('detail.ratingAxis')}
                height={240}
                step
                yTicks={ratingTicks}
                showValues={false}
                format={ratingName}
                xInterval="preserveStartEnd"
              />
            )}
          </ChartWrapper>

          {/* ── Sổ đánh giá: kỳ → đợt (không có KPI) ────────────────────── */}
          <ChartWrapper
            title={t('detail.evalTabsTitle')}
            icon={<ListChecks size={20} className="text-slate-400" />}
          >
            <UnitEvaluationTree key={data?.orgUnitId} cycles={data?.cycles ?? []} />
          </ChartWrapper>
        </>
      )}
    </div>
  )
}
