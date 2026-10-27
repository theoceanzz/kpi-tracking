/* eslint-disable react-refresh/only-export-components --
   Một CỤM Ô = khai báo ô (danh sách, nhóm, mô tả) + bộ vẽ ra chúng. Tách đôi để chiều quy tắc
   fast-refresh thì mỗi cụm nằm ở hai tệp và sửa một ô phải mở cả hai; cái giá thật ở đây chỉ là
   tải lại cả trang thay vì nóng khi sửa tệp này lúc phát triển. */
import { Trophy, Building2, Grid3x3 } from 'lucide-react'
import i18n from 'i18next'
import { useTranslation } from 'react-i18next'
import { ChartWrapper, type DashboardWidget } from '@/components/common/dashboard/ChartWrapper'
import { perLanguage } from '@/i18n/perLanguage'
import type { ViewerPosition } from '@/features/dashboard/hooks/useViewerPosition'
import { widgetFilter, widgetUnit, optionOf, type OptionField } from '../grid/analyticsGrid'
import type { SortDir } from '@/components/common/SortHeader'
import type { WidgetPackProps } from '../grid/widgetPack'
import RankPeopleWidget from '../components/leaderboard/RankPeopleWidget'
import RankUnitsWidget from '../components/leaderboard/RankUnitsWidget'
import UnitPeriodHeatmapWidget from '../components/leaderboard/UnitPeriodHeatmapWidget'

/**
 * Ba ô mở đầu trang Thống kê — và là ba ô DUY NHẤT hiện sẵn.
 *
 * <p>Vào trang là thấy ngay ba câu trả lời: ai đang dẫn đầu, đơn vị nào đang dẫn đầu, chỗ nào tụt
 * ở đợt nào. 39 ô còn lại vẫn đủ trong thư viện nhưng ẩn — bày hết ra là không ai đọc cái nào.
 */

export const LEADERBOARD_WIDGETS = perLanguage((): DashboardWidget[] => ([
  { i: 'rank-people', type: 'RANK_PEOPLE', title: i18n.t('analytics:leaderboard.peopleTitle'), x: 0, y: 0, w: 6, h: 12, visible: true },
  { i: 'rank-units', type: 'RANK_UNITS', title: i18n.t('analytics:leaderboard.unitsTitle'), x: 6, y: 0, w: 6, h: 12, visible: true },
  { i: 'heatmap-units', type: 'HEATMAP_UNITS', title: i18n.t('analytics:leaderboard.heatmapTitle'), x: 0, y: 12, w: 12, h: 11, visible: true },
]))

export const LEADERBOARD_SET = ['rank-people', 'rank-units', 'heatmap-units'] as const
export const LEADERBOARD_POSITION_LAYOUT: Record<ViewerPosition, readonly string[]> = {
  DIRECTOR: LEADERBOARD_SET, HEAD: LEADERBOARD_SET, DEPUTY: LEADERBOARD_SET, STAFF: LEADERBOARD_SET,
}

export const LEADERBOARD_GROUP_OF = perLanguage((): Record<string, string> => ({
  'rank-people': i18n.t('analytics:leaderboard.groupRanking'),
  'rank-units': i18n.t('analytics:leaderboard.groupRanking'),
  'heatmap-units': i18n.t('analytics:leaderboard.groupHeatmap'),
}))

export const LEADERBOARD_PREVIEW_OF: Record<string, string> = {
  'rank-people': 'table',
  'rank-units': 'table',
  'heatmap-units': 'heatmap',
}

export const LEADERBOARD_DESC_OF = perLanguage((): Record<string, string> => ({
  'rank-people': i18n.t('analytics:leaderboard.peopleDesc'),
  'rank-units': i18n.t('analytics:leaderboard.unitsDesc'),
  'heatmap-units': i18n.t('analytics:leaderboard.heatmapDesc'),
}))

/** Sentinel "xếp theo đợt" — `SelectItem` của Radix không nhận value rỗng. */
export const BY_PERIOD = '__by_period__'

/** Kỳ đang chọn của một ô; `undefined` = xếp theo đợt. */
export function cycleOf(w: DashboardWidget | undefined): string | undefined {
  const v = w?.s?.o?.cycleId
  return v && v !== BY_PERIOD ? v : undefined
}

/**
 * Tuỳ chọn "Xếp theo" của hai bảng xếp hạng.
 *
 * <p>Khai ĐỘNG chứ không qua `WIDGET_OPTIONS`: danh sách kỳ lấy từ API, mà `optionOf` chỉ chấp
 * nhận giá trị nằm trong danh sách tĩnh nên sẽ loại mọi id thật.
 */
export function useLeaderboardExtraFields(cycles: { id: string; name?: string | null }[]) {
  const { t } = useTranslation('analytics')
  const fields: OptionField[] = [{
    key: 'cycleId', label: t('leaderboard.rankBy'), kind: 'select', default: BY_PERIOD,
    choices: [
      { value: BY_PERIOD, label: t('leaderboard.byPeriod') },
      ...cycles.map(c => ({ value: c.id, label: t('leaderboard.byCycle', { name: c.name ?? '' }) })),
    ],
  }]
  return (i: string) => (i === 'rank-people' || i === 'rank-units' ? fields : undefined)
}

export default function LeaderboardPack({ widget: w, meta, pageIntent, periods, cycles, updateWidgetSettings }: WidgetPackProps) {
  const f = widgetFilter(w, pageIntent, periods, cycles)
  const scope = { orgUnitId: widgetUnit(w), periodId: f.periodId, periodIdTo: f.periodIdTo }

  /*
    Cột xếp và chiều xếp lưu CHUNG một chỗ với bảng cấu hình (`s.o`), nên bấm đầu cột hay chọn
    trong bảng cấu hình đều ra cùng một trạng thái — và hàng chip trên bảng tự nói ra nó.
  */
  const sortBy = optionOf(w, 'sortBy') ?? (w.type === 'RANK_UNITS' ? 'bsc' : 'kpi')
  const dir = (optionOf(w, 'dir') ?? 'desc') as SortDir
  const onSort = (field: string, next: SortDir) =>
    updateWidgetSettings(w.i, { o: { ...w.s?.o, sortBy: field, dir: next } })

  switch (w.type) {
    case 'RANK_PEOPLE': return (
      <ChartWrapper title={w.title} icon={<Trophy size={20} className="text-slate-400" />}>
        <RankPeopleWidget scope={scope} cycleId={cycleOf(w)} sortBy={sortBy} dir={dir} onSort={onSort} meta={meta} />
      </ChartWrapper>
    )
    case 'RANK_UNITS': return (
      <ChartWrapper title={w.title} icon={<Building2 size={20} className="text-slate-400" />}>
        <RankUnitsWidget scope={scope} cycleId={cycleOf(w)} sortBy={sortBy} dir={dir} onSort={onSort} meta={meta} />
      </ChartWrapper>
    )
    case 'HEATMAP_UNITS': return (
      <ChartWrapper title={w.title} icon={<Grid3x3 size={20} className="text-slate-400" />}>
        <UnitPeriodHeatmapWidget scope={scope} meta={meta} />
      </ChartWrapper>
    )
    default: return null
  }
}
