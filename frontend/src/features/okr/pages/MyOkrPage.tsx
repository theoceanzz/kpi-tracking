import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronRight, Target, TrendingUp, ListChecks, Send, ExternalLink } from 'lucide-react'
import { cn, formatNumber } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useMyUnitChain, useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import type { OrgUnitTreeResponse } from '@/types/orgUnit'
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
import { OkrStatus, type KeyResultResponse, type ObjectiveResponse } from '../types'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const STATUS_LABEL = perLanguage((): Record<OkrStatus, { label: string; variant: 'success' | 'secondary' | 'destructive' }> => ({
  [OkrStatus.ACTIVE]: { label: i18n.t('okr:MyOkrPage.running'), variant: 'success' },
  [OkrStatus.COMPLETED]: { label: i18n.t('okr:MyOkrPage.completed'), variant: 'secondary' },
  [OkrStatus.CANCELLED]: { label: i18n.t('okr:MyOkrPage.cancelled'), variant: 'destructive' },
}))

/** Lựa chọn "mục tiêu tôi đang góp KPI" — đứng đầu ô Cấp, không phải một đơn vị. */
const MINE = '__mine__'

/** Một cấp trong chuỗi đơn vị của tôi → công ty. */
interface Level {
  unitId: string
  name: string
  isMine: boolean
  isRoot: boolean
  /** Đơn vị mà mục tiêu phải gắn vào để thuộc cấp này. */
  unitIds: Set<string>
}

/**
 * OKR của tôi: mục tiêu → kết quả then chốt → KPI của TÔI đang góp vào đó, kèm việc phải làm
 * (nộp bài). Trang "Mục tiêu của tôi" bên Phân tích là biểu đồ để xem; trang này là danh sách
 * để làm — cùng cách đọc trạng thái với KPI của tôi.
 *
 * <p>Lọc theo CẤP giống BSC của tôi: mục tiêu tôi đang góp, đơn vị của tôi, các đơn vị cấp trên
 * trực thuộc, công ty. Không thấy mục tiêu của đơn vị ngang hàng.
 */
export default function MyOkrPage() {
  const { t } = useTranslation('okr')
  const pageTitle = usePageTitle('my-okr', t('MyOkrPage.myOkrs'))
  const { user } = useAuthStore()
  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: tree } = useOrgUnitTree()
  const myUnitId = user?.memberships?.[0]?.orgUnitId
  // "Đơn vị tôi" = đơn vị mình thuộc về VÀ mọi đơn vị con — trưởng phòng thấy cả mục tiêu của
  // các nhóm bên dưới, không chỉ mục tiêu gắn đúng phòng.
  const myUnitIds = useMemo(() => {
    const roots = new Set((user?.memberships ?? []).map(m => m.orgUnitId))
    const out = new Set<string>(roots)
    const walk = (nodes: OrgUnitTreeResponse[], inside: boolean) =>
      nodes.forEach(n => { const hit = inside || roots.has(n.id); if (hit) out.add(n.id); walk(n.children ?? [], hit) })
    walk(tree ?? [], false)
    return out
  }, [user, tree])

  // Chuỗi đơn vị của tôi → cha → … → gốc (công ty). Lấy từ API riêng: cây đơn vị chỉ trả nhánh
  // người dùng được xem, nên nhân viên thường không thấy đơn vị cha của mình qua đó.
  const { data: chain } = useMyUnitChain(myUnitId)
  const levels = useMemo<Level[]>(() => (chain ?? []).map(u => ({
    unitId: u.id,
    name: u.name,
    isMine: u.id === myUnitId,
    isRoot: u.parentId == null,
    unitIds: u.id === myUnitId ? myUnitIds : new Set([u.id]),
  })), [chain, myUnitId, myUnitIds])

  const { data: objectives, isLoading: loadingObjectives } = useObjectives(organizationId)
  const { hasPermission } = usePermission()
  const { data: kpiPage, isLoading: loadingKpis } = useMyKpi({ size: 500 })

  // Chưa có KPI nào gắn OKR thì mở sẵn cấp đơn vị mình để trang không trống; có rồi thì việc của
  // mình đứng trước.
  const [scope, setScope] = useState<string | null>(null)
  useEffect(() => {
    if (scope !== null || !kpiPage || levels.length === 0) return
    const hasLinked = (kpiPage.content ?? []).some(k => isMyActiveKpi(k, user?.id) && (k.keyResultId || k.objectiveId))
    setScope(hasLinked ? MINE : (levels[0]?.unitId ?? MINE))
  }, [kpiPage, scope, user?.id, levels])
  const effectiveScope: string = scope ?? MINE
  const level = levels.find(l => l.unitId === effectiveScope)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [detailKpi, setDetailKpi] = useState<KpiCriteria | null>(null)

  const now = useMemo(() => new Date(), [])
  const myKpis = useMemo(
    () => (kpiPage?.content ?? []).filter(k => isMyActiveKpi(k, user?.id)),
    [kpiPage, user?.id],
  )
  const kpisByKr = useMemo(() => {
    const m = new Map<string, KpiCriteria[]>()
    myKpis.forEach(k => { if (k.keyResultId) m.set(k.keyResultId, [...(m.get(k.keyResultId) ?? []), k]) })
    return m
  }, [myKpis])
  const kpisByObjectiveOnly = useMemo(() => {
    const m = new Map<string, KpiCriteria[]>()
    myKpis.forEach(k => { if (k.objectiveId && !k.keyResultId) m.set(k.objectiveId, [...(m.get(k.objectiveId) ?? []), k]) })
    return m
  }, [myKpis])

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (objectives ?? []).filter(o => {
      const mine = o.keyResults.some(kr => kpisByKr.has(kr.id)) || kpisByObjectiveOnly.has(o.id)
      if (effectiveScope === MINE) {
        if (!mine) return false
      } else {
        if (!level) return false
        const units = o.orgUnitIds ?? []
        // Mục tiêu không gắn đơn vị nào là mục tiêu toàn tổ chức — thuộc cấp công ty.
        const atLevel = units.some(id => level.unitIds.has(id)) || (level.isRoot && units.length === 0)
        if (!atLevel) return false
      }
      if (!q) return true
      return o.name.toLowerCase().includes(q) || (o.code ?? '').toLowerCase().includes(q)
        || o.keyResults.some(kr => kr.name.toLowerCase().includes(q))
    })
  }, [objectives, effectiveScope, level, search, kpisByKr, kpisByObjectiveOnly])

  const stats = useMemo(() => {
    const linked = myKpis.filter(k => k.keyResultId || k.objectiveId)
    let toSubmit = 0
    linked.forEach(k => { const s = kpiWorkState(k, now); if (!s.done && s.started && !s.ended) toSubmit++ })
    const krCount = rows.reduce((a, o) => a + o.keyResults.length, 0)
    return { objectives: rows.length, krs: krCount, linked: linked.length, toSubmit }
  }, [rows, myKpis, now])

  const toggle = (id: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const loading = loadingObjectives || loadingKpis || (scope === null && levels.length > 0)
  const levelLabel = (l: Level) =>
    l.isMine ? t('MyOkrPage.levelMine', { name: l.name })
      : l.isRoot ? t('MyOkrPage.levelCompany', { name: l.name })
        : t('MyOkrPage.levelParent', { name: l.name })

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        title={pageTitle}
        description={t('MyOkrPage.objectivesAndKeyResultsYourKpis')}
        stats={[
          { label: t('MyOkrPage.target'), value: stats.objectives, icon: Target },
          { label: t('MyOkrPage.keyResult'), value: stats.krs, icon: TrendingUp },
          { label: t('MyOkrPage.okrLinkedKpis'), value: stats.linked, icon: ListChecks },
          { label: t('MyOkrPage.toSubmit'), value: stats.toSubmit, icon: Send },
        ]}
      >
        {/* Nút phụ luôn ở hàng dưới, phải — cùng bố cục với BSC của tôi ở mọi vai trò. */}
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <Button asChild variant="outline">
            <Link to="/analytics?section=my-objectives"><TrendingUp aria-hidden="true" /> {t('MyOkrPage.viewAnalytics')}</Link>
          </Button>
          {hasPermission('OKR:MANAGE') && (
            <Button asChild variant="outline">
              <Link to="/settings/tools?section=okr"><ExternalLink aria-hidden="true" /> {t('MyOkrPage.okrManagement')}</Link>
            </Button>
          )}
        </div>
      </WorkspaceHeader>

      <FilterBar search={{ value: search, onChange: setSearch, placeholder: t('MyOkrPage.searchObjectivesKeyResults'), className: 'sm:w-96' }}>
        <Select value={effectiveScope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label={t('MyOkrPage.level')}>
            <SelectValue placeholder={t('MyOkrPage.level')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MINE}>{t('MyOkrPage.iParticipate')}</SelectItem>
            {levels.map(l => <SelectItem key={l.unitId} value={l.unitId}>{levelLabel(l)}</SelectItem>)}
          </SelectContent>
        </Select>
      </FilterBar>

      {loading ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={Target}
            title={effectiveScope === MINE ? t('MyOkrPage.youHaveNoKpisLinkedTo') : t('MyOkrPage.noMatchingObjectives')}
            description={effectiveScope === MINE
              ? t('MyOkrPage.whenYourKpisAreLinkedTo')
              : t('MyOkrPage.tryAnotherLevel')}
            action={effectiveScope === MINE && levels[0]
              ? <Button variant="outline" onClick={() => setScope(levels[0]!.unitId)}>{t('MyOkrPage.viewMyUnitsObjectives')}</Button>
              : undefined}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(o => (
            <ObjectiveCard
              key={o.id}
              objective={o}
              open={!collapsed.has(o.id)}
              onToggle={() => toggle(o.id)}
              kpisByKr={kpisByKr}
              directKpis={kpisByObjectiveOnly.get(o.id) ?? []}
              isMyUnit={(o.orgUnitIds ?? []).some(id => myUnitIds.has(id))}
              onOpenKpi={setDetailKpi}
              now={now}
            />
          ))}
        </div>
      )}

      <KpiDetailModal open={!!detailKpi} onClose={() => setDetailKpi(null)} kpi={detailKpi} />
    </div>
  )
}

function ObjectiveCard({ objective: o, open, onToggle, kpisByKr, directKpis, isMyUnit, onOpenKpi, now }: {
  objective: ObjectiveResponse
  open: boolean
  onToggle: () => void
  kpisByKr: Map<string, KpiCriteria[]>
  directKpis: KpiCriteria[]
  isMyUnit: boolean
  onOpenKpi: (k: KpiCriteria) => void
  now: Date
}) {
  const { t } = useTranslation('okr')
  const progress = o.keyResults.length
    ? Math.round(o.keyResults.reduce((a, kr) => a + Math.min(100, kr.progress || 0), 0) / o.keyResults.length)
    : 0
  const myCount = o.keyResults.reduce((a, kr) => a + (kpisByKr.get(kr.id)?.length ?? 0), 0) + directKpis.length
  const st = STATUS_LABEL()[o.status] ?? STATUS_LABEL()[OkrStatus.ACTIVE]

  return (
    <section className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      <div className="flex items-start gap-3 px-4 py-3">
        <Button variant="ghost" size="icon-sm" className="mt-0.5 shrink-0" onClick={onToggle} aria-expanded={open} aria-label={open ? t('MyOkrPage.collapse') : t('MyOkrPage.expand')}>
          {open ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {o.code && <span className="font-mono text-caption">{o.code}</span>}
            <h3 className="text-sm font-semibold text-[var(--color-foreground)]">{o.name}</h3>
            <Badge variant={st.variant}>{st.label}</Badge>
            {myCount > 0 && <Badge>{t('MyOkrPage.youContribute')} {myCount} KPI</Badge>}
            {isMyUnit && myCount === 0 && <Badge variant="outline">{t('MyOkrPage.myUnit')}</Badge>}
          </div>
          <p className="mt-0.5 text-caption">
            {[o.orgUnitNames?.join(', '), o.startDate && o.endDate ? `${o.startDate} → ${o.endDate}` : null, o.perspectiveName ? t('MyOkrPage.area', { perspectiveName: o.perspectiveName }) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex w-40 shrink-0 items-center gap-2" title={t('MyOkrPage.averageProgressOfKeyResults')}>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums text-[var(--color-foreground)]">{progress}%</span>
        </div>
      </div>

      {open && (
        <div className="divide-y divide-[var(--color-border)] border-t border-[var(--color-border)]">
          {o.keyResults.map(kr => (
            <KeyResultBlock key={kr.id} kr={kr} kpis={kpisByKr.get(kr.id) ?? []} onOpenKpi={onOpenKpi} now={now} />
          ))}
          {directKpis.length > 0 && (
            <div className="px-4 py-2">
              <p className="mb-1 text-label">{t('MyOkrPage.kpisLinkedDirectlyToTheObjective')}</p>
              <div className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
                {directKpis.map(k => <MyKpiMiniRow key={k.id} kpi={k} onOpen={onOpenKpi} now={now} />)}
              </div>
            </div>
          )}
          {o.keyResults.length === 0 && directKpis.length === 0 && (
            <p className="px-4 py-3 text-caption">{t('MyOkrPage.thisObjectiveHasNoKeyResults')}</p>
          )}
        </div>
      )}
    </section>
  )
}

function KeyResultBlock({ kr, kpis, onOpenKpi, now }: {
  kr: KeyResultResponse
  kpis: KpiCriteria[]
  onOpenKpi: (k: KpiCriteria) => void
  now: Date
}) {
  const { t } = useTranslation('okr')
  const pct = Math.min(100, Math.round(kr.progress || 0))
  return (
    <div className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1 basis-64">
          <p className="text-sm font-medium text-[var(--color-foreground)]">
            {kr.code && <span className="mr-1.5 font-mono text-caption">{kr.code}</span>}{kr.name}
          </p>
          <p className="text-caption">
            {formatNumber(kr.currentValue)} / {formatNumber(kr.targetValue)}{kr.unit ? ` ${kr.unit}` : ''}
            {kr.unitWeights?.length ? ` · ${kr.unitWeights.map(w => `${w.orgUnitName ?? t('MyOkrPage.unit')} ${w.weightPercentage}%`).join(', ')}` : ''}
          </p>
        </div>
        <div className="flex w-40 shrink-0 items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-muted)]">
            <div className={cn('h-full rounded-full', pct >= 100 ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-primary)]')} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm font-medium tabular-nums text-[var(--color-foreground)]">{pct}%</span>
        </div>
      </div>
      {kpis.length > 0 ? (
        <div className="mt-2 divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)] bg-[var(--color-muted)]/40">
          {kpis.map(k => <MyKpiMiniRow key={k.id} kpi={k} onOpen={onOpenKpi} now={now} />)}
        </div>
      ) : (
        <p className="mt-1.5 text-caption">{t('MyOkrPage.youHaveNoKpisLinkedTo2')}</p>
      )}
    </div>
  )
}
