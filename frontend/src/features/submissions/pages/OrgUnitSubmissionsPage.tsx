import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import EvaluationFormModal from '@/features/evaluations/components/EvaluationFormModal'
import { useOrgUnitSubmissions } from '../hooks/useOrgUnitSubmissions'
import { useEvaluations } from '@/features/evaluations/hooks/useEvaluations'
import { evaluationApi } from '@/features/evaluations/api/evaluationApi'
import { useApiAllowed } from '@/hooks/useApiAllowed'
import { scoringBlockReasons } from '../utils/scoringReadiness'
import type { ScoringReadiness } from '@/types/evaluation'
import { useUsers } from '@/features/users/hooks/useUsers'
import { cn, getPrimaryMembership } from '@/lib/utils'
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
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Users, Clock, ClipboardCheck, ArrowRight, Eye, PenLine, Inbox, Bot, Loader2, Star } from 'lucide-react'
import { useAiReviewBatch } from '../hooks/useAiReview'
import { useWorkflowNavigator } from '@/features/kpi/workflow/hooks/useWorkflowNavigator'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Chức danh hiển thị dưới tên: ưu tiên chức danh ghi trên bản đánh giá; không có thì lấy
 * membership "đại diện" — cấp thấp nhất khi người đó kiêm nhiệm nhiều cấp, rồi tới thứ hạng vai
 * trò, rồi ưu tiên đơn vị đang lọc. Giữ nguyên thuật toán cũ, chỉ tách ra khỏi JSX.
 */
function roleLabelFor(emp: any, evaluation: any, selectedOrgUnitId: string): string {
  if (evaluation?.userRoleName) return evaluation.userRoleName
  const memberships = [...(emp.memberships || [])]
  if (memberships.length === 0) return i18n.t('submissions:OrgUnitSubmissionsPage.employee')
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
  return best?.roleName || i18n.t('submissions:OrgUnitSubmissionsPage.employee')
}

export default function OrgUnitSubmissionsPage() {
  const { t } = useTranslation('submissions')
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
  const rawTitle = (customLabels as Record<string, string>)['submissions-org-unit'] || (customLabels as Record<string, string>)['/submissions/org-unit'] || t('OrgUnitSubmissionsPage.periodEvaluation')

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const aiBatch = useAiReviewBatch()
  // "Tất cả" = cả cây: chạy lô từ đơn vị gốc; máy chủ vẫn chỉ xếp hàng người mình chấm được.
  const aiBatchUnitId = selectedOrgUnitId === 'ALL' ? orgUnitTreeData?.[0]?.id : selectedOrgUnitId
  const canAiBatch = !!org?.enableAi && !!org?.enableAiReview && hasPermission('AI_REVIEW:USE')
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

  // Nút K.AI: hỏi đúng đơn vị + kỳ đang chọn trên màn hình (tên để trợ lý đọc, id để backend đặt
  // đơn vị hiện tại). Chọn "Tất cả" thì để trợ lý hiểu là đơn vị của mình.
  const aiUnitId = selectedOrgUnitId !== 'ALL' ? selectedOrgUnitId : undefined
  const aiUnitName = aiUnitId ? flatOrgUnits.find((u: any) => u.id === aiUnitId)?.name ?? null : null
  const aiPeriodName = selectedPeriod?.name ?? null

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

  // Ai đã đủ điều kiện để mình chấm (nộp đủ KPI + tự đánh giá, hoặc đợt đã hết) — luật ở backend
  // (EvaluationReadinessService), backend cũng chặn khi chốt nên đây chỉ để khoá nút kèm lý do.
  const canReadReadiness = useApiAllowed('GET', '/evaluations/scoring-readiness')
  const readinessPeriodId = selectedPeriodId && selectedPeriodId !== 'ALL' ? selectedPeriodId : ''
  const readinessUnitId = selectedOrgUnitId === 'ALL' ? undefined : selectedOrgUnitId
  const { data: readinessData } = useQuery({
    queryKey: ['evaluations', 'scoring-readiness', readinessPeriodId, readinessUnitId],
    queryFn: () => evaluationApi.getScoringReadiness(readinessPeriodId, readinessUnitId),
    enabled: !!readinessPeriodId && !!isManager && canReadReadiness,
  })
  const readinessByUserId = useMemo(() => {
    const map: Record<string, ScoringReadiness> = {}
    readinessData?.forEach(r => { map[r.userId] = r })
    return map
  }, [readinessData])
  /** Lý do chưa chấm được người này; rỗng = chấm được (hoặc chưa tải xong — backend vẫn chặn). */
  const blockReasonsFor = (userId: string) => scoringBlockReasons(readinessByUserId[userId], t)

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
  const [selfEvalOpen, setSelfEvalOpen] = useState(false)
  // Bài hướng dẫn mở phiếu chấm của người đầu danh sách (cần chọn một đợt cụ thể).
  useTourModal('subs.staffEval', () => { const first = employees.find(e => e.id !== user?.id); if (first && isManager) setStaffEvalUser(first) }, () => setStaffEvalUser(null))

  /**
   * Dòng của CHÍNH mình (trưởng đơn vị cũng là thành viên đơn vị nên có mặt trong danh sách). Mình
   * không chấm đợt cho mình được — backend coi đó là tự đánh giá và ghi đè phiếu tự đánh giá; người
   * chấm mình là trưởng đơn vị cấp trên. Nên dòng này mở hộp TỰ đánh giá, không mở phiếu của quản lý.
   */
  const isMe = (emp: any) => !!user?.id && emp.id === user.id

  const handleRowClick = (emp: any) => {
    if (!selectedPeriodId || selectedPeriodId === 'ALL') return;
    
    const evaluation = evaluationsByUserId[emp.id]
    if (isMe(emp)) {
      if (evaluation) setDetailEval(evaluation)
      else setSelfEvalOpen(true)
      return
    }
    // Chỉ có bản tự đánh giá ⇒ quản lý chưa chấm: mở phiếu chấm nếu đã đủ điều kiện.
    const managerEvaluated = evaluation && evaluation.evaluatorRole !== 'SELF'
    if (managerEvaluated) {
      setDetailEval(evaluation)
    } else if (isManager && blockReasonsFor(emp.id).length === 0) {
      setStaffEvalUser(emp)
    } else if (evaluation) {
      setDetailEval(evaluation)
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
    if (hasSubmissionByUserId.has(emp.id)) return <Badge variant="warning">{t('OrgUnitSubmissionsPage.notScored')}</Badge>
    if (isPeriodEnded) return <Badge variant="destructive">{t('OrgUnitSubmissionsPage.notSubmitted')}</Badge>
    return <Badge variant="secondary">{t('OrgUnitSubmissionsPage.notEvaluated')}</Badge>
  }
        
  const renderEvaluator = (evaluation: any) => {
    if (!evaluation) return <span className="text-caption">—</span>
    return (
      <div className="min-w-0">
        <p className="truncate text-sm text-[var(--color-foreground)]" title={evaluation.evaluatorName}>{evaluation.evaluatorName}</p>
        <p className="text-caption">{evaluation.evaluatorRole === 'SELF' ? t('OrgUnitSubmissionsPage.selfScore') : evaluation.evaluatorRoleName || t('OrgUnitSubmissionsPage.manager')}</p>
                </div>
    )
  }

  const renderAction = (emp: any, evaluation: any) => {
    if (!periodChosen) return null
    const viewButton = evaluation && (
      <Button {...tourAnchor('subs.view-eval')} variant="ghost" size="icon-sm" aria-label={t('OrgUnitSubmissionsPage.viewEvaluation')} title={t('OrgUnitSubmissionsPage.viewEvaluation')} onClick={e => { e.stopPropagation(); setDetailEval(evaluation) }}>
        <Eye aria-hidden="true" />
      </Button>
    )
    if (isMe(emp)) {
      // Đã tự đánh giá (hoặc cấp trên đã chấm) ⇒ chỉ xem — cùng luật với trang "Của tôi", nơi nút
      // "Tự đánh giá đợt này" biến mất sau khi gửi. Chưa có gì thì mới mời tự đánh giá.
      if (evaluation) return viewButton || null
      return (
        <Button variant="outline" size="sm" title={t('OrgUnitSubmissionsPage.selfAssessHint')} onClick={e => { e.stopPropagation(); setSelfEvalOpen(true) }}>
          <Star aria-hidden="true" /> {t('OrgUnitSubmissionsPage.selfAssess')}
        </Button>
      )
    }
    // Quản lý đã chấm ⇒ chỉ xem. Mới có bản tự đánh giá thì vẫn còn việc chấm của quản lý.
    if (!isManager || (evaluation && evaluation.evaluatorRole !== 'SELF')) return viewButton || null

    // Danh sách sẵn sàng chỉ gồm người MÌNH chấm được (backend). Đã tải mà không có người này ⇒ chấm
    // ở chỗ khác — thường là người kiêm nhiệm: chỉ trưởng ĐƠN VỊ CHÍNH của họ chấm đợt.
    const primary = getPrimaryMembership(emp)
    const notMine = !!readinessData && !readinessByUserId[emp.id]
    const reasons = notMine
      ? [primary ? t('ScoringReadiness.scoredInPrimaryUnit', { unit: primary.orgUnitName }) : t('ScoringReadiness.notYours')]
      : blockReasonsFor(emp.id)
    const missing = readinessByUserId[emp.id]?.missingKpiNames ?? []
    const scoreButton = reasons.length > 0 ? (
      // Nút bị khoá không nhận hover ở mọi trình duyệt ⇒ đặt title lên khối bọc ngoài.
      <div className="flex flex-col items-end gap-0.5 text-right"
        title={[t('ScoringReadiness.rule'), missing.length > 0 ? t('ScoringReadiness.missing', { names: missing.join(', ') }) : null].filter(Boolean).join('\n')}
      >
        <Button {...tourAnchor('subs.score')} variant="outline" size="sm" disabled onClick={e => e.stopPropagation()}>
          <PenLine aria-hidden="true" /> {t('OrgUnitSubmissionsPage.score')}
        </Button>
        <span className="text-caption">{reasons.join(' · ')}</span>
      </div>
    ) : (
      <Button {...tourAnchor('subs.score')} variant="outline" size="sm" onClick={e => { e.stopPropagation(); setStaffEvalUser(emp) }}>
        <PenLine aria-hidden="true" /> {t('OrgUnitSubmissionsPage.score')}
      </Button>
    )
    return viewButton
      ? <div className="flex items-start justify-end gap-1">{viewButton}{scoreButton}</div>
      : scoreButton
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <WorkspaceHeader
        id="tour-approve-stats"
        title={rawTitle}
        description={t('OrgUnitSubmissionsPage.approveSubmissionsAndScoreEachPerson')}
        stats={[
          { label: t('OrgUnitSubmissionsPage.people'), value: stats.totalEmployees, icon: Users },
          { label: t('OrgUnitSubmissionsPage.pendingSubmissions'), value: stats.totalPending, icon: Clock },
          { label: t('OrgUnitSubmissionsPage.evaluated'), value: stats.totalEvaluated, icon: ClipboardCheck },
        ]}
        actions={
          // Gom các nút vào một nhóm để chúng xuống dòng cùng nhau, không tách 1 trên 1 dưới.
          <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
            {canAiBatch && (
              <Button {...tourAnchor('subs.ai-batch')}
                variant="outline"
                disabled={!selectedPeriodId || !aiBatchUnitId || aiBatch.isPending}
                title="AI đọc trước bài nộp của mọi người bạn chấm được trong đơn vị đang chọn (chạy nền, chỉ để tham khảo)"
                onClick={() => aiBatch.mutate({ periodId: selectedPeriodId, orgUnitId: aiBatchUnitId! })}
              >
                {aiBatch.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bot aria-hidden="true" />}
                Nhờ AI xem trước cả đơn vị
              </Button>
            )}
            {hasPermission('SUBMISSION:REVIEW') && (
              <AiShortcutButton {...tourAnchor('subs.ai-approve')}
                label={t('OrgUnitSubmissionsPage.approveWithKAi')}
                prompt={aiShortcuts.reviewSubmissions(aiUnitName, aiPeriodName)}
                focusUnitId={aiUnitId}
                title={t('OrgUnitSubmissionsPage.kAiListsThePendingSubmissions')}
              />
            )}
            {hasPermission('REMINDER:SEND') && (
              <AiShortcutButton {...tourAnchor('subs.ai-remind')}
                label={t('OrgUnitSubmissionsPage.remindWithKAi')}
                prompt={aiShortcuts.remindNonSubmitters(aiUnitName, aiPeriodName)}
                focusUnitId={aiUnitId}
                title={t('OrgUnitSubmissionsPage.kAiListsThePeopleWho')}
              />
            )}
          </div>
        }
      />

      <FilterBar
        id="tour-approve-toolbar"
        search={{ value: search, onChange: v => { setSearch(v); setPage(0) }, placeholder: t('OrgUnitSubmissionsPage.searchEmployees') }}
      >
              {canManageOrg && (
                  <Select value={selectedOrgUnitId} onValueChange={val => { setSelectedOrgUnitId(val); setPage(0) }}>
            <SelectTrigger {...tourAnchor('subs.unit')} className="w-full sm:w-auto sm:min-w-64" aria-label={t('OrgUnitSubmissionsPage.unit')}><SelectValue placeholder={t('OrgUnitSubmissionsPage.chooseUnit')} /></SelectTrigger>
            <SelectContent>
              {flatOrgUnits.map(unit => <SelectItem key={unit.id} value={unit.id}>{unit.levelLabel}</SelectItem>)}
                    </SelectContent>
                  </Select>
        )}
        <Select value={selectedPeriodId} onValueChange={val => { setSelectedPeriodId(val); setPage(0) }}>
          <SelectTrigger {...tourAnchor('subs.period')} className="w-full sm:w-auto sm:min-w-64" aria-label={t('OrgUnitSubmissionsPage.evaluationPeriods')}><SelectValue placeholder={t('OrgUnitSubmissionsPage.evaluationPeriods')} /></SelectTrigger>
          <SelectContent>
            <ScopeSelectItems items={periodsData?.content} selectedId={selectedPeriodId} />
          </SelectContent>
        </Select>
      </FilterBar>

      {isPeriodEnded && (
        <p role="status" className="text-caption">{t('OrgUnitSubmissionsPage.thisPeriodHasEndedPeopleWho')}</p>
              )}

        {isLoading ? (
            <LoadingSkeleton type="table" rows={8} />
      ) : sortedEmployees.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState 
            icon={Inbox}
            title={search ? t('OrgUnitSubmissionsPage.noEmployeesFound') : t('OrgUnitSubmissionsPage.theUnitHasNoMembersYet')}
            description={search ? t('OrgUnitSubmissionsPage.tryAnotherKeywordOrClearThe') : t('OrgUnitSubmissionsPage.chooseAnotherUnitOrAddPeople')}
            />
          </div>
        ) : (
        <>
          <div {...tourAnchor('subs.table')} id="tour-approve-table" className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
            <table className="w-full">
                <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                    <SortHeader field="fullName" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('OrgUnitSubmissionsPage.people')}</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">
                    <SortHeader field="pending" active={sortActive} dir={sortDir} onToggle={handleSort} className="ml-auto">{t('OrgUnitSubmissionsPage.pendingSubmissions')}</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                    <SortHeader field="score" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('OrgUnitSubmissionsPage.scoreRating')}</SortHeader>
                    </th>
                  <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">{t('OrgUnitSubmissionsPage.scorer')}</th>
                  <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('OrgUnitSubmissionsPage.actions')}</th>
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
                          ? <Badge variant="warning">{pendingCount} {t('OrgUnitSubmissionsPage.pendingApproval')}</Badge>
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
                <div key={emp.id} onClick={() => handleRowClick(emp)} className="cursor-pointer rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4">
                  <div className="flex items-center gap-3">
                    <UserAvatar fullName={emp.fullName} avatarUrl={emp.avatarUrl} className="h-9 w-9 rounded-control" fallbackClassName="bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{emp.fullName}</p>
                      <p className="truncate text-caption">{roleLabelFor(emp, evaluation, selectedOrgUnitId)}</p>
                        </div>
                    {pendingCount > 0 && <Badge variant="warning">{pendingCount} {t('OrgUnitSubmissionsPage.pending')}</Badge>}
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
            <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} totalElements={sortedEmployees.length} size={pageSize} itemLabel={t('OrgUnitSubmissionsPage.people2')} />
          </div>
        </>
        )}

        {staffEvalUser && isManager && !isMe(staffEvalUser) && selectedPeriodId !== 'ALL' && (
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
        
        <EvaluationFormModal open={selfEvalOpen} onClose={() => setSelfEvalOpen(false)} initialPeriodId={periodChosen ? selectedPeriodId : undefined} />

        {detailEval && (
        <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
        )}

      {/* Lối đi tiếp. Đích lấy từ cấu hình luồng nên tổ chức tắt bước nào thì nút tự bỏ qua bước đó. */}
        {nextAfterReview && (
          <div className="flex justify-end pt-2">
          <Button {...tourAnchor('subs.next')} onClick={() => goToNext('SUBMISSION_REVIEW', { periodId: selectedPeriodId }, { openCreate: false })}>
            {t('OrgUnitSubmissionsPage.next')} {nextAfterReview.label} <ArrowRight aria-hidden="true" />
          </Button>
          </div>
        )}
    </div>
  )
}
