import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Layers, ListChecks, Send, ExternalLink, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { isMyActiveKpi, kpiWorkState } from '@/features/kpi/utils/myKpiStatus'
import MyKpiMiniRow from '@/features/kpi/components/MyKpiMiniRow'
import KpiDetailModal from '@/features/kpi/components/KpiDetailModal'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { KpiCriteria } from '@/types/kpi'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
import { useFixedPerspectives, useScorecards } from '../hooks/useBsc'
import { useLinkedWeight } from '../hooks/useBscCascade'
import { scorecardsForPeriod } from '../utils/scorecardScope'
import { scorecardStatusMeta } from '../utils/scorecardStatus'
import { BscScoringMode, type ScorecardPerspectiveResponse, type ScorecardResponse } from '../types'

/** Đợt đang chứa hôm nay; không có thì đợt gần nhất đã qua; không có nữa thì đợt đầu danh sách. */
function pickDefaultPeriod(periods: { id: string; startDate: string | null; endDate: string | null }[]): string {
  const now = Date.now()
  const cur = periods.find(p => p.startDate && p.endDate && new Date(p.startDate).getTime() <= now && now <= new Date(p.endDate).getTime())
  if (cur) return cur.id
  const past = [...periods].filter(p => p.endDate && new Date(p.endDate).getTime() < now)
    .sort((a, b) => new Date(b.endDate!).getTime() - new Date(a.endDate!).getTime())[0]
  return past?.id ?? periods[0]?.id ?? ''
}

/**
 * BSC của tôi: bộ tiêu chí đang áp cho đơn vị của tôi trong đợt, từng hạng mục kèm KPI của
 * TÔI đang góp vào và việc phải làm. Đơn vị chưa có bộ tiêu chí riêng thì kế thừa của cấp trên
 * — cùng cách tra như trang KPI của tôi tính trọng số thật.
 */
export default function MyBscPage() {
  const pageTitle = usePageTitle('my-bsc', 'BSC của tôi')
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const organizationId = user?.memberships?.[0]?.organizationId
  const myUnitId = user?.memberships?.[0]?.orgUnitId
  const myUnitName = user?.memberships?.[0]?.orgUnitName
  const canManage = hasPermission('BSC:MANAGE') || hasPermission('BSC:MANAGE_UNIT')

  const { data: periodsData } = useKpiPeriods({ organizationId })
  const periods = useMemo(() => periodsData?.content ?? [], [periodsData])
  const [periodId, setPeriodId] = useState('')
  useEffect(() => { if (!periodId && periods.length) setPeriodId(pickDefaultPeriod(periods)) }, [periods, periodId])

  const { data: scorecards, isLoading: loadingScorecards } = useScorecards(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives(organizationId)
  const { data: tree } = useOrgUnitTree()
  const { data: kpiPage, isLoading: loadingKpis } = useMyKpi({ size: 500, kpiPeriodId: periodId || undefined })
  const { data: linkedWeight } = useLinkedWeight(user?.id, periodId || undefined, organizationId)
  const [detailKpi, setDetailKpi] = useState<KpiCriteria | null>(null)
  const now = useMemo(() => new Date(), [])

  const parentMap = useMemo(() => {
    const m = new Map<string, string | null>()
    const walk = (nodes: OrgUnitTreeResponse[], parent: string | null) =>
      nodes.forEach(n => { m.set(n.id, parent); walk(n.children ?? [], n.id) })
    walk(tree ?? [], null)
    return m
  }, [tree])

  // Bộ tiêu chí áp cho đơn vị tôi trong đợt: của chính đơn vị, không có thì leo lên cha, cuối
  // cùng là bộ toàn tổ chức (không gắn đơn vị).
  const scorecard = useMemo<ScorecardResponse | null>(() => {
    const inPeriod = scorecardsForPeriod(scorecards, periodId)
    if (!inPeriod.length) return null
    let cur: string | null | undefined = myUnitId, guard = 0
    while (cur && guard++ < 100) {
      const found = inPeriod.find(s => (s.orgUnits ?? []).some(u => u.id === cur))
      if (found) return found
      cur = parentMap.get(cur) ?? null
    }
    return inPeriod.find(s => !s.orgUnits || s.orgUnits.length === 0) ?? null
  }, [scorecards, periodId, myUnitId, parentMap])

  const myKpis = useMemo(() => (kpiPage?.content ?? []).filter(k => isMyActiveKpi(k, user?.id)), [kpiPage, user?.id])
  const kpisByPerspective = useMemo(() => {
    const m = new Map<string, KpiCriteria[]>()
    myKpis.forEach(k => {
      const pid = k.effectivePerspectiveId ?? k.perspectiveId
      if (pid) m.set(pid, [...(m.get(pid) ?? []), k])
    })
    return m
  }, [myKpis])

  const groups = useMemo(() => {
    if (!scorecard) return []
    const fixed = [...(fixedPerspectives ?? [])].sort((a, b) => a.displayOrder - b.displayOrder)
    return fixed.map(fp => ({
      fp,
      items: scorecard.perspectives
        .filter(p => p.fixedPerspective === fp.code)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    })).filter(g => g.items.length > 0)
  }, [scorecard, fixedPerspectives])

  const stats = useMemo(() => {
    const items = scorecard?.perspectives ?? []
    const contributed = items.filter(p => (kpisByPerspective.get(p.perspectiveId)?.length ?? 0) > 0).length
    const linked = myKpis.filter(k => k.effectivePerspectiveId ?? k.perspectiveId).length
    let toSubmit = 0
    myKpis.forEach(k => { if (!(k.effectivePerspectiveId ?? k.perspectiveId)) return; const s = kpiWorkState(k, now); if (!s.done && s.started && !s.ended) toSubmit++ })
    return { items: items.length, contributed, linked, toSubmit }
  }, [scorecard, kpisByPerspective, myKpis, now])

  const status = scorecardStatusMeta(scorecard?.status)
  const loading = loadingScorecards || loadingKpis || !periodId

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title={pageTitle}
        description={`Bộ tiêu chí đang áp cho ${myUnitName ?? 'đơn vị của bạn'} trong đợt, từng hạng mục và KPI của bạn góp vào đó.`}
        stats={[
          { label: 'Hạng mục', value: stats.items, icon: Layers },
          { label: 'Bạn góp', value: stats.contributed, icon: LayoutGrid },
          { label: 'KPI gắn BSC', value: stats.linked, icon: ListChecks },
          { label: 'Cần nộp', value: stats.toSubmit, icon: Send },
        ]}
      >
        {/* Nút phụ luôn ở hàng dưới, phải: hàng trên chỉ có số liệu để mọi vai trò nhìn cùng một bố cục. */}
        {(hasPermission('BSC:MANAGE') || canManage) && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {hasPermission('BSC:MANAGE') && (
              <Button asChild variant="outline">
                <Link to="/analytics?section=bsc"><TrendingUp aria-hidden="true" /> Xem phân tích</Link>
              </Button>
            )}
            {canManage && (
              <Button asChild variant="outline">
                <Link to="/settings/tools?section=bsc"><ExternalLink aria-hidden="true" /> Quản lý BSC</Link>
              </Button>
            )}
          </div>
        )}
      </WorkspaceHeader>

      <FilterBar>
        <Select value={periodId} onValueChange={setPeriodId}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-52" aria-label="Đợt"><SelectValue placeholder="Chọn đợt" /></SelectTrigger>
          <SelectContent>
            {periods.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {linkedWeight && (
          <span className={cn(
            'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-xs font-medium',
            linkedWeight.satisfied
              ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
              : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
          )}>
            {!linkedWeight.satisfied && <AlertTriangle size={13} aria-hidden="true" />}
            {Math.round(linkedWeight.linkedPercent)}% trọng số KPI của bạn đã gắn BSC
            {!linkedWeight.satisfied && ` · cần tối thiểu ${linkedWeight.minRequired}%`}
          </span>
        )}
      </FilterBar>

      {loading ? (
        <LoadingSkeleton />
      ) : !scorecard ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={LayoutGrid}
            title="Đợt này chưa có bộ tiêu chí cho đơn vị bạn"
            description="Bộ tiêu chí BSC do tổ chức hoặc trưởng đơn vị dựng theo từng đợt. Chưa có thì KPI của bạn vẫn chấm bình thường, chỉ chưa quy về điểm BSC."
            action={canManage ? <Button asChild><Link to="/settings/tools?section=bsc">Dựng bộ tiêu chí</Link></Button> : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Thẻ bộ tiêu chí */}
          <section className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{scorecard.name}</h3>
              <span className={cn('inline-flex items-center rounded-control px-2 py-0.5 text-xs font-medium', status.badgeClass)}>{status.label}</span>
              {scorecard.scoringMode === BscScoringMode.OFFICIAL
                ? <Badge>Chấm chính thức</Badge>
                : <Badge variant="secondary">Chạy song song</Badge>}
              <span className="ml-auto text-caption">
                {scorecard.orgUnitName || 'Toàn tổ chức'}
                {scorecard.orgUnitName && !(scorecard.orgUnits ?? []).some(u => u.id === myUnitId) && ' · kế thừa từ cấp trên'}
                {' · '}tổng trọng số {scorecard.totalWeight}%
              </span>
            </div>
            {scorecard.vision && <p className="mt-1 text-sm italic text-[var(--color-muted-foreground)]">“{scorecard.vision}”</p>}
          </section>

          {groups.map(({ fp, items }) => (
            <section key={fp.code} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: fp.color }} aria-hidden="true" />
                <h4 className="text-label">{fp.name}</h4>
                <span className="text-caption">{items.length} hạng mục · {items.reduce((a, p) => a + (p.weightPercentage || 0), 0)}%</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {items.map(item => (
                  <ItemBlock key={item.id} item={item} kpis={kpisByPerspective.get(item.perspectiveId) ?? []} onOpenKpi={setDetailKpi} now={now} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <KpiDetailModal open={!!detailKpi} onClose={() => setDetailKpi(null)} kpi={detailKpi} />
    </div>
  )
}

function ItemBlock({ item, kpis, onOpenKpi, now }: {
  item: ScorecardPerspectiveResponse
  kpis: KpiCriteria[]
  onOpenKpi: (k: KpiCriteria) => void
  now: Date
}) {
  const target = item.targetValue != null
    ? `Mục tiêu ${item.targetValue}${item.unit ? ` ${item.unit}` : ''}${item.minimumValue != null ? ` · tối thiểu ${item.minimumValue}` : ''}`
    : null
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            <span className="mr-1.5 font-mono text-caption">{item.code}</span>{item.name}
          </p>
          <p className="text-caption">
            {[target, item.isGate ? 'Hạng mục chặn' : null, item.origin === 'ASSIGNED' ? 'Cấp trên giao' : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-foreground)]">{item.weightPercentage}%</span>
      </div>
      {kpis.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40">
          {kpis.map(k => <MyKpiMiniRow key={k.id} kpi={k} onOpen={onOpenKpi} now={now} />)}
        </div>
      ) : (
        <p className="mt-1.5 text-caption">Bạn chưa có KPI gắn vào hạng mục này.</p>
      )}
    </div>
  )
}
