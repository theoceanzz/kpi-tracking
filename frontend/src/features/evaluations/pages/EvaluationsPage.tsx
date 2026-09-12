import { useState, useMemo, useEffect, Fragment } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import EvaluationFormModal from '../components/EvaluationFormModal'
import EvaluationDetailModal from '../components/EvaluationDetailModal'
import { useEvaluations } from '../hooks/useEvaluations'
import { useAuthStore } from '@/store/authStore'
import { usePermission } from '@/hooks/usePermission'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import { useMyKpi } from '@/features/kpi/hooks/useMyKpi'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { getScoringFunctions } from '@/lib/scoring'
import { formatDateTime, cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Evaluation } from '@/types/evaluation'
import { Star, Plus, TrendingUp, AlertCircle, ClipboardCheck, Inbox, Eye } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Pagination from '@/components/common/Pagination'
import {
  PersonGroupBadge, PersonGroupHeaderCard, PersonGroupHeaderRow,
  UnitGroupHeaderCard, UnitGroupHeaderRow,
} from '@/components/common/PersonGroupHeader'
import { groupByPerson, groupByUnitThenPerson, personGroupKey, type UnitGroup } from '@/lib/personGrouping'
import { usePersonGroupCollapse } from '@/hooks/usePersonGroupCollapse'

/** Số nhóm (đơn vị, hoặc người khi chỉ có một đơn vị) hiển thị mỗi trang. */
const GROUP_PAGE_SIZE = 10
/** Trần số bản đánh giá tải về một lần để gom nhóm. */
const GROUPING_FETCH_SIZE = 1000



export default function EvaluationsPage() {
  const { user } = useAuthStore()
  const { hasPermission } = usePermission()
  
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreBg, getScoreLabel } = getScoringFunctions(org)

  const isGlobalAdmin = hasPermission('SYSTEM:ADMIN')
  const canCreate = hasPermission('EVALUATION:CREATE') && !isGlobalAdmin
  const canViewAll = hasPermission('EVALUATION:VIEW') || hasPermission('SUBMISSION:REVIEW')

  // Control states
  const [page, setPage] = useState(0)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Filter states
  const [selectedKpiPeriodId, setSelectedKpiPeriodId] = useState('ALL')


  // Tải trọn phạm vi đang lọc để gom nhóm theo người cho đủ — phân trang 10 bản ghi/trang
  // sẽ cắt ngang một người thành hai trang. Phân trang lại theo NGƯỜI ở phía dưới.
  const { data, isLoading } = useEvaluations({
    page: 0,
    size: GROUPING_FETCH_SIZE,
    sortBy,
    sortDir,
    kpiPeriodId: selectedKpiPeriodId === 'ALL' ? undefined : selectedKpiPeriodId,
    organizationId: user?.memberships?.[0]?.organizationId,
  })

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [detailEval, setDetailEval] = useState<Evaluation | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [preSelectedPeriodId, setPreSelectedPeriodId] = useState<string | undefined>()

  // Handle auto-open self-evaluation from URL
  useEffect(() => {
    const action = searchParams.get('action')
    const periodId = searchParams.get('periodId')
    
    if (action === 'self-eval' && periodId) {
      setPreSelectedPeriodId(periodId)
      setShowForm(true)
      // Chỉ xoá 'action' để modal không tự mở lại khi render tiếp. GIỮ 'periodId': đó là bối cảnh
      // đợt mà thanh tiến trình mang theo suốt luồng, xoá đi là làm hỏng mọi bước phía sau.
      searchParams.delete('action')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Fetch reference data for filters
  const { data: periodsData } = useKpiPeriods({ organizationId: user?.memberships?.[0]?.organizationId })
  const { data: orgUnitTreeData } = useOrgUnitTree()

  const periods = periodsData?.content ?? []

  // Logic for reminders and single evaluation
  const now = new Date()
  const activePeriod = useMemo(() => {
    return periods.find((p: any) => {
      if (!p.startDate || !p.endDate) return false
      const start = new Date(p.startDate)
      const end = new Date(p.endDate)
      return now >= start && now <= end
    })
  }, [periods])

  const { data: myAllKpis } = useMyKpi({ page: 0, size: 500 })
  const hasKpiInActivePeriod = useMemo(() => {
    if (!activePeriod || !myAllKpis?.content) return false
    return myAllKpis.content.some((k: any) => k.kpiPeriodId === activePeriod.id)
  }, [activePeriod, myAllKpis])

  const flattenTree = (nodes: any[], level = 0): any[] => {
    let result: any[] = []
    nodes.forEach(node => {
      result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
      if (node.children?.length) {
        result = result.concat(flattenTree(node.children, level + 1))
      }
    })
    return result
  }
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])

  // Thứ tự đơn vị trong cây tổ chức, để các nhóm đơn vị hiện theo đúng trật tự cây.
  const unitOrder = useMemo(
    () => new Map<string, number>(flatOrgUnits.map((u: any, i: number) => [u.id, i])),
    [flatOrgUnits]
  )


  const hasSelfEvalForActivePeriod = useMemo(() => {
    if (!activePeriod || !data?.content) return false
    return data.content.some(ev => ev.kpiPeriodId === activePeriod.id && ev.evaluatorId === user?.id)
  }, [activePeriod, data, user])

  const isNearDeadline = useMemo(() => {
    if (!activePeriod || !activePeriod.endDate) return false
    const end = new Date(activePeriod.endDate)
    const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 7 && diffDays >= 0
  }, [activePeriod, now])

  const isPeriodCompleted = useMemo(() => {
    if (!activePeriod || !myAllKpis?.content) return false
    
    const periodKpis = myAllKpis.content.filter(k => k.kpiPeriodId === activePeriod.id)
    if (periodKpis.length === 0) return false

    return periodKpis.every(kpi => kpi.frequency === 'UNLIMITED' || kpi.submissionCount >= kpi.expectedSubmissions)
  }, [activePeriod, myAllKpis])

  const stats = useMemo(() => {
    const all = data?.content ?? []
    const totalCount = data?.totalElements || 0
    
    // Tính điểm trung bình dựa trên danh sách đang hiển thị
    const validEvals = all.filter((e: any) => e.score != null)
    
    const avgScore = validEvals.length > 0 
      ? Math.round(validEvals.reduce((acc: number, e: any) => acc + (e.score ?? 0), 0) / validEvals.length) 
      : 0
      
    return {
      total: totalCount,
      avgScore
    }
  }, [data, user])

  const evaluations = data?.content ?? []
  const hitFetchCap = evaluations.length >= GROUPING_FETCH_SIZE

  // Gom ĐƠN VỊ → NGƯỜI → lượt đánh giá (một người có nhiều lượt: nhiều kỳ × nhiều vai trò
  // người chấm), thay cho hai bộ lọc "Phòng ban" và "Nhân viên" trước đây.
  const extractPerson = (ev: Evaluation) => [{
    id: ev.userId,
    name: ev.userName,
    avatarUrl: ev.userAvatarUrl,
  }]

  const unitGroups = useMemo(
    () => groupByUnitThenPerson(
      evaluations,
      ev => ev.orgUnitId ? { id: ev.orgUnitId, name: ev.orgUnitName || 'Đơn vị không tên' } : null,
      extractPerson,
      unitOrder,
    ),
    [evaluations, unitOrder]
  )
  const personGroups = useMemo(() => groupByPerson(evaluations, extractPerson), [evaluations])

  // Chỉ thêm cấp nào thực sự có nhiều mục: ≥2 đơn vị mới gom theo đơn vị, ≥2 người mới gom
  // theo người; một người duy nhất thì giữ danh sách phẳng như cũ.
  const unitMode = unitGroups.length >= 2
  const personMode = personGroups.length >= 2

  const myUnitId = user?.memberships?.[0]?.orgUnitId
  const unitCollapse = usePersonGroupCollapse(myUnitId)
  // Nhóm người đánh khoá kèm đơn vị ở chế độ ba cấp, chỉ bằng id người khi rơi về hai cấp.
  const personCollapse = usePersonGroupCollapse(
    user?.id ? [user.id, myUnitId ? personGroupKey(myUnitId, user.id) : null] : null
  )
  const resetGroups = () => { unitCollapse.reset(); personCollapse.reset() }

  // Phân trang theo ĐƠN VỊ khi gom ba cấp, theo NGƯỜI khi chỉ có một đơn vị.
  const pagedGroups: { id: string }[] = unitMode ? unitGroups : personGroups
  const totalGroups = pagedGroups.length
  const totalGroupPages = Math.max(1, Math.ceil(totalGroups / GROUP_PAGE_SIZE))
  // Đổi bộ lọc có thể làm số trang co lại — kẹp ngay lúc render để không kẹt ở trang trống.
  const groupPage = Math.min(page, totalGroupPages - 1)
  const pageSlice = <T,>(list: T[]) =>
    list.slice(groupPage * GROUP_PAGE_SIZE, groupPage * GROUP_PAGE_SIZE + GROUP_PAGE_SIZE)
  const visibleUnits = unitMode ? pageSlice(unitGroups) : []
  const visibleGroups = !unitMode && personMode ? pageSlice(personGroups) : []

  /** Số liệu tóm tắt của một đơn vị. */
  const renderUnitBadges = (unit: UnitGroup<Evaluation>) => (
    <>
      <PersonGroupBadge label="nhân sự" value={unit.people.length} tone="indigo" />
      <PersonGroupBadge label="lượt đánh giá" value={unit.items.length} />
    </>
  )

  /** Trong một nhóm: kỳ mới nhất lên trước, rồi tới lượt tự đánh giá / quản lý chấm. */
  const sortWithinPerson = (list: Evaluation[]) =>
    [...list].sort((a, b) => {
      if (a.kpiPeriodName !== b.kpiPeriodName) return b.kpiPeriodName.localeCompare(a.kpiPeriodName)
      return (a.evaluatorRole ?? '').localeCompare(b.evaluatorRole ?? '')
    })

  /** Nhãn vai trò người chấm — dùng chung cho bảng và bản mobile. */
  const evaluatorLabel = (ev: Evaluation) =>
    ev.evaluatorRole === 'SELF' ? 'Tự đánh giá' :
    ev.evaluatorRoleName ? (
      (ev.evaluatorRole === 'CEO' || ev.evaluatorRole === 'DIRECTOR' || ev.evaluatorRole === 'REGIONAL_DIRECTOR')
        ? `${ev.evaluatorRoleName} chốt`
        : `${ev.evaluatorRoleName} chấm`
    ) : 'Quản lý chấm'
  /** Ô điểm + xếp loại — cùng công thức với trang Đánh giá đợt (P1). */
  const scoreChip = (raw: number | null | undefined, size: 'sm' | 'md' = 'sm') => {
    const score = raw ?? null
    return (
    <span className={cn('inline-flex items-center gap-2 rounded-control border px-2 py-0.5 font-medium leading-4', size === 'md' ? 'text-sm' : 'text-xs', getScoreBg(score))}>
      <span className={cn('tabular-nums', getScoreColor(score))}>{score ?? '—'}</span>
      <span className="border-l border-current/20 pl-2 text-[var(--color-muted-foreground)]">{getScoreLabel(score)}</span>
    </span>
    )
  }

  const evaluatorBadge = (ev: Evaluation) => {
    const variant = ev.evaluatorRole === 'SELF' ? 'info' : (ev.evaluatorRole === 'CEO' || ev.evaluatorRole === 'DIRECTOR') ? 'warning' : 'success'
    return <Badge variant={variant}>{evaluatorLabel(ev)}</Badge>
  }

  const renderEvaluationRow = (ev: Evaluation) => (
    <tr key={ev.id} onClick={() => setDetailEval(ev)} className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]">
      {!personMode && (
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <UserAvatar fullName={ev.userName} avatarUrl={ev.userAvatarUrl} className="h-8 w-8 rounded-control" fallbackClassName="bg-[var(--color-muted)] text-xs font-semibold text-[var(--color-muted-foreground)]" />
            <div className="min-w-0 max-w-[260px]">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]" title={ev.userName}>{ev.userName}</p>
              <p className="truncate text-caption">{[ev.userRoleName, ev.orgUnitName].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
        </td>
      )}
      <td className="px-4 py-3"><p className="max-w-[200px] truncate text-sm text-[var(--color-foreground)]" title={ev.kpiPeriodName}>{ev.kpiPeriodName}</p></td>
      <td className="px-4 py-3">{evaluatorBadge(ev)}</td>
      <td className="px-4 py-3">{scoreChip(ev.score)}</td>
      <td className="px-4 py-3 whitespace-nowrap text-sm tabular-nums text-[var(--color-muted-foreground)]">{formatDateTime(ev.createdAt).split(' ')[0]}</td>
      <td className="px-3 py-2 text-right">
        <Button variant="ghost" size="icon-sm" aria-label="Xem chi tiết" title="Xem chi tiết" onClick={e => { e.stopPropagation(); setDetailEval(ev) }}><Eye aria-hidden="true" /></Button>
      </td>
    </tr>
  )

  const renderEvaluationCard = (ev: Evaluation, showPerson: boolean) => (
    <div key={ev.id} onClick={() => setDetailEval(ev)} className="cursor-pointer rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors active:bg-[var(--color-muted)]">
      <div className="flex items-start justify-between gap-3">
        {showPerson ? (
          <div className="flex min-w-0 items-center gap-3">
            <UserAvatar fullName={ev.userName} avatarUrl={ev.userAvatarUrl} className="h-9 w-9 rounded-control" fallbackClassName="bg-[var(--color-muted)] text-xs font-semibold text-[var(--color-muted-foreground)]" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{ev.userName}</p>
              <p className="truncate text-caption">{ev.kpiPeriodName}</p>
            </div>
          </div>
        ) : (
          <p className="min-w-0 truncate text-sm font-medium text-[var(--color-foreground)]">{ev.kpiPeriodName}</p>
        )}
        {scoreChip(ev.score, 'md')}
          </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
        {evaluatorBadge(ev)}
        <span className="text-caption tabular-nums">{formatDateTime(ev.createdAt).split(' ')[0]}</span>
        </div>
    </div>
  )

  const renderPersonBadges = (list: Evaluation[]) => {
    const scored = sortWithinPerson(list).find(e => e.score != null)
    return (
      <>
        <PersonGroupBadge label="lượt đánh giá" value={list.length} />
        {scored?.score != null && scoreChip(scored.score)}
      </>
    )
  }

  const tableColSpan = personMode ? 5 : 6
  const reminderDue = activePeriod && hasKpiInActivePeriod && !hasSelfEvalForActivePeriod && isNearDeadline
  const emptyTitle = selectedKpiPeriodId !== 'ALL' ? 'Đợt này chưa có đánh giá' : canViewAll ? 'Chưa có đánh giá nào' : 'Bạn chưa có bản đánh giá nào'
  const emptyDesc = canViewAll ? 'Đánh giá xuất hiện khi nhân sự tự đánh giá hoặc quản lý chấm điểm xong một đợt.' : 'Khi bạn tự đánh giá hoặc quản lý chấm xong, kết quả sẽ hiện ở đây.'

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-eval-header"
        title={canViewAll ? 'Đánh giá' : 'Đánh giá của tôi'}
        description={canViewAll ? 'Kết quả tự đánh giá và điểm quản lý chấm của từng nhân sự theo đợt.' : 'Điểm và xếp loại bạn nhận được qua từng đợt, gồm cả bản tự đánh giá.'}
        stats={[
          { label: 'Lượt đánh giá', value: stats.total, icon: ClipboardCheck },
          { label: 'Điểm trung bình', value: stats.avgScore, icon: TrendingUp },
        ]}
        actions={canCreate ? <Button onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Tự đánh giá</Button> : undefined}
      />
      
      {/* Nhắc hạn: chỉ khi sắp hết hạn, có KPI trong đợt và chưa tự đánh giá */}
      {reminderDue && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
            <p className="text-sm text-[var(--color-foreground)]">
              Cần tự đánh giá đợt <span className="font-medium">{activePeriod.name}</span> trước ngày{' '}
              <span className="font-medium tabular-nums">{activePeriod.endDate ? new Date(activePeriod.endDate).toLocaleDateString('vi-VN') : '—'}</span>.
              {!isPeriodCompleted && <span className="text-[var(--color-muted-foreground)]"> Nộp đủ báo cáo của đợt rồi mới đánh giá được.</span>}
          </p>
        </div>
          <Button size="sm" onClick={() => setShowForm(true)} disabled={!isPeriodCompleted}>
            <Star aria-hidden="true" /> {isPeriodCompleted ? 'Tự đánh giá ngay' : 'Chưa đủ điều kiện'}
          </Button>
        </div>
      )}

      <FilterBar id="tour-eval-filters">
        <Select value={selectedKpiPeriodId} onValueChange={val => { setSelectedKpiPeriodId(val); setPage(0); resetGroups() }}>
          <SelectTrigger className="w-full sm:w-52" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Tất cả các đợt</SelectItem>
            {periods.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
        <Select value={`${sortBy}:${sortDir}`} onValueChange={v => { const [f, d] = v.split(':'); if (f && d) { setSortBy(f); setSortDir(d as 'asc' | 'desc'); setPage(0) } }}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Sắp xếp"><SelectValue placeholder="Sắp xếp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt:desc">Mới nhất trước</SelectItem>
            <SelectItem value="createdAt:asc">Cũ nhất trước</SelectItem>
            <SelectItem value="score:desc">Điểm cao → thấp</SelectItem>
            <SelectItem value="score:asc">Điểm thấp → cao</SelectItem>
          </SelectContent>
        </Select>
            {selectedKpiPeriodId !== 'ALL' && (
          <Button variant="ghost" size="sm" onClick={() => { setSelectedKpiPeriodId('ALL'); setPage(0) }}>Xoá bộ lọc</Button>
            )}
      </FilterBar>

      {hitFetchCap && (
        <div role="status" className="flex items-start gap-2 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-foreground)]">Chỉ hiển thị {GROUPING_FETCH_SIZE} lượt gần nhất. Lọc theo đợt để xem đủ.</p>
        </div>
      )}

      {isLoading ? (
        <LoadingSkeleton type="table" rows={6} />
      ) : evaluations.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState icon={Inbox} title={emptyTitle} description={emptyDesc} action={canCreate && !canViewAll ? <Button variant="outline" onClick={() => setShowForm(true)}><Plus aria-hidden="true" /> Tự đánh giá</Button> : undefined} />
        </div>
      ) : (
        <>
          <div id="tour-eval-table" className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  {!personMode && <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Nhân sự</th>}
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Đợt</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Người chấm</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Điểm · Xếp loại</th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Ngày</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {unitMode
                  ? visibleUnits.map(unit => (
                      <Fragment key={unit.id}>
                        <UnitGroupHeaderRow colSpan={tableColSpan} unit={unit} expanded={unitCollapse.isExpanded(unit.id)} onToggle={() => unitCollapse.toggle(unit.id)} isCurrentUnit={unit.id === myUnitId} badges={renderUnitBadges(unit)} />
                        {unitCollapse.isExpanded(unit.id) && unit.people.map(group => {
                          const key = personGroupKey(unit.id, group.id)
                          return (
                            <Fragment key={key}>
                              <PersonGroupHeaderRow colSpan={tableColSpan} indent person={group} expanded={personCollapse.isExpanded(key)} onToggle={() => personCollapse.toggle(key)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} />
                              {personCollapse.isExpanded(key) && sortWithinPerson(group.items).map(renderEvaluationRow)}
                            </Fragment>
                          )
                        })}
                      </Fragment>
                    ))
                  : personMode
                  ? visibleGroups.map(group => (
                      <Fragment key={group.id}>
                        <PersonGroupHeaderRow colSpan={tableColSpan} person={group} expanded={personCollapse.isExpanded(group.id)} onToggle={() => personCollapse.toggle(group.id)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} />
                        {personCollapse.isExpanded(group.id) && sortWithinPerson(group.items).map(renderEvaluationRow)}
                      </Fragment>
                    ))
                  : sortWithinPerson(evaluations).map(renderEvaluationRow)}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 md:hidden">
            {unitMode
              ? visibleUnits.map(unit => (
                  <div key={unit.id} className="space-y-2">
                    <UnitGroupHeaderCard unit={unit} expanded={unitCollapse.isExpanded(unit.id)} onToggle={() => unitCollapse.toggle(unit.id)} isCurrentUnit={unit.id === myUnitId} badges={renderUnitBadges(unit)} />
                    {unitCollapse.isExpanded(unit.id) && unit.people.map(group => {
                          const key = personGroupKey(unit.id, group.id)
                          return (
                        <div key={key} className="space-y-2 pl-3">
                          <PersonGroupHeaderCard person={group} expanded={personCollapse.isExpanded(key)} onToggle={() => personCollapse.toggle(key)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} />
                          {personCollapse.isExpanded(key) && sortWithinPerson(group.items).map(ev => renderEvaluationCard(ev, false))}
                            </div>
                          )
                        })}
                      </div>
                ))
              : personMode
              ? visibleGroups.map(group => (
                  <div key={group.id} className="space-y-2">
                    <PersonGroupHeaderCard person={group} expanded={personCollapse.isExpanded(group.id)} onToggle={() => personCollapse.toggle(group.id)} isCurrentUser={group.id === user?.id} badges={renderPersonBadges(group.items)} />
                    {personCollapse.isExpanded(group.id) && sortWithinPerson(group.items).map(ev => renderEvaluationCard(ev, false))}
                  </div>
                ))
              : sortWithinPerson(evaluations).map(ev => renderEvaluationCard(ev, true))}
          </div>

          {(unitMode || personMode) && (
            <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
              <Pagination currentPage={groupPage} totalPages={totalGroupPages} onPageChange={setPage} totalElements={totalGroups} size={GROUP_PAGE_SIZE} itemLabel={unitMode ? 'đơn vị' : 'nhân sự'} />
        </div>
      )}
        </>
      )}

      <EvaluationFormModal open={showForm} onClose={() => { setShowForm(false); setPreSelectedPeriodId(undefined) }} initialPeriodId={preSelectedPeriodId} />
      <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </div>
  )
}
