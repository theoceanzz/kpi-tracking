import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Award, CalendarClock, Gauge, Heart, ListChecks, Medal, Radar as RadarIcon, TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import UserAvatar from '@/components/common/UserAvatar'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { ChartWrapper } from '@/components/common/dashboard/ChartWrapper'
import { StatCard } from '@/features/dashboard/widgets/shared/StatCard'
import RadarScore from '@/components/charts/primitives/RadarScore'
import TrendLine from '@/components/charts/primitives/TrendLine'
import { useFormat } from '@/i18n/useFormat'
import { getApiErrorMessage } from '@/lib/apiError'
import PersonEvaluationTree from '../components/person/PersonEvaluationTree'
import { usePersonDetail } from '../hooks/usePersonDetail'

/** Trên mức này thì tỉ lệ trễ hẹn tô đỏ — một phần tư số kỳ lỡ hẹn là đã phải hỏi. */
const LATE_ALERT_PERCENT = 25

/**
 * Thống kê chi tiết của MỘT người — đích đến khi bấm một hàng trên bảng xếp hạng nhân sự.
 *
 * <p>Bốn phần trả lời bốn câu khác nhau: hàng chỉ số nói "đang ở đâu", radar nói "mạnh yếu mặt
 * nào", bảng KPI nói "đang gánh gì", đường xu hướng nói "đang lên hay xuống".
 *
 * <p>Mọi con số do server tính và lấy ĐÚNG cột mà bảng xếp hạng lấy — trang chi tiết nói khác hàng
 * vừa bấm thì người đọc không biết tin bên nào.
 */
export default function PersonAnalyticsPage() {
  const { t } = useTranslation('analytics')
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const fmt = useFormat()
  const { data, isLoading, error } = usePersonDetail(userId)

  const pct = (v?: number | null) => (v == null ? '—' : fmt.percent(v))
  const m = data?.metrics
  const conductScale = data?.conduct?.[0]

  const trendData = (data?.trend ?? []).map(p => ({
    period: p.periodName ?? '',
    performance: p.performancePercent ?? null,
    rating: p.ratingIndex ?? null,
  }))

  // Trục Y của biểu đồ bậc xếp loại: mỗi bậc một vạch, bậc thấp nhất ở đáy. Backend đã gửi thang
  // theo đúng thứ tự này và đánh số từng đợt vào `ratingIndex`.
  const ratingTicks = (data?.ratingLevels ?? []).map((l, i) => ({ value: i + 1, label: l.name ?? '' }))
  const ratingName = (v: number | string) => ratingTicks.find(x => x.value === Number(v))?.label ?? `${v}`

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
          {/* ── Ai ─────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <UserAvatar fullName={data?.fullName} avatarUrl={data?.avatarUrl} className="h-11 w-11 rounded-full" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-[var(--color-foreground)]">{data?.fullName}</h1>
              <p className="truncate text-xs text-slate-400">
                {[data?.orgUnitName, data?.email].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          {/* ── Chỉ số của đợt gần nhất có số ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t('detail.performance')} icon={<Gauge />} color="indigo"
              value={pct(m?.performancePercent)}
              sub={data?.periodName ?? undefined}
            />
            <StatCard
              label={t('detail.coreValues')} icon={<Heart />} color="emerald"
              value={m?.conductScore == null ? '—'
                : `${fmt.number(m.conductScore)}${m.conductMax ? `/${fmt.number(m.conductMax)}` : ''}`}
              sub={m?.conductScore == null ? t('detail.conductOff') : undefined}
            />
            <StatCard
              label={t('detail.rating')} icon={<Award />} color="amber"
              value={m?.ratingName
                ? <span className="text-stat" style={{ color: m.ratingColor ?? undefined }}>{m.ratingName}</span>
                : '—'}
            />
            <StatCard
              label={t('detail.latePercent')} icon={<CalendarClock />} color="red"
              value={pct(m?.latePercent)}
              // Con số trần trụi "33%" không nói được 33% của cái gì.
              sub={m?.totalCount ? t('detail.lateOf', { late: m.lateCount ?? 0, total: m.totalCount }) : undefined}
              highlight={(m?.latePercent ?? 0) > LATE_ALERT_PERCENT}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* ── Từng tiêu chí giá trị cốt lõi ─────────────────────────── */}
            <ChartWrapper
              title={t('detail.conductRadarTitle')}
              icon={<RadarIcon size={20} className="text-slate-400" />}
            >
              {/* Thang điểm nói ở phụ đề: trục bán kính không đeo được nhãn xoay. */}
              <p className="-mt-3 mb-2 text-xs text-slate-400">
                {conductScale?.maxScore
                  ? t('detail.conductScale', { max: fmt.number(conductScale.maxScore) })
                  : t('detail.conductOff')}
              </p>
              <RadarScore
                data={(data?.conduct ?? []).map(c => ({
                  axis: c.criteriaName ?? '',
                  self: c.selfScore ?? null,
                  manager: c.managerScore ?? null,
                }))}
                axisKey="axis"
                series={[
                  { key: 'manager', label: t('detail.managerScore') },
                  { key: 'self', label: t('detail.selfScore') },
                ]}
                min={conductScale?.minScore ?? 1}
                max={conductScale?.maxScore ?? 5}
                unit={t('detail.pointUnit')}
                emptyText={t('detail.noConduct')}
              />
            </ChartWrapper>

            {/* ── Diễn biến qua các đợt ─────────────────────────────────── */}
            <ChartWrapper
              title={t('detail.trendTitle')}
              icon={<TrendingUp size={20} className="text-slate-400" />}
            >
              {/* Trục X là tên đợt — danh mục hiển nhiên, không dán nhãn. Xếp loại mã hoá bằng MÀU
                  chấm chứ không phải một trục thứ hai (trục Y thứ hai bị cấm). */}
              <TrendLine
                data={trendData}
                categoryKey="period"
                series={[{ key: 'performance', label: t('detail.performance') }]}
                unit="%"
                yLabel={t('detail.performanceAxis')}
                reference={{ value: 100, label: t('detail.targetLine') }}
                height={280}
                xInterval="preserveStartEnd"
              />
            </ChartWrapper>
          </div>

          {/* ── Bậc xếp loại qua các đợt ────────────────────────────────── */}
          <ChartWrapper
            title={t('detail.ratingTrendTitle')}
            icon={<Medal size={20} className="text-slate-400" />}
          >
            {ratingTicks.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{t('detail.noRatingLevels')}</p>
            ) : (
              // Xếp loại là thang BẬC: đường bậc thang giữ nguyên hạng tới đợt đổi hạng, còn đường
              // cong sẽ vẽ ra những hạng trung gian không tồn tại. Trục Y in TÊN bậc nên màu không
              // còn phải gánh thông tin nào.
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

          {/* ── Sổ đánh giá: kỳ → đợt → KPI ───────────────────────────── */}
          <ChartWrapper
            title={t('detail.evalTabsTitle')}
            icon={<ListChecks size={20} className="text-slate-400" />}
          >
            {/* `key` theo người: nhánh đang mở là state cục bộ, đổi người mà giữ lại thì mở ra
                đúng nhánh cũ trên một bộ kỳ khác hẳn. */}
            <PersonEvaluationTree key={data?.userId} cycles={data?.cycles ?? []} />
          </ChartWrapper>
        </>
      )}
    </div>
  )
}
