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
import {
  Star, Plus, ChevronRight, Calendar,
  ArrowUpDown, Award, TrendingUp, Activity, X, Loader2, AlertCircle
} from 'lucide-react'
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
      // Clean up params after opening
      searchParams.delete('action')
      searchParams.delete('periodId')
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

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
    setPage(0)
  }

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

  /** Một dòng đánh giá. Cột "Nhân viên" chỉ hiện ở chế độ phẳng — gom nhóm rồi thì tên
   *  người đã nằm ở header nhóm nên lặp lại chỉ tổ rối. */
  const renderEvaluationRow = (ev: Evaluation) => (
    <tr
      key={ev.id}
      onClick={() => setDetailEval(ev)}
      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
    >
      <td className="px-8 py-6 whitespace-nowrap">
        <div className={cn("inline-flex items-center gap-3 px-4 py-2 rounded-2xl border shadow-sm", getScoreBg(ev.score))}>
          <span className={cn("text-lg font-black", getScoreColor(ev.score))}>{ev.score ?? '—'}</span>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-3 leading-none">
            {getScoreLabel(ev.score)}
          </span>
        </div>
      </td>
      {!personMode && (
        <td className="px-6 py-6">
          <div className="flex items-center gap-3">
            <UserAvatar
              fullName={ev.userName}
              avatarUrl={ev.userAvatarUrl}
              className="w-10 h-10 rounded-2xl shadow-inner"
              fallbackClassName="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 font-black text-xs text-slate-600 dark:text-slate-300"
            />
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-all">
                {ev.userName}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                  {ev.userRoleName || 'NHÂN VIÊN'}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">{ev.orgUnitName}</span>
              </div>
            </div>
          </div>
        </td>
      )}
      <td className="px-6 py-6">
        <div className="flex items-center gap-2">
          <Calendar size={14} className="text-slate-400" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {ev.kpiPeriodName}
          </p>
        </div>
      </td>
      <td className="px-6 py-6 text-center">
        <span className={cn(
          "inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border",
          ev.evaluatorRole === 'SELF'
            ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20'
            : (ev.evaluatorRole === 'CEO' || ev.evaluatorRole === 'DIRECTOR')
            ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20'
            : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20'
        )}>
          {evaluatorLabel(ev)}
        </span>
      </td>
      <td className="px-6 py-6 whitespace-nowrap text-center">
        <span className="text-xs font-bold text-slate-500">
          {formatDateTime(ev.createdAt).split(' ')[0]}
        </span>
      </td>
      <td className="px-8 py-6 text-right">
        <button className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 shadow-sm transition-all active:scale-90">
          <ChevronRight size={20} />
        </button>
      </td>
    </tr>
  )

  /** Bản mobile của một lượt đánh giá. `showPerson` tắt khi đã có header nhóm phía trên. */
  const renderEvaluationCard = (ev: Evaluation, showPerson: boolean) => (
    <div
      key={ev.id}
      onClick={() => setDetailEval(ev)}
      className="p-4 space-y-3 active:bg-slate-50 dark:active:bg-slate-800/30 transition-colors cursor-pointer"
    >
      <div className="flex items-center justify-between gap-3">
        {showPerson ? (
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar
              fullName={ev.userName}
              avatarUrl={ev.userAvatarUrl}
              className="w-10 h-10 rounded-2xl shadow-inner"
              fallbackClassName="bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 font-black text-xs text-slate-600 dark:text-slate-300"
            />
            <div className="min-w-0">
              <p className="text-sm font-black text-slate-900 dark:text-white truncate">{ev.userName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="px-1.5 py-0.5 rounded-md bg-blue-50 dark:bg-blue-900/30 text-[8px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest border border-blue-100 dark:border-blue-800/50">
                  {ev.userRoleName || 'NHÂN VIÊN'}
                </span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter truncate">{ev.orgUnitName}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0 text-slate-500 dark:text-slate-400">
            <Calendar size={12} className="shrink-0" />
            <span className="text-xs font-bold truncate">{ev.kpiPeriodName}</span>
          </div>
        )}
        <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-sm shrink-0", getScoreBg(ev.score))}>
          <span className={cn("text-base font-black", getScoreColor(ev.score))}>{ev.score ?? '—'}</span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
        {showPerson ? (
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Calendar size={12} />
            <span className="font-bold">{ev.kpiPeriodName}</span>
          </div>
        ) : <span />}
        <span className="font-bold text-slate-400">{formatDateTime(ev.createdAt).split(' ')[0]}</span>
      </div>

      <span className={cn(
        "inline-block text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border",
        ev.evaluatorRole === 'SELF'
          ? 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20'
          : (ev.evaluatorRole === 'CEO' || ev.evaluatorRole === 'DIRECTOR')
          ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20'
          : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20'
      )}>
        {evaluatorLabel(ev)}
      </span>
    </div>
  )

  /** Số liệu tóm tắt của một người: số lượt đánh giá và điểm chốt gần nhất. */
  const renderPersonBadges = (list: Evaluation[]) => {
    const scored = sortWithinPerson(list).find(e => e.score != null)
    return (
      <>
        <PersonGroupBadge label="lượt đánh giá" value={list.length} />
        {scored?.score != null && (
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border shadow-sm', getScoreBg(scored.score))}>
            <span className={cn('text-[11px] font-black leading-none', getScoreColor(scored.score))}>{scored.score}</span>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{getScoreLabel(scored.score)}</span>
          </span>
        )}
      </>
    )
  }

  return (
    <div className="max-w-[1440px] mx-auto p-4 md:p-6 space-y-6">
      
      {/* Dynamic Header */}
      <div id="tour-eval-header" className="flex flex-col items-center text-center lg:flex-row lg:text-left lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-8 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
           <Award size={120} className="text-indigo-600" />
        </div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center justify-center lg:justify-start gap-2 text-indigo-600 dark:text-indigo-400">
            <Star size={20} className="fill-current" />
            <span className="text-[10px] font-black uppercase tracking-[2px]">Performance Reviews</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {canViewAll ? 'Quản lý Đánh giá' : 'Tự đánh giá Hiệu suất'}
          </h1>
          <p className="text-slate-500 font-medium text-sm max-w-lg">
            {canViewAll 
              ? 'Hệ thống quản trị và phản hồi kết quả đánh giá năng lực nhân sự định kỳ.'
              : 'Nơi phản ánh kết quả nỗ lực và tự đánh giá năng lực bản thân theo từng kỳ.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 relative z-10">
          <EvaluationStat label="Tổng đánh giá" value={stats.total} color="indigo" icon={Activity} isLoading={isLoading} />
          <EvaluationStat label="Điểm trung bình" value={stats.avgScore} color="amber" icon={TrendingUp} isScore isLoading={isLoading} />
        </div>
      </div>

      {/* Reminder Banner */}
      {activePeriod && hasKpiInActivePeriod && !hasSelfEvalForActivePeriod && isNearDeadline && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-3xl p-6 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-black text-amber-900 dark:text-amber-100">Cần thực hiện: Tự đánh giá đợt {activePeriod.name}</h3>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400 opacity-80">
                Hãy hoàn tất bản đánh giá trước ngày <b className="font-black underline">{activePeriod.endDate ? new Date(activePeriod.endDate).toLocaleDateString('vi-VN') : '—'}</b>.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowForm(true)}
            disabled={!isPeriodCompleted}
            className={cn(
              "px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md active:scale-95",
              !isPeriodCompleted 
                ? "bg-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            {isPeriodCompleted ? 'ĐÁNH GIÁ NGAY' : 'CHƯA ĐỦ ĐIỀU KIỆN'}
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div id="tour-eval-filters" className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        <div className="lg:col-span-8 flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:w-64">
            <Select value={selectedKpiPeriodId} onValueChange={val => { setSelectedKpiPeriodId(val); setPage(0) }}>
              <SelectTrigger className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold shadow-sm h-10">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Calendar size={16} className="text-slate-400" />
                </div>
                <SelectValue placeholder="Tất cả đợt đánh giá..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-[var(--color-border)] shadow-lg max-h-[300px]">
                <SelectItem value="ALL" className="font-medium cursor-pointer rounded-lg text-xs">Tất cả đợt đánh giá...</SelectItem>
                {periods.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-medium cursor-pointer rounded-lg text-xs">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Danh sách đã gom theo Đơn vị → Người nên bỏ hẳn hai bộ lọc "Phòng ban" và "Nhân viên". */}

          <div className="flex items-center gap-2">
            {selectedKpiPeriodId !== 'ALL' && (
              <button
                onClick={() => {
                  setSelectedKpiPeriodId('ALL');
                  setPage(0);
                  resetGroups();
                }}
                className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all border border-transparent hover:border-rose-100"
                title="Xóa bộ lọc"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex justify-end">
          {canCreate && (
            <button 
              onClick={() => setShowForm(true)} 
              disabled={isLoading || !periodsData || !myAllKpis || hasSelfEvalForActivePeriod || !hasKpiInActivePeriod || !isPeriodCompleted}
              className={cn(
                "flex items-center gap-2 px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-[2px] transition-all shadow-xl active:scale-95 w-full md:w-auto justify-center",
                (isLoading || !periodsData || !myAllKpis || hasSelfEvalForActivePeriod || !hasKpiInActivePeriod || !isPeriodCompleted)
                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed shadow-none border border-slate-200 dark:border-slate-700'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-indigo-600 dark:hover:bg-indigo-50 shadow-indigo-500/10'
              )}
            >
              {isLoading || !periodsData || !myAllKpis ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
              {isLoading || !periodsData || !myAllKpis ? 'Đang tải...' : hasSelfEvalForActivePeriod ? 'Đã tự đánh giá' : !hasKpiInActivePeriod ? 'Không có KPI' : !isPeriodCompleted ? 'Chưa hoàn thành KPI' : 'Tự đánh giá mới'}
            </button>
          )}
        </div>
      </div>

      {hitFetchCap && (
        <div className="flex items-center gap-3 px-6 py-4 rounded-[20px] bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40">
          <AlertCircle size={18} className="text-amber-500 shrink-0" />
          <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
            Dữ liệu quá lớn nên chỉ hiển thị {GROUPING_FETCH_SIZE} bản đánh giá gần nhất — hãy lọc thêm theo đợt hoặc phòng ban để xem đầy đủ.
          </p>
        </div>
      )}

      {/* Table Content */}
      {isLoading ? (
        <LoadingSkeleton type="table" rows={10} />
      ) : (data?.content ?? []).length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 p-24 shadow-sm text-center">
          <EmptyState 
            title="Chưa có dữ liệu đánh giá" 
            description={canViewAll 
              ? 'Hệ thống hiện chưa có bản đánh giá nào phù hợp với bộ lọc tìm kiếm.'
              : 'Bắt đầu tự phản ánh kết quả công việc bằng cách thực hiện bản tự đánh giá đầu tiên.'
            } 
          />
        </div>
      ) : (
        <div id="tour-eval-table" className="bg-white dark:bg-slate-900 rounded-[40px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Kết quả</th>
                  {/* Gom theo người rồi thì tên nhân viên đã nằm ở header nhóm. */}
                  {!personMode && (
                    <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <button onClick={() => handleSort('userName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                        Nhân viên <ArrowUpDown size={12} />
                      </button>
                    </th>
                  )}
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('kpiPeriodName')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Kỳ đánh giá <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Vai trò</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <button onClick={() => handleSort('createdAt')} className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
                      Ngày tạo <ArrowUpDown size={12} />
                    </button>
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {unitMode
                  ? visibleUnits.map(unit => (
                      <Fragment key={unit.id}>
                        <UnitGroupHeaderRow
                          colSpan={5}
                          unit={unit}
                          expanded={unitCollapse.isExpanded(unit.id)}
                          onToggle={() => unitCollapse.toggle(unit.id)}
                          isCurrentUnit={unit.id === myUnitId}
                          badges={renderUnitBadges(unit)}
                        />
                        {unitCollapse.isExpanded(unit.id) && unit.people.map(group => {
                          const key = personGroupKey(unit.id, group.id)
                          return (
                            <Fragment key={key}>
                              <PersonGroupHeaderRow
                                colSpan={5}
                                indent
                                person={group}
                                expanded={personCollapse.isExpanded(key)}
                                onToggle={() => personCollapse.toggle(key)}
                                isCurrentUser={group.id === user?.id}
                                badges={renderPersonBadges(group.items)}
                              />
                              {personCollapse.isExpanded(key) && sortWithinPerson(group.items).map(renderEvaluationRow)}
                            </Fragment>
                          )
                        })}
                      </Fragment>
                    ))
                  : personMode
                  ? visibleGroups.map(group => (
                      <Fragment key={group.id}>
                        <PersonGroupHeaderRow
                          colSpan={5}
                          person={group}
                          expanded={personCollapse.isExpanded(group.id)}
                          onToggle={() => personCollapse.toggle(group.id)}
                          isCurrentUser={group.id === user?.id}
                          badges={renderPersonBadges(group.items)}
                        />
                        {personCollapse.isExpanded(group.id) && sortWithinPerson(group.items).map(renderEvaluationRow)}
                      </Fragment>
                    ))
                  : sortWithinPerson(evaluations).map(renderEvaluationRow)}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {unitMode
              ? visibleUnits.map(unit => (
                  <div key={unit.id} className="p-3 space-y-3">
                    <UnitGroupHeaderCard
                      unit={unit}
                      expanded={unitCollapse.isExpanded(unit.id)}
                      onToggle={() => unitCollapse.toggle(unit.id)}
                      isCurrentUnit={unit.id === myUnitId}
                      badges={renderUnitBadges(unit)}
                    />
                    {unitCollapse.isExpanded(unit.id) && (
                      <div className="pl-3 space-y-3">
                        {unit.people.map(group => {
                          const key = personGroupKey(unit.id, group.id)
                          return (
                            <div key={key} className="space-y-3">
                              <PersonGroupHeaderCard
                                person={group}
                                expanded={personCollapse.isExpanded(key)}
                                onToggle={() => personCollapse.toggle(key)}
                                isCurrentUser={group.id === user?.id}
                                badges={renderPersonBadges(group.items)}
                              />
                              {personCollapse.isExpanded(key) && (
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                  {sortWithinPerson(group.items).map(ev => renderEvaluationCard(ev, false))}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))
              : personMode
              ? visibleGroups.map(group => (
                  <div key={group.id} className="p-3 space-y-3">
                    <PersonGroupHeaderCard
                      person={group}
                      expanded={personCollapse.isExpanded(group.id)}
                      onToggle={() => personCollapse.toggle(group.id)}
                      isCurrentUser={group.id === user?.id}
                      badges={renderPersonBadges(group.items)}
                    />
                    {personCollapse.isExpanded(group.id) && (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortWithinPerson(group.items).map(ev => renderEvaluationCard(ev, false))}
                      </div>
                    )}
                  </div>
                ))
              : sortWithinPerson(evaluations).map(ev => renderEvaluationCard(ev, true))}
          </div>

          {/* Phân trang theo ĐƠN VỊ (hoặc theo NGƯỜI khi chỉ có một đơn vị); danh sách phẳng chỉ cần dòng đếm. */}
          <div className="bg-slate-50/50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
            {unitMode || personMode ? (
              <Pagination
                currentPage={groupPage}
                totalPages={totalGroupPages}
                onPageChange={setPage}
                totalElements={totalGroups}
                size={GROUP_PAGE_SIZE}
                itemLabel={unitMode ? 'đơn vị' : 'nhân sự'}
              />
            ) : (
              <p className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {evaluations.length} Kết quả
              </p>
            )}
          </div>
        </div>
      )}

      <EvaluationFormModal 
        open={showForm} 
        onClose={() => {
          setShowForm(false)
          setPreSelectedPeriodId(undefined)
        }} 
        initialPeriodId={preSelectedPeriodId}
      />
      <EvaluationDetailModal open={!!detailEval} onClose={() => setDetailEval(null)} evaluation={detailEval} />
    </div>
  )
}

function EvaluationStat({ label, value, color, icon: Icon, isScore, isLoading }: { label: string; value: number; color: string; icon: any; isScore?: boolean; isLoading?: boolean }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-900/40",
    amber: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-900/40",
  }
  return (
    <div className={cn("px-6 py-4 rounded-[28px] border flex items-center gap-4 shadow-sm min-w-[180px]", colors[color])}>
      <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center bg-white dark:bg-slate-800 shadow-sm text-current")}>
        <Icon size={18} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          {isLoading ? (
            <div className="h-8 w-12 bg-current/10 animate-pulse rounded-lg" />
          ) : (
            <>
              <span className="text-2xl font-black">{value}</span>
              {isScore && <span className="text-xs font-bold opacity-60">pts</span>}
            </>
          )}
        </div>
        <p className="text-[9px] font-black uppercase tracking-widest opacity-60 leading-none mt-0.5">{label}</p>
      </div>
    </div>
  )
}
