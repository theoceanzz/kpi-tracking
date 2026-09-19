import { useState, useMemo, useEffect } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import FilterBar from '@/components/common/FilterBar'
import Pagination from '@/components/common/Pagination'
import { SortHeader, type SortDir } from '@/components/common/SortHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import StaffEvaluationModal from '../components/StaffEvaluationModal'
import EvaluationDetailModal from '@/features/evaluations/components/EvaluationDetailModal'
import { useOrgUnitSubmissions } from '../hooks/useOrgUnitSubmissions'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { useUsers } from '@/features/users/hooks/useUsers'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { getScoringFunctions } from '@/lib/scoring'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useKpiPeriods } from '@/features/kpi/hooks/useKpiPeriods'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest } from '@/components/common/dateScope'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useSidebarSettings } from '@/features/organization/hooks/useSidebarSettings'
import { usePermission } from '@/hooks/usePermission'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Clock, ClipboardCheck, ArrowRight, Eye, PenLine, Inbox } from 'lucide-react'
import { useWorkflowNavigator } from '@/features/kpi/workflow/hooks/useWorkflowNavigator'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chức danh hiển thị dưới tên: ưu tiên chức danh ghi trên bản đánh giá; không có thì lấy
 * membership "đại diện" — cấp thấp nhất khi người đó kiêm nhiệm nhiều cấp, rồi tới thứ hạng vai
 * trò, rồi ưu tiên đơn vị đang lọc. Giữ nguyên thuật toán cũ, chỉ tách ra khỏi JSX.
 */
function roleLabelFor(emp: any, evaluation: any, selectedOrgUnitId: string): string {
  if (evaluation?.userRoleName) return evaluation.userRoleName
  const memberships = [...(emp.memberships || [])]
  if (memberships.length === 0) return 'Nhân viên'
  const levels = memberships.map((m: any) => m.levelOrder ?? m.roleLevel ?? 0)
  const minLevel = Math.min(...levels)
  const hasDeeperLevel = levels.some(l => l > minLevel)
  const best = memberships.sort((a: any, b: any) => {
    if (hasDeeperLevel) {
      const isMinA = (a.levelOrder ?? a.roleLevel ?? 0) === minLevel ? 1 : 0
      const isMinB = (b.levelOrder ?? b.roleLevel ?? 0) === minLevel ? 1 : 0
      if (isMinA !== isMinB) return isMinA - isMinB
    }
    const rankA = typeof a.roleRank === 'number' ? a.roleRank : 99
    const rankB = typeof b.roleRank === 'number' ? b.roleRank : 99
    if (rankA !== rankB) return rankA - rankB
    if (selectedOrgUnitId !== 'ALL') {
      const matchA = String(a.orgUnitId) === String(selectedOrgUnitId) ? 0 : 1
      const matchB = String(b.orgUnitId) === String(selectedOrgUnitId) ? 0 : 1
      if (matchA !== matchB) return matchA - matchB
    }
    const levelA = a.levelOrder ?? a.roleLevel ?? 0
    const levelB = b.levelOrder ?? b.roleLevel ?? 0
    if (levelA !== levelB) return levelB - levelA
    return 0
  })[0]
  return best?.roleName || 'Nhân viên'
}

export default function OrgUnitSubmissionsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize] = useState(10)
  const { user } = useAuthStore()
  const [selectedOrgUnitId, setSelectedOrgUnitId] = useState(user?.memberships?.[0]?.orgUnitId || 'ALL')
  const [selectedPeriodId, setSelectedPeriodId] = useState('')    
  const { hasPermission } = usePermission()
  const canManageOrg = hasPermission('ROLE:ASSIGN')
  const { goToNext, nextReachableStage } = useWorkflowNavigator()
  const nextAfterReview = nextReachableStage('SUBMISSION_REVIEW')

  // Mặc định đẩy người còn bài chờ duyệt lên đầu. Dòng sidebar chỉ mang TỔNG số bài
  // chờ, nên vào trang mà xếp theo tên là người duyệt lại phải tự dò xem con số đỏ đó
  // đến từ ai — đúng việc mà badge lẽ ra phải chỉ thẳng.
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' | null }>({
    key: 'pending',
    direction: 'desc'
  })

  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreBg, getScoreLabel } = getScoringFunctions(org)
  const isManager = useMemo(() => user?.memberships?.some(m => m.roleRank === 0), [user])

  const { data: customLabels = {} } = useSidebarSettings(orgId!)
  const rawTitle = (customLabels as Record<string, string>)['submissions-org-unit'] || (customLabels as Record<string, string>)['/submissions/org-unit'] || 'Đánh giá đợt'

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const { data: periodsData } = useKpiPeriods({ organizationId: orgId })

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

  useEffect(() => {
    if (selectedOrgUnitId === 'ALL') {
      if (canManageOrg && flatOrgUnits.length > 0) {
        setSelectedOrgUnitId(flatOrgUnits[0].id)
      } else if (!canManageOrg && user?.memberships?.[0]?.orgUnitId) {
        setSelectedOrgUnitId(user.memberships[0].orgUnitId)
      }
    }
  }, [flatOrgUnits, selectedOrgUnitId, canManageOrg, user])

  // Đợt đang chạy; nếu hôm nay rơi vào kẽ giữa hai đợt thì lấy đợt vừa kết thúc
  // (trước đây để trống, người duyệt vào trang thấy ô đợt rỗng và bảng không có gì).
  const activePeriod = useMemo(
    () => pickCurrentOrNearest(periodsData?.content),
    [periodsData]
  )

  useEffect(() => {
    if (!selectedPeriodId && activePeriod?.id) {
      setSelectedPeriodId(activePeriod.id)
    }
  }, [activePeriod, selectedPeriodId])

  const selectedPeriod = useMemo(
    () => periodsData?.content?.find((p: any) => p.id === selectedPeriodId),
    [periodsData, selectedPeriodId]
  )
  const isPeriodEnded = useMemo(() => {
    if (!selectedPeriod?.endDate) return false
    return new Date() > new Date(selectedPeriod.endDate)
  }, [selectedPeriod])

  // Tải trọn danh sách nhân sự của đơn vị rồi mới cắt trang ở client. Xếp "chờ duyệt lên
  // đầu" trên từng trang 10 người do server cắt sẵn chỉ sắp lại đúng trang đang xem —
  // người còn bài chờ ở trang 3 vẫn nằm im ở trang 3.
  /**
   * Chọn một đơn vị = xem cả nhánh dưới nó, giống trang Đánh giá kỳ — chọn đơn vị gốc là thấy
   * toàn tổ chức.
   *
   * Phải tự gom ở client vì ba API trên trang này không nhất quán: `/evaluations` và `/submissions`
   * tự mở rộng theo `path` của đơn vị ở backend, còn `/users` lọc KHỚP CHÍNH XÁC theo danh sách id.
   * Không gom thì chọn đơn vị cha ra danh sách rỗng, trong khi hai khối số liệu kia vẫn có dữ liệu
   * của cả nhánh — lệch nhau ngay trên cùng một màn hình.
   */
  const subtreeUnitIds = useMemo<string[] | undefined>(() => {
    if (selectedOrgUnitId === 'ALL') return undefined
    type Node = { id: string; children?: Node[] }
    const findNode = (nodes: Node[]): Node | null => {
      for (const n of nodes) {
        if (n.id === selectedOrgUnitId) return n
        const hit = findNode(n.children ?? [])
        if (hit) return hit
      }
      return null
    }
    const collect = (n: Node, out: string[]) => {
      out.push(n.id)
      ;(n.children ?? []).forEach(c => collect(c, out))
    }
    const node = findNode((orgUnitTreeData as Node[]) || [])
    if (!node) return [selectedOrgUnitId] // cây chưa tải xong ⇒ tạm lọc đúng đơn vị đang chọn
    const out: string[] = []
    collect(node, out)
    return out
  }, [orgUnitTreeData, selectedOrgUnitId])

  const { data: usersData, isLoading: isLoadingUsers } = useUsers({
    page: 0,
    size: 1000,
    // BE nhận orgUnitIds (List). Gửi orgUnitId số ít thì Spring bỏ qua tham số lạ, API trả về
    // TOÀN BỘ nhân sự của tổ chức mà không báo lỗi gì — bộ lọc đơn vị trông như không hoạt động.
    orgUnitIds: subtreeUnitIds,
    keyword: search || undefined,
    organizationId: orgId
  })

  // Fetch Evaluations for the selected period
  const { data: evaluationsData, isLoading: isLoadingEvals } = useEvaluations({
    size: 1000,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: orgId
  })

  const { data: submissionsData, isLoading: isLoadingSubs } = useOrgUnitSubmissions({
    size: 1000,
    kpiPeriodId: selectedPeriodId === 'ALL' ? undefined : selectedPeriodId,
    orgUnitId: selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId,
    organizationId: orgId,
  })

  const evaluationsByUserId = useMemo(() => {
    const map: Record<string, any> = {}
    if (!evaluationsData?.content) return map

    const getAuthorityWeight = (role?: string) => {
      switch (role) {
        case 'CEO': return 100
        case 'REGIONAL_DIRECTOR': return 90
        case 'DIRECTOR': return 80
        case 'DEPT_HEAD': return 40
        case 'TEAM_LEADER': return 20
        case 'SELF': return 0
        default: return 10
      }
    }

    // Sort evaluations so higher authority comes LAST (to overwrite in the map)
    const sortedEvals = [...evaluationsData.content].sort((a, b) => {
      return getAuthorityWeight(a.evaluatorRole) - getAuthorityWeight(b.evaluatorRole)
    })

    sortedEvals.forEach(ev => map[ev.userId] = ev)
    return map
  }, [evaluationsData])

  const pendingByUserId = useMemo(() => {
    const map: Record<string, number> = {}
    submissionsData?.content.forEach(s => {
      if (s.status === 'PENDING') {
        const isOwn = s.submittedById === user?.id
        const canReview = (!s.isSubmittedByManager || canManageOrg) && !isOwn
        if (canReview) {
          map[s.submittedById] = (map[s.submittedById] || 0) + 1
        }
      }
    })
    return map
  }, [submissionsData, user, canManageOrg])

  // Người dùng đã nộp ít nhất 1 bài trong đợt (bất kể trạng thái) → phân biệt "đã làm" vs "chưa làm".
  const hasSubmissionByUserId = useMemo(() => {
    const set = new Set<string>()
    submissionsData?.content.forEach(s => {
      if (s.submittedById) set.add(s.submittedById)
    })
    return set
  }, [submissionsData])

  const sortedEmployees = useMemo(() => {
    const items = [...(usersData?.content ?? [])]
    if (!sortConfig.key || !sortConfig.direction) return items

    return items.sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.key) {
        case 'fullName':
          aValue = a.fullName
          bValue = b.fullName
          break
        case 'pending':
          aValue = pendingByUserId[a.id] || 0
          bValue = pendingByUserId[b.id] || 0
          break
        case 'score':
          aValue = evaluationsByUserId[a.id]?.score ?? -1
          bValue = evaluationsByUserId[b.id]?.score ?? -1
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
      // Bằng điểm/bằng số bài chờ thì xếp theo tên, để thứ tự không nhảy giữa hai lần tải.
      return (a.fullName ?? '').localeCompare(b.fullName ?? '')
    })
  }, [usersData?.content, sortConfig, pendingByUserId, evaluationsByUserId])

  const totalPages = Math.max(1, Math.ceil(sortedEmployees.length / pageSize))

  // Lọc hẹp lại (đổi đơn vị, gõ tìm kiếm) có thể làm danh sách ngắn hơn trang đang đứng —
  // kẹp lại ngay khi dựng chứ không đợi một effect gọi setState rồi vẽ lần hai.
  const safePage = Math.min(page, totalPages - 1)

  const employees = useMemo(
    () => sortedEmployees.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [sortedEmployees, safePage, pageSize]
  )

  const isLoading = isLoadingUsers || isLoadingEvals || isLoadingSubs

  const [staffEvalUser, setStaffEvalUser] = useState<any>(null)
  const [detailEval, setDetailEval] = useState<any>(null)

  const handleRowClick = (emp: any) => {
    if (!selectedPeriodId || selectedPeriodId === 'ALL') return;
    
    const evaluation = evaluationsByUserId[emp.id]
    if (evaluation) {
      setDetailEval(evaluation)
    } else if (isManager) {
      setStaffEvalUser(emp)
    }
  }

  const stats = useMemo(() => {
    return {
      totalEmployees: usersData?.totalElements || 0,
      totalPending: Object.values(pendingByUserId).reduce((sum, count) => sum + count, 0),
      totalEvaluated: Object.keys(evaluationsByUserId).length
    }
  }, [usersData, pendingByUserId, evaluationsByUserId])

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }))
    setPage(0)
  }


  const periodChosen = !!selectedPeriodId && selectedPeriodId !== 'ALL'
  const sortDir: SortDir = sortConfig.direction === 'asc' ? 'asc' : 'desc'
  const sortActive = sortConfig.direction ? sortConfig.key : null

  /** Trạng thái đánh giá của một người — một ô, bốn khả năng, cùng bảng màu ngữ nghĩa với StatusBadge. */
  const renderScore = (emp: any, evaluation: any) => {
    if (evaluation) {
  return (
        <span className={cn('inline-flex items-center gap-2 rounded-control border px-2 py-0.5 text-xs font-medium leading-4', getScoreBg(evaluation.score))}>
          <span className={cn('tabular-nums', getScoreColor(evaluation.score))}>{evaluation.score ?? '—'}</span>
          <span className="border-l border-current/20 pl-2 text-[var(--color-muted-foreground)]">{getScoreLabel(evaluation.score)}</span>
        </span>
      )
    }
    if (hasSubmissionByUserId.has(emp.id)) return <Badge variant="warning">Chưa chấm</Badge>
    if (isPeriodEnded) return <Badge variant="destructive">Chưa nộp</Badge>
    return <Badge variant="secondary">Chưa đánh giá</Badge>
  }
        
  const renderEvaluator = (evaluation: any) => {
    if (!evaluation) return <span className="text-caption">—</span>
    return (
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--color-foreground)]" title={evaluation.evaluatorName}>{evaluation.evaluatorName}</p>
        <p className="text-caption">{evaluation.evaluatorRole === 'SELF' ? 'Tự chấm' : evaluation.evaluatorRoleName || 'Quản lý'}</p>
                </div>
    )
  }

  const renderAction = (emp: any, evaluation: any) => {
    if (!periodChosen) return null
    if (evaluation) {
      return (
        <Button variant="ghost" size="icon-sm" aria-label="Xem đánh giá" title="Xem đánh giá" onClick={e => { e.stopPropagation(); setDetailEval(evaluation) }}>
          <Eye aria-hidden="true" />
        </Button>
      )
    }
    if (isManager) {
      return (
        <Button variant="outline" size="sm" onClick={e => { e.stopPropagation(); setStaffEvalUser(emp) }}>
          <PenLine aria-hidden="true" /> Chấm điểm
        </Button>
      )
    }
    return null
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-approve-stats"
        title={rawTitle}
        description="Duyệt bài nộp và chấm điểm từng nhân sự trong đợt. Người còn bài chờ duyệt xếp lên đầu."
        stats={[
          { label: 'Nhân sự', value: stats.totalEmployees, icon: Users },
          { label: 'Bài chờ duyệt', value: stats.totalPending, icon: Clock },
          { label: 'Đã đánh giá', value: stats.totalEvaluated, icon: ClipboardCheck },
        ]}
              />

      <FilterBar
        id="tour-approve-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: 'Tìm nhân viên…' }}
      >
              {canManageOrg && (
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0) }}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-64" aria-label="Đơn vị"><SelectValue placeholder="Chọn đơn vị" /></SelectTrigger>
            <SelectContent>
              {flatOrgUnits.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.levelLabel}</SelectItem>)}
                    </SelectContent>
                  </Select>
        )}
        <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
          <SelectTrigger className="w-full sm:w-auto sm:min-w-64" aria-label="Đợt đánh giá"><SelectValue placeholder="Đợt đánh giá" /></SelectTrigger>
          <SelectContent>
            <ScopeSelectItems items={periodsData?.content} selectedId={selectedPeriodId} />
          </SelectContent>
        </Select>
      </FilterBar>

      {isPeriodEnded && (
        <p role="status" className="text-caption">Đợt này đã kết thúc — nhân sự chưa nộp được đánh dấu "Chưa nộp".</p>
              )}

        {isLoading ? (
            <LoadingSkeleton type="table" rows={8} />
      ) : sortedEmployees.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState 
            icon={Inbox}
            title={search ? 'Không tìm thấy nhân viên' : 'Đơn vị chưa có nhân sự'}
            description={search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Chọn đơn vị khác, hoặc thêm nhân sự ở Thiết lập công ty.'}
            />
          </div>
        ) : (
        <>
          <div id="tour-approve-table" className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
            <table className="w-full">
                <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                    <SortHeader field="fullName" active={sortActive} dir={sortDir} onToggle={handleSort}>Nhân sự</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">
                    <SortHeader field="pending" active={sortActive} dir={sortDir} onToggle={handleSort} className="ml-auto">Bài chờ duyệt</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                    <SortHeader field="score" active={sortActive} dir={sortDir} onToggle={handleSort}>Điểm · Xếp loại</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">Người chấm</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                  </tr>
                </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {employees.map((emp: any) => {
                    const pendingCount = pendingByUserId[emp.id] || 0
                    const evaluation = evaluationsByUserId[emp.id]
                  const clickable = periodChosen && (evaluation || isManager)
                    return (
                    <tr key={emp.id} onClick={() => handleRowClick(emp)} className={cn('transition-colors', clickable && 'cursor-pointer hover:bg-[var(--color-muted)]')}>
                      <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                          <UserAvatar fullName={emp.fullName} avatarUrl={emp.avatarUrl} className="h-8 w-8 rounded-control" fallbackClassName="bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]" />
                          <div className="min-w-0 max-w-[280px]">
                            <p className="truncate text-sm font-medium text-[var(--color-foreground)]" title={emp.fullName}>{emp.fullName}</p>
                            <p className="truncate text-caption">{roleLabelFor(emp, evaluation, selectedOrgUnitId)}</p>
                            </div>
                          </div>
                        </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {pendingCount > 0
                          ? <Badge variant="warning">{pendingCount} chờ duyệt</Badge>
                          : <span className="text-caption">0</span>}
                        </td>
                      <td className="px-4 py-3">{renderScore(emp, evaluation)}</td>
                      <td className="px-4 py-3">{renderEvaluator(evaluation)}</td>
                      <td className="px-3 py-2 text-right">{renderAction(emp, evaluation)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

          <div className="space-y-2 md:hidden">
            {employees.map((emp: any) => {
                const pendingCount = pendingByUserId[emp.id] || 0
                const evaluation = evaluationsByUserId[emp.id]
                return (
                <div key={emp.id} onClick={() => handleRowClick(emp)} className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar fullName={emp.fullName} avatarUrl={emp.avatarUrl} className="h-9 w-9 rounded-control" fallbackClassName="bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{emp.fullName}</p>
                      <p className="truncate text-caption">{roleLabelFor(emp, evaluation, selectedOrgUnitId)}</p>
                        </div>
                    {pendingCount > 0 && <Badge variant="warning">{pendingCount} chờ</Badge>}
                      </div>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
                    {renderScore(emp, evaluation)}
                    {renderAction(emp, evaluation)}
                    </div>
                  </div>
                )
              })}
            </div>

          <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalElements={sortedEmployees.length} size={pageSize} itemLabel="nhân sự" />
          </div>
        </>
        )}

        {staffEvalUser && isManager && selectedPeriodId !== 'ALL' && (
          <StaffEvaluationModal
            open={!!staffEvalUser}
            onClose={() => setStaffEvalUser(null)}
            userId={staffEvalUser.id}
            userName={staffEvalUser.fullName}
            periodId={selectedPeriodId}
            periodName={periodsData?.content.find((p: any) => p.id === selectedPeriodId)?.name || ''}
            periodEnded={isPeriodEnded}
          />
        )}
        
        {detailEval && (
        <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
        )}

      {/* Lối đi tiếp. Đích lấy từ cấu hình luồng nên tổ chức tắt bước nào thì nút tự bỏ qua bước đó. */}
        {nextAfterReview && (
          <div className="flex justify-end pt-2">
          <Button onClick={() => goToNext('SUBMISSION_REVIEW', { periodId: selectedPeriodId }, { openCreate: false })}>
            Tiếp theo: {nextAfterReview.label} <ArrowRight aria-hidden="true" />
          </Button>
          </div>
        )}
    </div>
  )
}
