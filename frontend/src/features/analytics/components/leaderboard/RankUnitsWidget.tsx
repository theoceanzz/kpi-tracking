import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import { useUnitLeaderboard } from '../../hooks/useLeaderboard'
import UnitHoverCard from './UnitHoverCard'
import { NumCell, RankBadge, RankRow, RankTableShell, SortableHead } from './rankStyle'
import type { SortDir } from '@/components/common/SortHeader'

/**
 * Top đơn vị: chính đơn vị đang xem và toàn bộ cây bên dưới.
 *
 * <p>Cùng khuôn với bảng nhân sự (hạng + tên + các cột số), chỉ khác bộ số: đóng góp BSC · trung
 * bình %KPI · số lượng KPI · giá trị cốt lõi.
 */
export default function RankUnitsWidget({ scope, cycleId, limit, sortBy, dir, onSort, meta }: {
  scope: { orgUnitId?: string; periodId?: string; periodIdTo?: string }
  cycleId?: string
  limit?: number
  sortBy: string
  dir: SortDir
  onSort: (field: string, dir: SortDir) => void
  meta?: React.ReactNode
}) {
  const { t } = useTranslation('analytics')
  const fmt = useFormat()
  const navigate = useNavigate()
  const { data, isLoading } = useUnitLeaderboard({ ...scope, cycleId, limit: limit ?? 10, sortBy, sortDir: dir })

  const rows = data?.rows ?? []
  const pct = (v?: number | null) => (v == null ? '—' : fmt.percent(v))
  const conduct = (score?: number | null, max?: number | null) =>
    score == null ? '—' : `${fmt.number(score)}${max ? `/${fmt.number(max)}` : ''}`

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {meta}
      <RankTableShell
        isLoading={isLoading}
        empty={rows.length === 0}
        emptyText={t('leaderboard.noUnitScored')}
        hint={t('leaderboard.clickRowForUnit')}
        head={
          <>
            <th className="w-12 px-3 py-2 text-left">{t('leaderboard.top')}</th>
            <th className="px-3 py-2 text-left">{t('leaderboard.unit')}</th>
            <SortableHead field="bsc" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.bscContribution')}</SortableHead>
            <SortableHead field="kpi" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.avgKpiPercent')}</SortableHead>
            <SortableHead field="kpiCount" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.kpiCount')}</SortableHead>
            <SortableHead field="conduct" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.coreValues')}</SortableHead>
          </>
        }
      >
        {rows.map((r, i) => (
          // Rê chuột lên hàng: thẻ xem nhanh radar BSC + xu hướng + chỉ số, kèm dòng nhắc bấm vào.
          <UnitHoverCard key={r.orgUnitId ?? `unit-${i}`} orgUnitId={r.orgUnitId} scope={scope} cycleId={cycleId}>
          <RankRow
            rank={i + 1}
            onClick={r.orgUnitId ? () => navigate(`/analytics/unit/${r.orgUnitId}`) : undefined}
            // KHÔNG đặt `title`: tooltip gốc của trình duyệt sẽ bật đè lên thẻ xem nhanh.
          >
            <td className="px-3 py-2"><RankBadge rank={i + 1} /></td>
            <td className="px-3 py-2">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{r.orgUnitName ?? '—'}</p>
            </td>
            <NumCell strong>{pct(r.bscPercent)}</NumCell>
            <NumCell>{pct(r.avgKpiPercent)}</NumCell>
            <NumCell>{r.kpiCount ?? 0}</NumCell>
            <NumCell>{conduct(r.conductScore, r.conductMax ?? data?.conductMax)}</NumCell>
          </RankRow>
          </UnitHoverCard>
        ))}
      </RankTableShell>
      {data && data.bscEnabled === false && (
        <p className="text-xs text-slate-400">{t('leaderboard.bscOff')}</p>
      )}
      {data && data.conductEnabled === false && (
        <p className="text-xs text-slate-400">{t('leaderboard.conductOff')}</p>
      )}
    </div>
  )
}
