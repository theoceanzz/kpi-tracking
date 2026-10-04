import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LayoutGrid, Layers, ListChecks, Send, ExternalLink, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useMyUnitChain } from '@/features/orgunits/hooks/useOrgUnitTree'
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
import { useFixedPerspectives, useScorecards } from '../hooks/useBsc'
import { scorecardStatusMeta } from '../utils/scorecardStatus'
import {
  BscScoringMode, BscScorecardApplyScope, BscScorecardStatus,
  type ScorecardPerspectiveResponse, type ScorecardResponse,
} from '../types'
import { useTranslation } from 'react-i18next'

/** Thẻ đã đóng / lưu trữ không còn chấm điểm (cùng luật với backend `isRetired`). */
const isRetired = (s: ScorecardResponse) =>
  s.status === BscScorecardStatus.CLOSED || s.status === BscScorecardStatus.ARCHIVED

/** Một cấp trong chuỗi đơn vị của tôi → công ty, kèm các bộ tiêu chí thuộc đúng cấp đó. */
interface Level {
  unitId: string
  name: string
  isMine: boolean
  isRoot: boolean
  cards: ScorecardResponse[]
}

/**
 * BSC của tôi — xem theo CẤP thay vì theo đợt.
 *
 * <p>Một bộ tiêu chí có thể gắn nhiều đợt hoặc cả một kỳ, nên lọc theo đợt làm người xem phải đoán
 * đợt nào có bộ nào. Ở đây chọn cấp trước (đơn vị của tôi → các đơn vị cấp trên → công ty), rồi
 * chọn một bộ trong cấp đó. Chỉ thấy đơn vị mình và chuỗi cấp trên trực thuộc — không thấy đơn vị
 * ngang hàng.
 *
 * <p>KPI của tôi chỉ hiện ở cấp có bộ tiêu chí ĐANG CHẤM cho tôi (đơn vị mình, hoặc cấp trên gần
 * nhất khi đơn vị mình chưa có bộ riêng); các cấp khác chỉ để xem hạng mục và trọng số.
 */
export default function MyBscPage() {
  const { t } = useTranslation('bsc')
  const pageTitle = usePageTitle('my-bsc', t('MyBscPage.myBsc'))
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  const organizationId = user?.memberships?.[0]?.organizationId
  const myUnitId = user?.memberships?.[0]?.orgUnitId
  const myUnitName = user?.memberships?.[0]?.orgUnitName
  const canManage = hasPermission('BSC:MANAGE') || hasPermission('BSC:MANAGE_UNIT')

  const { data: scorecards, isLoading: loadingScorecards } = useScorecards(organizationId)
  const { data: fixedPerspectives } = useFixedPerspectives(organizationId)
  const { data: chain, isLoading: loadingChain } = useMyUnitChain(myUnitId)
  const { data: periodsData } = useKpiPeriods({ organizationId })
  const { data: kpiPage, isLoading: loadingKpis } = useMyKpi({ size: 500 })
  const [detailKpi, setDetailKpi] = useState<KpiCriteria | null>(null)
  const now = useMemo(() => new Date(), [])

  // Chuỗi đơn vị của tôi → cha → … → gốc (công ty).
  // Chuỗi lấy từ API riêng chứ không từ cây đơn vị: cây chỉ trả nhánh người dùng được xem, nên
  // nhân viên thường không thấy đơn vị cha của mình và trang chỉ còn mỗi một cấp.
  const levels = useMemo<Level[]>(() => {
    const live = (scorecards ?? []).filter(s => !isRetired(s))
    const out: Level[] = (chain ?? []).map(u => ({
      unitId: u.id,
      name: u.name,
      isMine: u.id === myUnitId,
      isRoot: u.parentId == null,
      cards: live.filter(s => (s.orgUnits ?? []).some(o => o.id === u.id)),
    }))
    // Mỗi cấp chỉ hiện bộ GẮN đúng đơn vị đó — cấp công ty là bộ gắn đơn vị gốc. Bộ không gắn đơn
    // vị nào (kiểu "toàn tổ chức" cũ) không hiện ở cấp nào: trộn chúng vào cấp công ty làm danh sách
    // dài ra toàn bộ không ai nhận là của công ty.
    return out
  }, [chain, scorecards, myUnitId])

  // Chỉ bộ của CHÍNH đơn vị tôi mới dùng để chấm điểm (cùng luật với backend): đơn vị chưa có bộ
  // riêng thì chưa áp dụng BSC, bộ của cấp trên / công ty chỉ để tham khảo.
  const myLevel = levels.find(l => l.isMine)
  const myUnitHasBsc = (myLevel?.cards.length ?? 0) > 0
  const scoringLevelId = myUnitHasBsc ? myLevel!.unitId : ''
  // Mở trang: đứng ở đơn vị tôi nếu có bộ; chưa có thì đứng ở cấp gần nhất có bộ để còn tham khảo.
  const defaultLevelId = scoringLevelId || levels.find(l => l.cards.length > 0)?.unitId || levels[0]?.unitId || ''

  const [levelId, setLevelId] = useState<string>('')
  const effectiveLevelId = levels.some(l => l.unitId === levelId) ? levelId : defaultLevelId
  const level = levels.find(l => l.unitId === effectiveLevelId)

  // Bộ đang áp cho HÔM NAY lên đầu, để mở trang là thấy bộ đang chạy.
  const periodDates = useMemo(() => new Map((periodsData?.content ?? []).map(p => [p.id, p])), [periodsData])
  const appliesToday = (s: ScorecardResponse) => (s.periods ?? []).some(p => {
    const d = periodDates.get(p.id)
    return !!d?.startDate && !!d?.endDate
      && new Date(d.startDate).getTime() <= now.getTime() && now.getTime() <= new Date(d.endDate).getTime()
  })
  const levelCards = [...(level?.cards ?? [])].sort((a, b) => Number(appliesToday(b)) - Number(appliesToday(a)))

  const [cardId, setCardId] = useState<string>('')
  const [search, setSearch] = useState('')
  const scorecard = levelCards.find(s => s.id === cardId) ?? levelCards[0] ?? null
  const showKpis = !!scorecard && !!scoringLevelId && effectiveLevelId === scoringLevelId

  // KPI của tôi thuộc các đợt mà bộ tiêu chí này áp dụng.
  const myKpis = useMemo(() => {
    const periodIds = new Set((scorecard?.periods ?? []).map(p => p.id))
    return (kpiPage?.content ?? []).filter(k => isMyActiveKpi(k, user?.id) && periodIds.has(k.kpiPeriodId))
  }, [kpiPage, user?.id, scorecard])
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
    // Tìm theo tên/mã hạng mục, hoặc tên KPI của tôi đang gắn vào hạng mục đó.
    const q = search.trim().toLowerCase()
    const matches = (p: ScorecardPerspectiveResponse) => !q
      || p.name.toLowerCase().includes(q) || (p.code ?? '').toLowerCase().includes(q)
      || (kpisByPerspective.get(p.perspectiveId) ?? []).some(k => k.name.toLowerCase().includes(q))
    return fixed.map(fp => ({
      fp,
      items: scorecard.perspectives
        .filter(p => p.fixedPerspective === fp.code && matches(p))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    })).filter(g => g.items.length > 0)
  }, [scorecard, fixedPerspectives, search, kpisByPerspective])

  const stats = useMemo(() => {
    const items = scorecard?.perspectives ?? []
    if (!showKpis) return { items: items.length, contributed: 0, linked: 0, toSubmit: 0 }
    const contributed = items.filter(p => (kpisByPerspective.get(p.perspectiveId)?.length ?? 0) > 0).length
    const linked = myKpis.filter(k => k.effectivePerspectiveId ?? k.perspectiveId).length
    let toSubmit = 0
    myKpis.forEach(k => { if (!(k.effectivePerspectiveId ?? k.perspectiveId)) return; const s = kpiWorkState(k, now); if (!s.done && s.started && !s.ended) toSubmit++ })
    return { items: items.length, contributed, linked, toSubmit }
  }, [scorecard, showKpis, kpisByPerspective, myKpis, now])

  /** "Kỳ Q3/2026" hoặc "Tháng 09, Tháng 10 +2 đợt" — bộ tiêu chí gắn kỳ hay gắn đợt. */
  const scopeLabel = (s: ScorecardResponse) => {
    if (s.applyScope === BscScorecardApplyScope.CYCLE && s.kpiCycleName) return t('MyBscPage.cycleLabel', { name: s.kpiCycleName })
    const names = (s.periods ?? []).map(p => p.name)
    if (names.length === 0) return t('MyBscPage.noPeriod')
    return names.length <= 2 ? names.join(', ') : `${names.slice(0, 2).join(', ')} ${t('MyBscPage.morePeriods', { count: names.length - 2 })}`
  }
  const levelLabel = (l: Level) =>
    l.isMine ? t('MyBscPage.levelMine', { name: l.name })
      : l.isRoot ? t('MyBscPage.levelCompany', { name: l.name })
        : t('MyBscPage.levelParent', { name: l.name })

  const status = scorecardStatusMeta(scorecard?.status)
  const loading = loadingScorecards || loadingKpis || loadingChain

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title={pageTitle}
        description={t('MyBscPage.levelDescription', { value: myUnitName ?? t('MyBscPage.yourUnit') })}
        stats={[
          { label: t('MyBscPage.item'), value: stats.items, icon: Layers },
          { label: t('MyBscPage.youContribute'), value: stats.contributed, icon: LayoutGrid },
          { label: t('MyBscPage.bscLinkedKpis'), value: stats.linked, icon: ListChecks },
          { label: t('MyBscPage.toSubmit'), value: stats.toSubmit, icon: Send },
        ]}
      >
        {/* Nút phụ luôn ở hàng dưới, phải: hàng trên chỉ có số liệu để mọi vai trò nhìn cùng một bố cục. */}
        {(hasPermission('BSC:MANAGE') || canManage) && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
            {hasPermission('BSC:MANAGE') && (
              <Button asChild variant="outline">
                <Link to="/analytics?section=bsc"><TrendingUp aria-hidden="true" /> {t('MyBscPage.viewAnalytics')}</Link>
              </Button>
            )}
            {canManage && (
              <Button asChild variant="outline">
                <Link to="/settings/tools?section=bsc"><ExternalLink aria-hidden="true" /> {t('MyBscPage.bscManagement')}</Link>
              </Button>
            )}
          </div>
        )}
      </WorkspaceHeader>

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: t('MyBscPage.searchItems'), className: 'sm:w-96' }}>
        <Select value={effectiveLevelId} onValueChange={v => { setLevelId(v); setCardId('') }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label={t('MyBscPage.level')}>
            <SelectValue placeholder={t('MyBscPage.level')} />
          </SelectTrigger>
          <SelectContent>
            {levels.map(l => (
              <SelectItem key={l.unitId} value={l.unitId}>
                {levelLabel(l)}{l.cards.length === 0 ? ` · ${t('MyBscPage.noScorecardShort')}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {levelCards.length > 0 && (
          <Select value={scorecard?.id ?? ''} onValueChange={setCardId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-72" aria-label={t('MyBscPage.scorecard')}>
              <SelectValue placeholder={t('MyBscPage.scorecard')} />
            </SelectTrigger>
            <SelectContent>
              {levelCards.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name} · {scopeLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FilterBar>

      {/* Đơn vị chưa có bộ riêng: nói thẳng là chưa áp dụng BSC, kẻo nhân viên xem bộ công ty bên
          dưới rồi tưởng mình đang được chấm theo đó. */}
      {!loading && levels.length > 0 && !myUnitHasBsc && (
        <div className="rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
          <b>{t('MyBscPage.notAppliedTitle')}</b> {t('MyBscPage.notAppliedHint', { name: myLevel?.name ?? '' })}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : !scorecard ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={LayoutGrid}
            title={t('MyBscPage.noScorecardAtLevel', { name: level?.name ?? '' })}
            description={t('MyBscPage.noScorecardAtLevelHint')}
            action={canManage ? <Button asChild><Link to="/settings/tools?section=bsc">{t('MyBscPage.buildAScorecard')}</Link></Button> : undefined}
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
                ? <Badge>{t('MyBscPage.officialScoring')}</Badge>
                : <Badge variant="secondary">{t('MyBscPage.parallel')}</Badge>}
              {showKpis
                ? <Badge variant="success">{t('MyBscPage.appliesToYou')}</Badge>
                : <Badge variant="outline" title={t('MyBscPage.referenceOnlyHint')}>{t('MyBscPage.referenceOnly')}</Badge>}
              <span className="ml-auto text-caption">
                {scopeLabel(scorecard)}{' · '}{t('MyBscPage.totalWeight')} {scorecard.totalWeight}%
              </span>
            </div>
            {scorecard.vision && <p className="mt-1 text-sm italic text-[var(--color-muted-foreground)]">“{scorecard.vision}”</p>}
          </section>

          {groups.length === 0 && search.trim() && (
            <p className="rounded-card border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-caption">
              {t('MyBscPage.noItemMatches')}
            </p>
          )}
          {groups.map(({ fp, items }) => (
            <section key={fp.code} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: fp.color }} aria-hidden="true" />
                <h4 className="text-label">{fp.name}</h4>
                <span className="text-caption">{items.length} {t('MyBscPage.items')} {items.reduce((a, p) => a + (p.weightPercentage || 0), 0)}%</span>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {items.map(item => (
                  <ItemBlock key={item.id} item={item} showKpis={showKpis}
                    kpis={kpisByPerspective.get(item.perspectiveId) ?? []} onOpenKpi={setDetailKpi} now={now} />
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

function ItemBlock({ item, kpis, showKpis, onOpenKpi, now }: {
  item: ScorecardPerspectiveResponse
  kpis: KpiCriteria[]
  /** false = bộ của cấp trên, chỉ xem hạng mục và trọng số. */
  showKpis: boolean
  onOpenKpi: (k: KpiCriteria) => void
  now: Date
}) {
  const { t } = useTranslation('bsc')
  const target = item.targetValue != null
    ? t('MyBscPage.target', { targetValue: item.targetValue, value: item.unit ? ` ${item.unit}` : '', value2: item.minimumValue != null ? t('MyBscPage.minimum', { minimumValue: item.minimumValue }) : '' })
    : null
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {!item.sourceScorecardId && <span className="mr-1.5 font-mono text-caption">{item.code}</span>}{item.name}
          </p>
          <p className="text-caption">
            {[target, item.isGate ? t('MyBscPage.gateItems') : null, item.origin === 'ASSIGNED' ? t('MyBscPage.assignedByParent') : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-[var(--color-foreground)]">{item.weightPercentage}%</span>
      </div>
      {showKpis && !item.sourceScorecardId && (kpis.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40">
          {kpis.map(k => <MyKpiMiniRow key={k.id} kpi={k} onOpen={onOpenKpi} now={now} />)}
        </div>
      ) : (
        <p className="mt-1.5 text-caption">{t('MyBscPage.youHaveNoKpiLinkedTo')}</p>
      ))}
    </div>
  )
}
