import { useState, useMemo } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
import FilterBar, { SegmentedControl } from '@/components/common/FilterBar'
import Pagination from '@/components/common/Pagination'
import StatusBadge from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import KpiTagChips from '../components/KpiTagChips'
import { useMyKpi } from '../hooks/useMyKpi'
import { Link } from 'react-router-dom'
import { cn, formatNumber } from '@/lib/utils'
import { parseISO, isAfter } from 'date-fns'
import {
  ChevronDown, CornerDownRight, Settings2, GitBranch, CheckCircle2, Star, List, LayoutGrid,
  Inbox, ListChecks, Clock, AlertCircle, Send,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useKpiPeriods } from '../hooks/useKpiPeriods'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useObjectives } from '@/features/okr/hooks/useOkr'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useSearchParams } from 'react-router-dom'
import { WORKFLOW_PARAMS } from '../workflow/hooks/useWorkflowNavigator'
import KpiDetailModal from '../components/KpiDetailModal'
import KpiAdjustmentModal from '../components/KpiAdjustmentModal'
import KpiDelegationModal from '../components/KpiDelegationModal'
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import type { KpiCriteria } from '@/types/kpi'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ObjectiveResponse } from '@/features/okr/types'
import { buildKpiRows } from '../utils/kpiTree'
import { useScorecards } from '@/features/bsc/hooks/useBsc'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { scorecardsForPeriod } from '@/features/bsc/utils/scorecardScope'

/* eslint-disable @typescript-eslint/no-explicit-any */

const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—')

export default function MyKpiPage() {
  const user = useAuthStore(s => s.user)

  const [search, setSearch] = useState('')
  // Quay về đây sau khi nộp một báo cáo thì giữ nguyên đợt đang làm dở, không nhảy về 'ALL'.
  const [searchParams] = useSearchParams()
  const [selectedPeriodId, setSelectedPeriodId] = useState(searchParams.get(WORKFLOW_PARAMS.period) ?? 'ALL')
  const [viewMode, setViewMode] = useState<'TABLE' | 'CARD'>(() => window.matchMedia('(max-width: 767px)').matches ? 'CARD' : 'TABLE')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const [sortBy] = useState('createdAt')
  const [sortDir] = useState<'asc' | 'desc'>('desc')
  const [viewKpi, setViewKpi] = useState<KpiCriteria | null>(null)
  const [adjustKpi, setAdjustKpi] = useState<KpiCriteria | null>(null)
  const [editKpi, setEditKpi] = useState<KpiCriteria | null>(null)
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>('ALL')
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string>('ALL')
  const [collapsedParents, setCollapsedParents] = useState<Set<string>>(new Set())
  // Form tự đánh giá mở NGAY TẠI ĐÂY chứ không điều hướng sang mục "Đánh giá của tôi":
  // mục đó gác bằng EVALUATION:VIEW_MY mà trưởng đơn vị không có, đi sang là rơi về
  // lưới thẻ của trang Của tôi và form không bao giờ mở.
  const [selfEvalPeriodId, setSelfEvalPeriodId] = useState<string | null>(null)

  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const organizationId = user?.memberships?.[0]?.organizationId
  const pageTitle = usePageTitle('my-kpi', 'KPI của tôi')
  const { data: org } = useOrganization(organizationId)
  const enableWaterfall = org?.enableWaterfall
  const enableOkr = org?.enableOkr
  
  const { data, isLoading } = useMyKpi({
    page,
    size: pageSize,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    sortBy,
    sortDir,
    objectiveId: selectedObjectiveId === 'ALL' ? undefined : selectedObjectiveId,
    keyResultId: selectedKeyResultId === 'ALL' ? undefined : selectedKeyResultId
  })

  const { data: objectivesData } = useObjectives(user?.memberships?.[0]?.organizationId)
  
  const selectedObjective = objectivesData?.find((o: ObjectiveResponse) => o.id === selectedObjectiveId)
  const keyResults = selectedObjective?.keyResults || []
  
  const { data: myEvals } = useEvaluations({
    userId: user?.id,
    size: 100
  })


  const allKpis = (data?.content ?? []).filter(k => 
    (k.status === 'APPROVED' || k.status === 'EDITED') &&
    k.assigneeIds?.includes(user?.id || '')
  )
  const filteredKpis = allKpis.filter(k =>
    k.name.toLowerCase().includes(search.toLowerCase())
  )

  // Trọng số THẬT mỗi KPI = form × %hạng_mục (từ bộ tiêu chí của đơn vị KPI) — như trang Quản lý KPI.
  const enableBsc = org?.enableBsc
  const { data: bscScorecards } = useScorecards(enableBsc ? organizationId : undefined)
  const { data: orgUnitTreeData } = useOrgUnitTree()
  const unitParentMap = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (nodes: any[]) => (nodes || []).forEach((n: any) => { map.set(n.id, n.parentId ?? null); if (n.children) walk(n.children) })
    walk(orgUnitTreeData || [])
    return map
  }, [orgUnitTreeData])
  const realWeightById = useMemo(() => {
    const map = new Map<string, number>()
    if (!enableBsc || !bscScorecards) return map
    const resolveSc = (unitId: string, periodScs: any[]) => {
      let cur: string | null = unitId, guard = 0
      while (cur && guard++ < 100) {
        const found = periodScs.find(s => (s.orgUnits || []).some((u: any) => u.id === cur))
        if (found) return found
        cur = unitParentMap.get(cur) ?? null
      }
      return periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null
    }
    for (const kpi of allKpis) {
      if (kpi.weight == null || !kpi.effectivePerspectiveId || !kpi.kpiPeriodId) continue
      const periodScs = scorecardsForPeriod(bscScorecards, kpi.kpiPeriodId)
      if (periodScs.length === 0) continue
      const unitId = kpi.orgUnitId || kpi.orgUnitIds?.[0]
      const sc = unitId ? resolveSc(unitId, periodScs) : (periodScs.find(s => !s.orgUnits || s.orgUnits.length === 0) || null)
      if (!sc) continue
      const sp = sc.perspectives.find((p: any) => p.perspectiveId === kpi.effectivePerspectiveId)
      if (!sp || sp.weightPercentage == null) continue
      map.set(kpi.id, kpi.weight * sp.weightPercentage / 100)
    }
    return map
  }, [enableBsc, bscScorecards, allKpis, unitParentMap])

  // Group KPIs by period
  const kpisByPeriod = filteredKpis.reduce((acc: Record<string, any[]>, kpi) => {
    const periodId = kpi.kpiPeriodId || 'UNKNOWN'
    if (!acc[periodId]) acc[periodId] = []
    acc[periodId].push(kpi)
    return acc
  }, {})

  const periodIds = Object.keys(kpisByPeriod).sort((a, b) => {
    const periodA = periodsData?.content.find(p => p.id === a)
    const periodB = periodsData?.content.find(p => p.id === b)
    if (!periodA || !periodB) return 0
    return new Date(periodB.startDate || 0).getTime() - new Date(periodA.startDate || 0).getTime()
  })
  const isUserLeader = useMemo(() => {
    return user?.memberships?.some(m => m.roleRank === 0)
  }, [user])

  const toggleParentCollapse = (parentId: string) => {
    setCollapsedParents(prev => {
      const next = new Set(prev)
      if (next.has(parentId)) next.delete(parentId)
      else next.add(parentId)
      return next
    })
  }


  /* ── Số liệu đầu trang: chỉ những con số đổi hành vi (còn gì phải nộp, gì đã quá hạn) ── */
  const now = new Date()
  const headerStats = useMemo(() => {
    let toSubmit = 0, overdue = 0
    for (const k of allKpis) {
      const done = (k.submissionCount || 0) >= (k.expectedSubmissions || 1)
      const ended = !!k.kpiPeriod?.endDate && isAfter(now, parseISO(k.kpiPeriod.endDate))
      if (!done && !ended) toSubmit++
      const next = getNextDeadline(k)
      if (!done && next && isAfter(now, next)) overdue++
    }
    return { total: allKpis.length, toSubmit, overdue }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allKpis])

  const rowActions = (kpi: KpiCriteria, childKpis: KpiCriteria[]) => {
    const isStarted = !kpi.kpiPeriod?.startDate || !isAfter(parseISO(kpi.kpiPeriod.startDate), now)
    const isPeriodEnded = !!kpi.kpiPeriod?.endDate && isAfter(now, parseISO(kpi.kpiPeriod.endDate))
    const isDelegated = !!kpi.hasChildren
    const isDecompositionParent = childKpis.some(c => c.parentRelationType === 'DECOMPOSITION')
    const remaining = (kpi.submissionCount || 0) < (kpi.expectedSubmissions || 1)

    // Trạng thái nộp — một nhãn, hoặc nút "Nộp bài" khi là việc phải làm ngay
    let main: React.ReactNode
    if (isDecompositionParent) main = <Badge variant="success">Đã chia KPI con</Badge>
    else if (!remaining) main = <Badge variant="success"><CheckCircle2 size={12} aria-hidden="true" /> Đã xong</Badge>
    else if (!isStarted) main = <Badge variant="secondary">Chưa mở</Badge>
    else if (isPeriodEnded) main = <Badge variant="destructive">Quá hạn</Badge>
    else if (enableWaterfall && isUserLeader) main = <Badge variant="info">Đang theo dõi</Badge>
    else main = (
      <Button asChild size="sm">
        <Link to={`/submissions/new?kpiId=${kpi.id}`}><Send aria-hidden="true" /> Nộp bài</Link>
      </Button>
    )

  return (
      <div className="flex items-center justify-end gap-1">
        {remaining && !isPeriodEnded && (
          <Button variant="ghost" size="icon-sm" onClick={() => setAdjustKpi(kpi)} aria-label="Đề nghị điều chỉnh" title="Đề nghị điều chỉnh"><Settings2 aria-hidden="true" /></Button>
        )}
        {isUserLeader && enableWaterfall && (
          <Button variant="ghost" size="icon-sm" onClick={() => setEditKpi(kpi)} aria-label={isDelegated ? 'Đã giao — điều chỉnh' : 'Giao cho nhân viên'} title={isDelegated ? 'Đã giao — bấm để điều chỉnh' : 'Giao cho nhân viên'} className={cn(isDelegated && 'text-[var(--color-success)]')}>
            <GitBranch aria-hidden="true" />
          </Button>
        )}
        {main}
      </div>
    )
  }
      
  const progressCell = (kpi: KpiCriteria, childKpis: KpiCriteria[]) => {
    const p = getDisplayProgress(kpi, childKpis)
    const text = kpi.frequency === 'UNLIMITED' ? `${kpi.submissionCount || 0}/∞` : `${p.count}/${p.expected}`
    const done = kpi.frequency !== 'UNLIMITED' && p.isComplete
    return <span className={cn('text-sm tabular-nums', done ? 'text-[var(--color-success)]' : 'text-[var(--color-foreground)]')}>{text} lần</span>
  }

  const deadlineCell = (kpi: KpiCriteria) => {
    const next = getNextDeadline(kpi)
    const done = (kpi.submissionCount || 0) >= (kpi.expectedSubmissions || 1)
    const overdue = !done && next && isAfter(now, next)
    return <span className={cn('text-sm tabular-nums', overdue ? 'font-medium text-[var(--color-error)]' : 'text-[var(--color-muted-foreground)]')}>{next ? next.toLocaleDateString('vi-VN') : '—'}</span>
  }

  const nameCell = (kpi: KpiCriteria, depth: number, childKpis: KpiCriteria[]) => {
    const isChildRow = depth > 0
    return (
      <div className="flex items-start gap-1.5" style={{ paddingLeft: isChildRow ? 24 : 0 }}>
        {!isChildRow && childKpis.length > 0 && (
          <Button variant="secondary" size="icon" className="mt-0.5 shrink-0" type="button" onClick={() => toggleParentCollapse(kpi.id)} aria-expanded={!collapsedParents.has(kpi.id)} aria-label={collapsedParents.has(kpi.id) ? 'Mở rộng KPI con' : 'Thu gọn KPI con'}>
            <ChevronDown aria-hidden="true" className={cn('transition-transform', collapsedParents.has(kpi.id) && '-rotate-90')} />
                  </Button>
        )}
        {isChildRow && <CornerDownRight size={14} className="mt-1 shrink-0 text-[var(--color-subtle-foreground)]" aria-hidden="true" />}
        <div className="min-w-0 max-w-[360px]">
          <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline max-w-full" type="button" onClick={() => setViewKpi(kpi)} title={kpi.name}>{kpi.name}</button>
          <div className="mt-0.5"><KpiTagChips kpi={kpi} childCount={childKpis.length} isChildRow={isChildRow} /></div>
                </div>
              </div>
    )
  }

  const weightCell = (kpi: KpiCriteria) => {
    const real = realWeightById.get(kpi.id)
    return (
      <span className="tabular-nums" title={real != null ? `Trọng số thật = ${kpi.weight}% × tỷ trọng hạng mục` : undefined}>
        {real != null ? <><span className="font-medium text-[var(--color-foreground)]">{real.toFixed(1)}%</span><span className="text-caption"> / {kpi.weight}%</span></> : <span className="font-medium text-[var(--color-foreground)]">{kpi.weight}%</span>}
      </span>
    )
  }

  /* ── Header của một đợt: tên + khoảng ngày + tự đánh giá ── */
  const periodHeader = (periodId: string, periodKpis: KpiCriteria[]) => {
    const period = periodsData?.content.find(p => p.id === periodId)
    const isPeriodDone = periodKpis.every(isKpiReadyForEval)
    const hasEvaluation = myEvals?.content.some(ev => ev.kpiPeriodId === periodId && ev.evaluatorId === user?.id)
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-muted)] px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-medium text-[var(--color-foreground)]">{period?.name || 'Chưa gắn đợt'}</h3>
          <p className="text-caption tabular-nums">{fmtDate(period?.startDate)} – {fmtDate(period?.endDate)} · {periodKpis.length} chỉ tiêu</p>
        </div>
        {isPeriodDone && !hasEvaluation && (
          <Button size="sm" onClick={() => setSelfEvalPeriodId(periodId)}><Star aria-hidden="true" /> Tự đánh giá đợt này</Button>
        )}
        {isPeriodDone && hasEvaluation && <Badge variant="success"><CheckCircle2 size={12} aria-hidden="true" /> Đã tự đánh giá</Badge>}
      </div>
    )
  }

  const emptyTitle = search ? 'Không tìm thấy chỉ tiêu' : selectedPeriodId !== 'ALL' ? 'Đợt này chưa có chỉ tiêu của bạn' : 'Bạn chưa được giao chỉ tiêu'
  const emptyDesc = search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Khi trưởng đơn vị giao và chỉ tiêu được duyệt, chúng sẽ hiện ở đây.'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-my-kpi-header"
        title={pageTitle}
        description="Chỉ tiêu bạn đang đảm nhận, gom theo đợt. Nộp báo cáo, đề nghị điều chỉnh, hoặc tự đánh giá khi đợt kết thúc."
        stats={[
          { label: 'Chỉ tiêu', value: headerStats.total, icon: ListChecks },
          { label: 'Cần nộp', value: headerStats.toSubmit, icon: Clock },
          { label: 'Quá hạn', value: headerStats.overdue, icon: AlertCircle },
        ]}
        actions={<AiShortcutButton prompt={aiShortcuts.myKpisAndScore()} title="K.AI tóm tắt chỉ tiêu kỳ này và điểm dự kiến của bạn" />}
      />

      <FilterBar
        id="tour-my-kpi-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm tên chỉ tiêu…' }}
        trailing={
          <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
            options={[{ value: 'TABLE', label: <List aria-hidden="true" />, title: 'Dạng bảng' }, { value: 'CARD', label: <LayoutGrid aria-hidden="true" />, title: 'Dạng thẻ' }]} />
        }
      >
                <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả các đợt</SelectItem>
            {periodsData?.content.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
            {enableOkr && (
          <>
                  <Select value={selectedObjectiveId} onValueChange={(v) => { setSelectedObjectiveId(v); setSelectedKeyResultId('ALL'); setPage(0) }}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label="Mục tiêu OKR"><SelectValue placeholder="Mục tiêu" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả mục tiêu</SelectItem>
                {objectivesData?.map(obj => <SelectItem key={obj.id} value={obj.id}>{obj.code} · {obj.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={selectedKeyResultId} onValueChange={(v) => { setSelectedKeyResultId(v); setPage(0) }} disabled={selectedObjectiveId === 'ALL'}>
              <SelectTrigger className="w-full sm:w-auto sm:min-w-56" aria-label="Kết quả then chốt"><SelectValue placeholder="Kết quả then chốt" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tất cả kết quả</SelectItem>
                {keyResults.map(kr => <SelectItem key={kr.id} value={kr.id}>{kr.code} · {kr.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
          </>
            )}
      </FilterBar>

      <div id="tour-my-kpi-table" className="space-y-4">
        {isLoading ? (
          <LoadingSkeleton type="table" rows={6} />
        ) : filteredKpis.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} />
          </div>
        ) : periodIds.map(periodId => {
              const periodKpis = kpisByPeriod[periodId]
              if (!periodKpis) return null
          const { rows, childrenByParentId } = buildKpiRows(periodKpis, collapsedParents)
          return (
            <section key={periodId} aria-label={periodsData?.content.find(p => p.id === periodId)?.name} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
              {periodHeader(periodId, periodKpis)}
              
              {viewMode === 'TABLE' && (
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Chỉ tiêu</th>
                        {enableOkr && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Mục tiêu / KR</th>}
                        <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Mục tiêu</th>
                        <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Trọng số</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Tiến độ</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Hạn nộp</th>
                        <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Trạng thái</th>
                        <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]">
                      {rows.map(({ kpi, depth }) => {
                        const childKpis = childrenByParentId.get(kpi.id) ?? []
              return (
                          <tr key={kpi.id} className={cn('transition-colors hover:bg-[var(--color-muted)]', depth > 0 && 'bg-[var(--color-background)]')}>
                            <td className="px-4 py-3">{nameCell(kpi, depth, childKpis)}</td>
                            {enableOkr && (
                              <td className="px-4 py-3">
                                <div className="max-w-[200px]">
                                  <p className="truncate text-sm text-[var(--color-foreground)]" title={kpi.objectiveName || undefined}>{kpi.objectiveName || '—'}</p>
                                  {kpi.keyResultName && <p className="truncate text-caption" title={kpi.keyResultName}>{kpi.keyResultCode ? `${kpi.keyResultCode} ·` : ''}{kpi.keyResultName}</p>}
                      </div>
                              </td>
                            )}
                            <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                              {kpi.kpiType === 'QUALITATIVE' ? <span className="text-caption">—</span> : <><span className="font-medium text-[var(--color-foreground)]">{formatNumber(kpi.targetValue || 0)}</span>{kpi.unit && <span className="text-caption"> {kpi.unit}</span>}</>}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">{weightCell(kpi)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{progressCell(kpi, childKpis)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{deadlineCell(kpi)}</td>
                            <td className="px-4 py-3"><StatusBadge status={kpi.status} /></td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">{rowActions(kpi, childKpis)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                      </div>
                    )}

              <div className={cn('grid grid-cols-1 gap-3 p-3', viewMode === 'CARD' ? 'md:grid-cols-2 xl:grid-cols-3' : 'md:hidden')}>
                {rows.map(({ kpi, depth }) => {
                  const childKpis = childrenByParentId.get(kpi.id) ?? []
                  return (
                    <div key={kpi.id} className={cn('rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4', depth > 0 && 'ml-4')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <button className="max-w-full truncate text-left text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-primary)] hover:underline" type="button" onClick={() => setViewKpi(kpi)}>{kpi.name}</button>
                          <div className="mt-1"><KpiTagChips kpi={kpi} childCount={childKpis.length} isChildRow={depth > 0} /></div>
                      </div>
                        <StatusBadge status={kpi.status} />
                  </div>
                      {enableOkr && kpi.objectiveName && <p className="mt-2 truncate text-caption">OKR: {kpi.objectiveName}</p>}
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div><dt className="text-eyebrow">Mục tiêu</dt><dd className="mt-0.5 tabular-nums">{kpi.kpiType === 'QUALITATIVE' ? '—' : `${formatNumber(kpi.targetValue || 0)}${kpi.unit ? ' ' + kpi.unit : ''}`}</dd></div>
                        <div><dt className="text-eyebrow">Trọng số</dt><dd className="mt-0.5">{weightCell(kpi)}</dd></div>
                        <div><dt className="text-eyebrow">Tiến độ</dt><dd className="mt-0.5">{progressCell(kpi, childKpis)}</dd></div>
                      </dl>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                        <span className="text-caption">Hạn: {deadlineCell(kpi)}</span>
                        {rowActions(kpi, childKpis)}
                  </div>
                </div>
              )
            })}
          </div>
            </section>
            )
          })}
        </div>

      {data && data.totalElements > pageSize && (
        <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
          <Pagination currentPage={page} totalPages={data.totalPages} onPageChange={setPage} totalElements={data.totalElements} size={pageSize} itemLabel="chỉ tiêu" />
        </div>
      )}

      <KpiDetailModal open={!!viewKpi} onClose={() => setViewKpi(null)} kpi={viewKpi} />
      <KpiAdjustmentModal open={!!adjustKpi} onClose={() => setAdjustKpi(null)} kpi={adjustKpi} />
      {editKpi && <KpiDelegationModal open={!!editKpi} onClose={() => setEditKpi(null)} kpi={editKpi} />}
      <EvaluationFormModal open={!!selfEvalPeriodId} onClose={() => setSelfEvalPeriodId(null)} initialPeriodId={selfEvalPeriodId ?? undefined} />
    </div>
  )
}

function isKpiReadyForEval(kpi: KpiCriteria) {
  if (kpi.frequency === 'UNLIMITED') {
    return !!kpi.kpiPeriod?.endDate && isAfter(new Date(), parseISO(kpi.kpiPeriod.endDate))
  }
  return (kpi.submissionCount || 0) >= (kpi.expectedSubmissions || 1)
}

function getDisplayProgress(kpi: KpiCriteria, childKpis: KpiCriteria[]) {
  const expected = kpi.expectedSubmissions || 1
  const decompositionChildren = childKpis.filter(c => c.parentRelationType === 'DECOMPOSITION')
  if (decompositionChildren.length === 0) {
    const count = kpi.submissionCount || 0
    return { count, expected, isComplete: count >= expected }
  }
  const doneCount = decompositionChildren.filter(isKpiReadyForEval).length
  const allDone = doneCount === decompositionChildren.length
  const count = allDone ? expected : Math.floor((doneCount / decompositionChildren.length) * expected)
  return { count, expected, isComplete: allDone }
}

function getNextDeadline(kpi: KpiCriteria) {
  const cutoff = kpi.effectiveDeadline ?? kpi.kpiPeriod?.endDate
  if (!kpi.kpiPeriod?.startDate || !cutoff) return null
  const start = parseISO(kpi.kpiPeriod.startDate).getTime()
  const end = parseISO(cutoff).getTime()

  if (kpi.frequency === 'UNLIMITED') return new Date(end)
  const totalSubmissions = kpi.expectedSubmissions || 1
  const currentSub = kpi.submissionCount || 0
  if (currentSub >= totalSubmissions) return new Date(end)
  const duration = end - start
  const subDuration = duration / totalSubmissions
  return new Date(start + (currentSub + 1) * subDuration)
}
