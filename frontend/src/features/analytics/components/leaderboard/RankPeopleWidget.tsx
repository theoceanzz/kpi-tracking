import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useFormat } from '@/i18n/useFormat'
import { usePeopleLeaderboard } from '../../hooks/useLeaderboard'
import PersonHoverCard from './PersonHoverCard'
import { NumCell, RankBadge, RankRow, RankTableShell, RatingPill, SortableHead } from './rankStyle'
import type { SortDir } from '@/components/common/SortHeader'

/**
 * Top nhân sự trong đơn vị đang xem VÀ toàn bộ cây đơn vị bên dưới.
 *
 * <p>Năm cột đúng như đã chốt: hạng · tên · KPI · giá trị cốt lõi · xếp loại. Mọi con số do server
 * tính (hiệu suất qua bộ tính điểm của lõi, hạnh kiểm qua module Hạnh kiểm, xếp loại theo ngưỡng
 * của chính tổ chức) — ô này không tự tính gì.
 *
 * <p>`cycleId` khác undefined ⇒ xếp theo KỲ và server bỏ qua bộ lọc đợt.
 */
export default function RankPeopleWidget({ scope, cycleId, limit, sortBy, dir, onSort, meta }: {
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
  const { data, isLoading } = usePeopleLeaderboard({ ...scope, cycleId, limit: limit ?? 10, sortBy, sortDir: dir })

  const rows = data?.rows ?? []
  const pct = (v?: number | null) => (v == null ? '—' : fmt.percent(v))
  const conduct = (score?: number | null, max?: number | null) =>
    score == null ? '—' : `${fmt.number(score)}${max ? `/${fmt.number(max)}` : ''}`

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {meta}
      {data?.anonymized && (
        <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
          {t('leaderboard.anonymizedNotice')}
        </p>
      )}
      <RankTableShell
        isLoading={isLoading}
        empty={rows.length === 0}
        emptyText={t('leaderboard.noPersonScored')}
        hint={t('leaderboard.clickRowForPerson')}
        head={
          <>
            <th className="w-12 px-3 py-2 text-left">{t('leaderboard.top')}</th>
            <th className="px-3 py-2 text-left">{t('leaderboard.person')}</th>
            <SortableHead field="kpi" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.kpiPercent')}</SortableHead>
            <SortableHead field="conduct" sortBy={sortBy} dir={dir} onSort={onSort}>{t('leaderboard.coreValues')}</SortableHead>
            {/* Xếp loại suy ra từ KPI nên xếp theo nó cũng chỉ là xếp theo KPI — không cho bấm. */}
            <th className="px-3 py-2 text-right">{t('leaderboard.rating')}</th>
          </>
        }
      >
        {rows.map((r, i) => (
          // Rê chuột lên hàng: thẻ xem nhanh radar + xu hướng + chỉ số, kèm dòng nhắc bấm vào.
          <PersonHoverCard key={r.userId ?? `anon-${i}`} userId={r.userId} scope={scope} cycleId={cycleId}>
          <RankRow
            rank={i + 1}
            // Hàng đã ẩn danh không có id để đi tới — bấm vào cũng không ra ai.
            onClick={r.userId ? () => navigate(`/analytics/person/${r.userId}`) : undefined}
            // KHÔNG đặt `title`: tooltip gốc của trình duyệt sẽ bật đè lên thẻ xem nhanh.
          >
            <td className="px-3 py-2"><RankBadge rank={i + 1} /></td>
            <td className="px-3 py-2">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                {r.fullName ?? '—'}
                {r.isSelf && <span className="ml-1.5 text-[11px] font-semibold text-[var(--color-primary)]">{t('leaderboard.you')}</span>}
              </p>
              {r.orgUnitName && <p className="truncate text-[11px] text-slate-400">{r.orgUnitName}</p>}
            </td>
            <NumCell strong>{pct(r.kpiPercent)}</NumCell>
            <NumCell>{conduct(r.conductScore, r.conductMax ?? data?.conductMax)}</NumCell>
            <td className="px-3 py-2 text-right"><RatingPill name={r.ratingName} color={r.ratingColor} /></td>
          </RankRow>
          </PersonHoverCard>
        ))}
      </RankTableShell>
      {data && data.conductEnabled === false && (
        <p className="text-xs text-slate-400">{t('leaderboard.conductOff')}</p>
      )}
    </div>
  )
}
