import { useState, useMemo, useEffect, Fragment } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '../hooks/useKpiCycles'
import { useUnitCycleSummary, useCycleApprovalChain } from '../hooks/useCycleEvaluation'
import CycleApprovalTimeline from '../components/CycleApprovalTimeline'
import SendEvaluationModal from '../components/SendEvaluationModal'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { getScoringFunctions } from '@/lib/scoring'
import { exportCycleEvaluationToExcel, exportCycleMemberDetailToExcel } from '../utils/cycleEvaluationExport'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import EmptyState from '@/components/common/EmptyState'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { format, parseISO } from 'date-fns'
import type { CycleEvaluationMode, CycleUserEvaluation, CyclePeriodBreakdown } from '@/types/kpi'
import RewardPrompt from '@/features/rewards/components/RewardPrompt'
import {
  CalendarRange, Building2, Search, Award, ChevronRight, CheckCircle2, Lock, LockOpen, MessageSquare,
  ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, FileSpreadsheet, Download, Loader2, Mail
} from 'lucide-react'

const MODE_LABEL: Record<CycleEvaluationMode, string> = {
  QUANTITATIVE: 'Định lượng',
  QUALITATIVE: 'Định tính',
  BOTH: 'Cả hai',
}

const flattenTree = (nodes: any[], level = 0): any[] => {
  let result: any[] = []
  nodes.forEach(node => {
    result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
    if (node.children?.length) result = result.concat(flattenTree(node.children, level + 1))
  })
  return result
}

type SortKey = 'userName' | 'selfScore' | 'managerScore' | 'finalScore'

export default function CycleEvaluationPage() {
  const user = useAuthStore(s => s.user)
  const orgId = user?.memberships?.[0]?.organizationId
  const { hasPermission } = useHasPermission()
  const canFinalize = hasPermission('CYCLE_EVAL:FINALIZE')
  const canSend = hasPermission('CYCLE_EVAL:SEND')

  const { data: org } = useOrganization(orgId)
  const { getScoreColor, getScoreBg, getScoreLabel, maxScore } = getScoringFunctions(org)

  const { data: cyclesData } = useKpiCycles({ organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesData?.content || []

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])

  const [cycleId, setCycleId] = useState<string>('')
  const [orgUnitId, setOrgUnitId] = useState<string>(user?.memberships?.[0]?.orgUnitId || '')
  const [search, setSearch] = useState('')
  const [detailMember, setDetailMember] = useState<CycleUserEvaluation | null>(null)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [comment, setComment] = useState('')
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'userName', direction: 'asc' })

  useEffect(() => { const first = cycles[0]; if (!cycleId && first) setCycleId(first.id) }, [cycles, cycleId])
  useEffect(() => { if (!orgUnitId && flatOrgUnits.length) setOrgUnitId(flatOrgUnits[0].id) }, [flatOrgUnits, orgUnitId])

  const {
    data: summary, isLoading, finalize, isFinalizing,
    reopen, isReopening, saveUserScore, isSavingUserScore,
    sendEvaluation, isSending,
  } = useUnitCycleSummary(cycleId, orgUnitId)

  const isFinalized = summary?.status === 'FINALIZED'

  // Chuỗi duyệt: đơn vị đang xem → các đơn vị cha lên tới gốc.
  // Server tính sẵn quyền chốt/mở khoá nên nút chỉ việc bám theo, thay vì
  // bấm rồi mới ăn 403.
  const { data: chain, isLoading: isChainLoading } = useCycleApprovalChain(cycleId, orgUnitId)
  const currentStep = chain?.find(s => s.current)

  // Giữ modal đồng bộ với dữ liệu mới sau khi lưu điểm.
  const activeMember = detailMember
    ? summary?.members.find(m => m.userId === detailMember.userId) || detailMember
    : null

  useEffect(() => { setComment(summary?.comment || '') }, [summary?.comment])

  const members = useMemo(() => {
    let list = [...(summary?.members || [])]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(m => m.userName?.toLowerCase().includes(q))
    }
    const dir = sortConfig.direction === 'asc' ? 1 : -1
    list.sort((a, b) => {
      if (sortConfig.key === 'userName') return (a.userName || '').localeCompare(b.userName || '') * dir
      const av = (a[sortConfig.key] ?? -1) as number
      const bv = (b[sortConfig.key] ?? -1) as number
      return (av - bv) * dir
    })
    return list
  }, [summary?.members, search, sortConfig])

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }))
  }

  const handleFinalize = async () => {
    try { await finalize(comment); setShowFinalize(false) } catch { /* toast in hook */ }
  }

  const [isExporting, setIsExporting] = useState(false)
  const handleExport = async () => {
    if (!summary) return
    setIsExporting(true)
    try {
      await exportCycleEvaluationToExcel(summary, { maxScore, getScoreLabel })
      toast.success('Đã xuất file Excel')
    } catch {
      toast.error('Xuất Excel thất bại')
    } finally {
      setIsExporting(false)
    }
  }

  // Xuất chi tiết của riêng 1 nhân viên (kèm điểm từng đợt trong kỳ).
  const [exportingUserId, setExportingUserId] = useState<string | null>(null)
  const handleExportMember = async (member: CycleUserEvaluation) => {
    if (!summary) return
    setExportingUserId(member.userId)
    try {
      await exportCycleMemberDetailToExcel(member, summary, { maxScore, getScoreLabel })
      toast.success(`Đã xuất chi tiết của ${member.userName}`)
    } catch {
      toast.error('Xuất Excel thất bại')
    } finally {
      setExportingUserId(null)
    }
  }

  /**
   * Kỳ đánh giá theo Định tính nhưng không có KPI định tính nào được chấm
   * ⇒ mọi điểm đều trống. Cảnh báo để người dùng biết cần tạo KPI định tính
   * hoặc đổi chế độ kỳ, thay vì tưởng hệ thống lỗi.
   */
  const noQualitativeData = !!summary
    && summary.mode === 'QUALITATIVE'
    && (summary.members?.length ?? 0) > 0
    && summary.members.every(m => m.selfScore == null && m.managerScore == null)

  // Chế độ Định tính: điểm hiển thị vốn là mức 0-5 đã quy đổi sang thang điểm.
  // Đảo ngược để hiện đúng mức gốc (VD 90 → 4.5/5) cho khỏi nhầm.
  const isQualMode = summary?.mode === 'QUALITATIVE'
  const toLevel = (v: number | null): number | null =>
    v == null || !maxScore ? null : Math.round((v / maxScore) * 5 * 100) / 100

  const LevelChip = ({ score }: { score: number | null }) => {
    const lv = toLevel(score)
    if (lv == null) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-black uppercase tracking-widest">Chưa có</span>
        </div>
      )
    }
    return (
      <div className="inline-flex items-center px-2.5 py-1.5 rounded-xl border border-indigo-100 dark:border-indigo-800/50 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm whitespace-nowrap">
        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{lv}</span>
        <span className="text-[10px] font-medium text-slate-400">/5</span>
      </div>
    )
  }

  /** Ô điểm tự đánh giá / QLTT / chốt — hiện mức 0-5 ở chế độ Định tính, còn lại hiện điểm. */
  const SideCell = ({ score }: { score: number | null }) =>
    isQualMode ? <LevelChip score={score} /> : <ScoreChip score={score} />

  /** Giá trị cho thẻ thống kê đầu trang, đổi sang mức 0-5 ở chế độ Định tính. */
  const statValue = (v: number | null | undefined): number | string => {
    if (v == null) return '—'
    const lv = toLevel(v)
    return isQualMode && lv != null ? `${lv}/5` : v
  }

  const ScoreChip = ({ score }: { score: number | null }) => {
    if (score == null) {
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
          <span className="text-[10px] font-black uppercase tracking-widest">Chưa có</span>
        </div>
      )
    }
    return (
      <div className={cn('inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border shadow-sm whitespace-nowrap', getScoreBg(score))}>
        <span className={cn('text-xs font-black', getScoreColor(score))}>{score}</span>
        <span className="text-[9px] font-black uppercase tracking-wide text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-1.5 leading-none whitespace-nowrap">
          {getScoreLabel(score)}
        </span>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8">
      <div className="max-w-[1600px] mx-auto space-y-8">

        {/* Header Section */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-[40px] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
          <div className="relative bg-white dark:bg-slate-900 rounded-[28px] p-6 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] shadow-sm">
                  <Award size={12} className="animate-pulse" /> Đánh giá cuối kỳ
                </div>
                <div className="space-y-0.5">
                  <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    Đánh Giá <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600">Kỳ</span>
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-medium text-sm max-w-xl leading-relaxed">
                    Tổng hợp điểm theo kỳ (trung bình các đợt) cho nhân viên và phòng ban.
                  </p>
                </div>
              </div>

              <div className={cn(
                'grid grid-cols-3 gap-2 sm:gap-3 w-full sm:w-auto',
                summary && summary.mode !== 'QUANTITATIVE' && 'sm:grid-cols-5'
              )}>
                <StatChip label="Thành viên" value={summary?.memberCount ?? 0} color="indigo" />
                <StatChip label={isQualMode ? 'Mức tự ĐG' : 'Điểm tự ĐG'} value={statValue(summary?.selfScore)} color="amber" />
                <StatChip label={isQualMode ? 'Mức chốt' : 'Điểm chốt'} value={statValue(summary?.managerScore)} color="emerald" />
                {summary && summary.mode !== 'QUANTITATIVE' && (
                  <>
                    <StatChip label="TB định tính" value={summary.qualScore != null ? `${summary.qualScore}/5` : '—'} color="indigo" />
                    <StatChip label="TB xếp loại" value={summary.matrixRating != null ? `${summary.matrixRating}/5` : '—'} color="amber" />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-5 rounded-[32px] border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
            <div className="relative flex-1 w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={18} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm nhân viên..."
                className="w-full pl-12 pr-4 h-13 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="flex flex-col md:flex-row items-center gap-3 w-full lg:w-auto">
              <div className="w-full md:w-72">
                <Select value={orgUnitId} onValueChange={setOrgUnitId}>
                  <SelectTrigger className="h-13 py-3.5 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <Building2 size={16} className="text-slate-400" />
                      <SelectValue placeholder="Chọn đơn vị..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-72">
                    {flatOrgUnits.map(unit => (
                      <SelectItem key={unit.id} value={unit.id} className="font-medium rounded-xl focus:bg-emerald-50">{unit.levelLabel}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full md:w-72">
                <Select value={cycleId} onValueChange={setCycleId}>
                  <SelectTrigger className="h-13 py-3.5 rounded-2xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 font-bold text-sm">
                    <div className="flex items-center gap-2">
                      <CalendarRange size={16} className="text-slate-400" />
                      <SelectValue placeholder="Chọn kỳ..." />
                    </div>
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 shadow-2xl p-2 max-h-72">
                    {cycles.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-medium rounded-xl focus:bg-emerald-50">{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Trạng thái chốt + hành động */}
          {summary && (
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              {/* Nhóm thông tin: co lại và cắt bớt khi hẹp, nhường chỗ cho nhóm nút.
                  Mỗi nhãn đều nowrap để không bị gãy giữa cụm từ như "Đã chốt · số đã lưu". */}
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 border border-slate-100 dark:border-slate-700 whitespace-nowrap">
                  Chế độ: {MODE_LABEL[summary.mode]}
                </span>

                {summary.status === 'FINALIZED' ? (
                  <span
                    title={summary.fromSnapshot ? 'Các con số là bản chụp lúc chốt — sửa đánh giá đợt cũ không làm đổi số này' : undefined}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-100 dark:border-emerald-800/50 whitespace-nowrap"
                  >
                    <CheckCircle2 size={12} /> Đã chốt{summary.fromSnapshot && ' · số đã lưu'}
                  </span>
                ) : (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-widest border border-amber-100 dark:border-amber-800/50 whitespace-nowrap">
                    Bản nháp
                  </span>
                )}

                {/* Người chốt + thời điểm tách khỏi huy hiệu: nhét chung làm huy hiệu
                    dài gấp ba và là thủ phạm khiến nó xuống dòng. */}
                {summary.status === 'FINALIZED' && (summary.finalizedByName || summary.finalizedAt) && (
                  <span className="text-[11px] font-bold text-slate-400 whitespace-nowrap">
                    {summary.finalizedByName}
                    {summary.finalizedByName && summary.finalizedAt && ' · '}
                    {summary.finalizedAt && format(parseISO(summary.finalizedAt), 'HH:mm dd/MM/yyyy')}
                  </span>
                )}

                {summary.comment && (
                  <span
                    title={summary.comment}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 min-w-0 max-w-xs"
                  >
                    <MessageSquare size={14} className="shrink-0" />
                    <span className="truncate">{summary.comment}</span>
                  </span>
                )}
              </div>

              {/* Nhóm nút: không cho co, luôn nằm trên một hàng riêng khi hẹp. */}
              <div className="flex flex-wrap items-center gap-2 lg:ml-auto shrink-0">
                <button
                  onClick={handleExport}
                  disabled={isExporting || !summary?.members?.length}
                  className="flex items-center justify-center gap-2 px-4 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50"
                >
                  <FileSpreadsheet size={14} /> {isExporting ? 'Đang xuất...' : 'Xuất Excel'}
                </button>
                {canSend && (
                  <button
                    onClick={() => setShowSend(true)}
                    disabled={!summary?.members?.length}
                    title="Gửi kết quả đánh giá kỳ qua email cho nhân viên"
                    className="flex items-center justify-center gap-2 px-4 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail size={14} /> Gửi đánh giá
                  </button>
                )}
                {canFinalize && (
                  isFinalized ? (
                    <button
                      onClick={() => reopen()}
                      disabled={isReopening || (!!currentStep && !currentStep.canReopen)}
                      title={currentStep?.canReopen === false ? currentStep.blockedReason || undefined : undefined}
                      className="flex items-center justify-center gap-2 px-5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LockOpen size={14} /> {isReopening ? 'Đang mở khoá...' : 'Mở khoá để chỉnh'}
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowFinalize(true)}
                      disabled={!!currentStep && !currentStep.canFinalize}
                      title={currentStep?.canFinalize === false ? currentStep.blockedReason || undefined : undefined}
                      className="flex items-center justify-center gap-2 px-5 h-11 rounded-2xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <Lock size={14} /> Chốt đánh giá phòng ban
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Luồng duyệt theo cấp: Trưởng đơn vị → các cấp trên → Giám đốc */}
        <CycleApprovalTimeline
          steps={chain || []}
          isLoading={isChainLoading}
          getScoreColor={getScoreColor}
          getScoreLabel={getScoreLabel}
          onSelectUnit={setOrgUnitId}
        />

        {/* Cảnh báo: chế độ Định tính nhưng chưa có KPI định tính nào được chấm */}
        {noQualitativeData && (
          <div className="flex items-start gap-3 p-5 rounded-[24px] bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 shadow-sm">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-black text-amber-700 dark:text-amber-400">Chưa có dữ liệu KPI định tính</p>
              <p className="text-xs font-medium text-amber-600/90 dark:text-amber-400/80 leading-relaxed">
                Kỳ này đang đánh giá theo <span className="font-black">Định tính</span>, nhưng các đợt trong kỳ chưa có
                chỉ tiêu KPI định tính nào được chấm mức nên toàn bộ điểm đang trống.
                Hãy tạo và chấm KPI định tính cho các đợt, hoặc đổi chế độ kỳ sang <span className="font-black">Định lượng</span> / <span className="font-black">Cả hai</span>.
              </p>
            </div>
          </div>
        )}

        {/* Content Section */}
        {!cycleId || !orgUnitId ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState title="Chọn kỳ và phòng ban" description="Hãy chọn một kỳ đánh giá và một phòng ban để xem tổng hợp." />
          </div>
        ) : isLoading ? (
          <div className="bg-white dark:bg-slate-900 rounded-[32px] p-8 border border-slate-100 dark:border-slate-800 shadow-sm">
            <LoadingSkeleton type="table" rows={8} />
          </div>
        ) : members.length === 0 ? (
          <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md rounded-[40px] border border-dashed border-slate-300 dark:border-slate-700 p-24 shadow-sm text-center">
            <EmptyState
              title="Không có nhân sự"
              description={search ? 'Không tìm thấy nhân viên phù hợp.' : 'Phòng ban này chưa có nhân sự để tổng hợp.'}
            />
          </div>
        ) : (
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-[32px] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl">
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 whitespace-nowrap cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('userName')}>
                      <div className="flex items-center gap-2">Nhân viên <SortIcon column="userName" current={sortConfig} /></div>
                    </th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('selfScore')}>
                      <div className="flex items-center justify-center gap-2">Nhân viên tự đánh giá <SortIcon column="selfScore" current={sortConfig} /></div>
                    </th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('managerScore')}>
                      <div className="flex items-center justify-center gap-2">Cán bộ QLTT đánh giá <SortIcon column="managerScore" current={sortConfig} /></div>
                    </th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap cursor-pointer hover:text-emerald-600 transition-colors" onClick={() => handleSort('finalScore')}>
                      <div className="flex items-center justify-center gap-2">Điểm chốt kỳ <SortIcon column="finalScore" current={sortConfig} /></div>
                    </th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Định tính</th>
                    <th className="px-3 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center whitespace-nowrap">Xếp loại</th>
                    <th className="px-4 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                  {members.map((m: CycleUserEvaluation) => (
                    <Fragment key={m.userId}>
                      <tr
                        onClick={() => setDetailMember(m)}
                        className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              fullName={m.userName}
                              avatarUrl={m.userAvatarUrl}
                              className="w-10 h-10 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/30 shadow-inner"
                              fallbackClassName="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 font-black text-xs text-indigo-600 dark:text-indigo-400"
                            />
                            <div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors block whitespace-nowrap">{m.userName}</span>
                              <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{m.orgUnitName || 'Nhân viên'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center"><SideCell score={m.selfScore} /></td>
                        <td className="px-3 py-4 text-center"><SideCell score={m.managerScore} /></td>
                        <td className="px-3 py-4 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <SideCell score={m.finalScore} />
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              {m.finalScoreOverridden && (
                                <span className="text-[8px] font-black uppercase tracking-tight text-indigo-500 whitespace-nowrap">Đã chỉnh tay</span>
                              )}
                              {m.locked && (
                                <span
                                  title={`Đã chốt ở đơn vị "${m.lockedByUnitName}"`}
                                  className="inline-flex items-center gap-0.5 text-[8px] font-black uppercase tracking-tight text-emerald-600 whitespace-nowrap"
                                >
                                  <Lock size={9} /> Đã khoá
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center">
                          {m.qualScore != null
                            ? <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">{m.qualScore}<span className="text-slate-400 font-medium">/5</span></span>
                            : <span className="text-xs font-bold text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-3 py-4 text-center">
                          {m.matrixRating != null
                            ? <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 text-xs font-black">
                                {m.matrixRating}<span className="text-slate-400 font-medium">/5</span>
                              </span>
                            : <span className="text-xs font-bold text-slate-300 dark:text-slate-600">—</span>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                              disabled={exportingUserId === m.userId}
                              title={`Xuất chi tiết đánh giá kỳ của ${m.userName}`}
                              className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {exportingUserId === m.userId
                                ? <Loader2 size={18} className="animate-spin" />
                                : <Download size={18} />}
                            </button>
                            <button className="p-2.5 text-slate-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all shadow-sm border border-transparent hover:border-emerald-200 dark:hover:border-slate-700">
                              <ChevronRight size={20} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800/50">
              {members.map((m: CycleUserEvaluation) => (
                <div key={m.userId} className="p-5 space-y-4" onClick={() => setDetailMember(m)}>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      fullName={m.userName}
                      avatarUrl={m.userAvatarUrl}
                      className="w-10 h-10 rounded-2xl border border-indigo-200/50 dark:border-indigo-800/30"
                      fallbackClassName="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 font-black text-xs text-indigo-600 dark:text-indigo-400"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-slate-900 dark:text-white block truncate">{m.userName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{m.orgUnitName || 'Nhân viên'}</span>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                      disabled={exportingUserId === m.userId}
                      title={`Xuất chi tiết đánh giá kỳ của ${m.userName}`}
                      className="p-2 text-slate-400 hover:text-emerald-600 rounded-xl transition-colors disabled:opacity-50"
                    >
                      {exportingUserId === m.userId
                        ? <Loader2 size={16} className="animate-spin" />
                        : <Download size={16} />}
                    </button>
                    <ChevronRight size={18} className="text-slate-400" />
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tự ĐG</span>
                      <SideCell score={m.selfScore} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">QLTT</span>
                      <SideCell score={m.managerScore} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Chốt</span>
                      <SideCell score={m.finalScore} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal chấm điểm chốt kỳ của 1 nhân viên */}
        {activeMember && (
          <UserScoreModal
            member={activeMember}
            maxScore={maxScore}
            getScoreColor={getScoreColor}
            getScoreLabel={getScoreLabel}
            canEdit={canFinalize && !activeMember.locked}
            lockedByUnitName={activeMember.locked ? activeMember.lockedByUnitName : null}
            isSaving={isSavingUserScore}
            onClose={() => setDetailMember(null)}
            onSave={async (finalScore, qualScore, cmt) => {
              await saveUserScore({ userId: activeMember.userId, finalScore, qualScore, comment: cmt })
            }}
            cycleName={summary?.cycleName}
          />
        )}

        {/* Finalize dialog */}
        {showFinalize && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={() => setShowFinalize(false)} />
            <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-md p-8 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-[18px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Lock size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Chốt đánh giá phòng ban</h3>
                  <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Điểm sẽ được lưu snapshot</p>
                </div>
              </div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nhận xét (tuỳ chọn)</label>
              <textarea
                value={comment} onChange={e => setComment(e.target.value)} rows={3}
                placeholder="Nhận xét tổng thể cho phòng ban trong kỳ..."
                className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 resize-none"
              />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowFinalize(false)} className="flex-1 px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800">Huỷ</button>
                <button onClick={handleFinalize} disabled={isFinalizing} className="flex-1 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                  {isFinalizing ? 'Đang chốt...' : 'Xác nhận chốt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Render có điều kiện để lựa chọn nhân viên tự reset mỗi lần mở lại. */}
        {showSend && (
          <SendEvaluationModal
            onClose={() => setShowSend(false)}
            members={summary?.members || []}
            cycleName={summary?.cycleName}
            orgUnitName={summary?.orgUnitName}
            isFinalized={isFinalized}
            isSending={isSending}
            onSend={sendEvaluation}
          />
        )}
      </div>
    </div>
  )
}

/** Modal xem chi tiết & nhập điểm chốt kỳ cho một nhân viên. */
function UserScoreModal({
  member, maxScore, getScoreColor, getScoreLabel, canEdit, lockedByUnitName, isSaving, onClose, onSave, cycleName,
}: {
  member: CycleUserEvaluation
  maxScore: number
  getScoreColor: (score: number | null) => string
  getScoreLabel: (score: number | null) => string
  canEdit: boolean
  lockedByUnitName: string | null
  isSaving: boolean
  onClose: () => void
  onSave: (finalScore: number | null, qualScore: number | null, comment: string) => Promise<void>
  /** Điền sẵn vào lý do thưởng để ghi chú trong sổ điểm có ngữ cảnh. */
  cycleName?: string
}) {
  const [score, setScore] = useState<string>(member.finalScore != null ? String(member.finalScore) : '')
  const [qual, setQual] = useState<string>(member.qualScore != null ? String(member.qualScore) : '')
  const [comment, setComment] = useState(member.comment || '')
  const [saved, setSaved] = useState(false)

  const suggested = member.managerScore
  const parsed = score.trim() === '' ? null : Number(score)
  const invalid = parsed != null && (Number.isNaN(parsed) || parsed < 0 || parsed > maxScore)
  // Vị trí nút kéo: chưa nhập thì đứng ở điểm TB gợi ý, nhập rồi thì kẹp vào [0, maxScore]
  // để nút không văng ra ngoài khi gõ số quá thang điểm.
  const sliderScore = parsed == null || Number.isNaN(parsed)
    ? (suggested != null ? Math.min(Math.max(suggested, 0), maxScore) : 0)
    : Math.min(Math.max(parsed, 0), maxScore)

  // Trung bình các chiều tham chiếu trên những đợt có dữ liệu (bỏ qua đợt trống).
  const avgOf = (pick: (p: CyclePeriodBreakdown) => number | null): number | null => {
    const nums = (member.periodBreakdown || []).map(pick).filter((v): v is number => v != null)
    if (!nums.length) return null
    return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 100) / 100
  }
  const avgQuant = avgOf(p => p.quantScore)
  const avgQual = avgOf(p => p.qualScore)
  const avgMatrix = avgOf(p => p.matrixRating)
  const hasDimensionAvg = avgQuant != null || avgQual != null || avgMatrix != null

  const parsedQual = qual.trim() === '' ? null : Number(qual)
  const qualInvalid = parsedQual != null && (Number.isNaN(parsedQual) || parsedQual < 0 || parsedQual > 5)

  // Chế độ kỳ quyết định chấm chiều nào: Định lượng → chỉ điểm; Định tính → chỉ mức 0-5;
  // Cả hai → chấm cả hai rồi quy ra ma trận.
  const showQuant = member.mode === 'QUANTITATIVE' || member.mode === 'BOTH'
  const showQual = member.mode === 'QUALITATIVE' || member.mode === 'BOTH'

  // Ở chế độ Định tính, điểm tự ĐG/QLTT vốn là mức 0-5 đã quy đổi ⇒ hiện lại mức gốc.
  const isQualMode = member.mode === 'QUALITATIVE'
  const sideDisplay = (v: number | null) => {
    if (v == null) return '—'
    if (!isQualMode) return v
    const lv = Math.round((v / maxScore) * 5 * 100) / 100
    return <>{lv}<span className="text-slate-400 text-base font-medium">/5</span></>
  }

  // Lưu xong KHÔNG đóng ngay: hiện lời mời thưởng điểm ngay tại chỗ. Đây là lúc người
  // chấm còn nhớ rõ nhất vì sao nhân viên xứng đáng — bắt họ sang màn hình khác thưởng
  // sau thì gần như chắc chắn sẽ quên.
  const handleSave = async () => {
    if (invalid || qualInvalid) return
    await onSave(parsed, parsedQual, comment)
    setSaved(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <UserAvatar
              fullName={member.userName}
              avatarUrl={member.userAvatarUrl}
              className="w-12 h-12 rounded-2xl border border-indigo-200/50"
              fallbackClassName="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-900/40 font-black text-sm text-indigo-600 dark:text-indigo-400"
            />
            <div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">{member.userName}</h3>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                {member.orgUnitName || 'Nhân viên'} · Chế độ {MODE_LABEL[member.mode]}
              </p>
            </div>
          </div>

          {/* Điểm tham chiếu */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Nhân viên tự đánh giá</span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-200 tracking-tighter">
                {sideDisplay(member.selfScore)}
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">QLTT (TB các đợt)</span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-200 tracking-tighter">
                {sideDisplay(member.managerScore)}
              </span>
            </div>
          </div>

          {/* Trung bình từng chiều — tham chiếu, không dùng để tính điểm chốt. */}
          {hasDimensionAvg && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">TB định lượng</span>
                <span className="text-lg font-black text-slate-700 dark:text-slate-200 tracking-tighter">{avgQuant ?? '—'}</span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/30">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">TB định tính</span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">
                  {avgQual != null ? <>{avgQual}<span className="text-slate-400 text-xs font-medium">/5</span></> : '—'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">TB xếp loại</span>
                <span className="text-lg font-black text-amber-600 dark:text-amber-400 tracking-tighter">
                  {avgMatrix != null ? <>{avgMatrix}<span className="text-slate-400 text-xs font-medium">/5</span></> : '—'}
                </span>
              </div>
            </div>
          )}

          {/* Chi tiết từng đợt */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Chi tiết từng đợt</span>
            <PeriodBreakdownTable member={member} maxScore={maxScore} />
          </div>

          {/* Nhập điểm chốt — chỉ ở chế độ có chiều định lượng */}
          {showQuant && (
          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Điểm chốt kỳ {canEdit && <span className="text-red-500">*</span>}
              </label>
              {canEdit && suggested != null && (
                <button type="button" onClick={() => setScore(String(suggested))} className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:text-emerald-700">
                  Dùng điểm TB ({suggested})
                </button>
              )}
            </div>
            <div className={cn(
              'rounded-[28px] border bg-slate-50/50 dark:bg-slate-800/40 px-6 py-6 space-y-5 text-center',
              invalid ? 'border-rose-200 dark:border-rose-900/50' : 'border-slate-100 dark:border-slate-800'
            )}>
              <div className="space-y-1.5">
                {/* Điểm hiện tại — mờ đi khi chưa chấm để phân biệt với điểm đã chọn. */}
                <div className={cn(
                  'text-6xl font-black tracking-tighter transition-all duration-300',
                  parsed == null ? 'text-slate-300 dark:text-slate-700' : getScoreColor(invalid ? null : parsed)
                )}>
                  {parsed != null ? parsed : sliderScore}
                </div>
                <p className={cn(
                  'text-xs font-black uppercase tracking-[0.2em]',
                  parsed == null ? 'text-slate-400' : getScoreColor(invalid ? null : parsed)
                )}>
                  {getScoreLabel(invalid ? null : parsed)}
                </p>
                {/* So sánh với điểm TB các đợt để thấy ngay mình đang nâng hay hạ tay. */}
                {parsed != null && !invalid && suggested != null && parsed !== suggested && (
                  <span className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest',
                    parsed > suggested
                      ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/20'
                  )}>
                    {parsed > suggested ? '+' : ''}{Math.round((parsed - suggested) * 100) / 100} điểm so với TB
                  </span>
                )}
              </div>

              {canEdit && (
                <div className="relative px-2">
                  {/* Vạch mốc điểm TB các đợt: canh theo tâm nút kéo (rộng ~16px). */}
                  {suggested != null && suggested >= 0 && suggested <= maxScore && maxScore > 0 && (
                    <div
                      className="absolute top-0 h-2 w-0.5 rounded-full bg-slate-400/70 dark:bg-slate-500 pointer-events-none"
                      style={{ left: `calc(8px + ${(suggested / maxScore) * 100}% - ${(suggested / maxScore) * 16}px - 1px)` }}
                      title={`Điểm TB các đợt: ${suggested}`}
                    />
                  )}
                  <input
                    type="range" min={0} max={maxScore} step={1}
                    value={sliderScore}
                    onChange={e => setScore(e.target.value)}
                    className="w-full accent-emerald-600 h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    <span>0</span>
                    <span>{Math.round(maxScore / 2)}</span>
                    <span>{maxScore}</span>
                  </div>
                </div>
              )}
            </div>
            {invalid && (
              <p className="text-[11px] font-bold text-rose-500 ml-1">
                Điểm cũ ({parsed}) nằm ngoài khoảng 0 – {maxScore}, hãy kéo lại thanh điểm.
              </p>
            )}
          </div>
          )}

          {/* Chấm định tính cấp kỳ + xếp loại ma trận suy ra */}
          {showQual && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Chấm định tính (0–5)
              </label>
              <input
                type="number" step="0.1" min={0} max={5}
                value={qual}
                disabled={!canEdit}
                onChange={e => setQual(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Chưa chấm"
                className={cn(
                  'w-full px-5 py-4 rounded-2xl border bg-slate-50/50 dark:bg-slate-800/50 text-lg font-black outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-70',
                  qualInvalid ? 'border-rose-300 focus:border-rose-400' : 'border-slate-100 dark:border-slate-800 focus:border-indigo-500/50'
                )}
              />
              {qualInvalid && <p className="text-[11px] font-bold text-rose-500 ml-1">Mức định tính phải từ 0 đến 5</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
                Xếp loại ma trận
              </label>
              <div className="w-full px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30 flex items-center gap-3">
                {member.matrixRating != null ? (
                  <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                    {member.matrixRating}<span className="text-slate-400 text-sm font-medium">/5</span>
                  </span>
                ) : (
                  <span className="text-lg font-black text-slate-300">—</span>
                )}
                <span className="text-[10px] text-slate-400 font-medium leading-tight">
                  {member.avgCompletionPercent != null
                    ? <>Trục cột: TB hoàn thành <span className="font-black">{member.avgCompletionPercent}%</span></>
                    : 'Chưa có % hoàn thành định lượng'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium ml-1 leading-relaxed">
                Tự suy ra từ ma trận hiệu suất của tổ chức khi bấm Lưu — giao giữa mức định tính và TB % hoàn thành định lượng.
              </p>
            </div>
          </div>
          )}

          {!canEdit && (
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium ml-1">
              <Lock size={12} />
              {lockedByUnitName
                ? `Đơn vị "${lockedByUnitName}" đã chốt — chỉ xem. Hãy chọn đơn vị đó và bấm "Mở khoá để chỉnh" nếu cần sửa.`
                : 'Bạn không có quyền chấm điểm kỳ.'}
            </p>
          )}

          {/* Nhận xét */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Nhận xét</label>
            <textarea
              value={comment} onChange={e => setComment(e.target.value)} rows={3} disabled={!canEdit}
              placeholder="Nhận xét cho nhân viên trong kỳ này..."
              className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-sm font-medium outline-none focus:ring-4 focus:ring-emerald-500/10 resize-none disabled:opacity-70"
            />
          </div>

          {member.evaluatedByName && (
            <p className="text-[11px] text-slate-400 font-medium">
              Chấm bởi <span className="font-black text-slate-500">{member.evaluatedByName}</span>
              {member.evaluatedAt && ` · ${format(parseISO(member.evaluatedAt), 'HH:mm dd/MM/yyyy')}`}
            </p>
          )}

          {/* Sau khi lưu điểm mới mời thưởng — tự ẩn nếu tổ chức tắt tính năng thưởng
              hoặc người chấm không có quyền trao. */}
          {saved && (
            <RewardPrompt
              userId={member.userId}
              fullName={member.userName || ''}
              defaultReason={`Thành tích nổi bật trong kỳ${cycleName ? ` ${cycleName}` : ''}`}
              onDone={onClose}
            />
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 px-6 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800">
              Đóng
            </button>
            {canEdit && !saved && (
              <button onClick={handleSave} disabled={isSaving || invalid} className="flex-1 px-6 py-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                {isSaving ? 'Đang lưu...' : 'Lưu điểm chốt'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Chi tiết điểm từng đợt trong kỳ của một nhân viên. */
function PeriodBreakdownTable({ member, maxScore }: { member: CycleUserEvaluation; maxScore: number }) {
  if (!member.periodBreakdown?.length) {
    return <p className="text-xs text-slate-400 italic px-1 py-2">Kỳ này chưa có đợt nào được gán.</p>
  }
  // Chế độ "Cả hai": tách riêng 2 chiều để thấy rõ phần định lượng và định tính.
  const showDimensions = member.mode === 'BOTH'
  // Chế độ Định tính: hiện lại mức gốc 0-5 thay vì số đã quy đổi sang thang điểm.
  const isQualMode = member.mode === 'QUALITATIVE'
  const side = (v: number | null) => {
    if (v == null) return '—'
    if (!isQualMode) return v
    return `${Math.round((v / maxScore) * 5 * 100) / 100}/5`
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-800/50">
              <th className="px-4 py-2.5">Đợt</th>
              {showDimensions && <th className="px-4 py-2.5 text-center">Định lượng</th>}
              {showDimensions && <th className="px-4 py-2.5 text-center">Định tính</th>}
              {showDimensions && <th className="px-4 py-2.5 text-center">Xếp loại</th>}
              <th className="px-4 py-2.5 text-center">Tự đánh giá</th>
              <th className="px-4 py-2.5 text-center">QLTT đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {member.periodBreakdown.map(p => (
              <tr key={p.periodId} className="border-t border-slate-50 dark:border-slate-800/50">
                <td className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300">{p.periodName}</td>
                {showDimensions && (
                  <td className="px-4 py-2.5 text-xs font-bold text-slate-500 text-center">{p.quantScore ?? '—'}</td>
                )}
                {showDimensions && (
                  <td className="px-4 py-2.5 text-xs font-bold text-center">
                    {p.qualScore != null
                      ? <span className="text-indigo-600 dark:text-indigo-400">{p.qualScore}<span className="text-slate-400 font-medium">/5</span></span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                )}
                {showDimensions && (
                  <td className="px-4 py-2.5 text-xs font-bold text-center">
                    {p.matrixRating != null
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50">
                          {p.matrixRating}<span className="text-slate-400 font-medium">/5</span>
                        </span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                )}
                <td className="px-4 py-2.5 text-xs font-bold text-slate-500 text-center">{side(p.selfScore)}</td>
                <td className="px-4 py-2.5 text-xs font-bold text-slate-500 text-center">{side(p.managerScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showDimensions && (
        <p className="text-[10px] text-slate-400 font-medium px-1 leading-relaxed">
          <span className="font-black">Định lượng</span> là điểm hệ thống tính từ KPI định lượng;{' '}
          <span className="font-black">Định tính</span> là mức trung bình có trọng số của KPI định tính (thang 0–5);{' '}
          <span className="font-black">Xếp loại</span> là kết quả ma trận hiệu suất giao giữa hai trục đó (chỉ có khi đợt đủ cả hai).
          Ba cột này để tham chiếu — điểm chốt kỳ lấy trung bình cột QLTT đánh giá.
        </p>
      )}
    </div>
  )
}

function SortIcon({ column, current }: { column: string; current: { key: string; direction: 'asc' | 'desc' } }) {
  if (current.key !== column) return <ArrowUpDown size={12} className="opacity-40" />
  return current.direction === 'asc'
    ? <ArrowUp size={12} className="text-emerald-500" />
    : <ArrowDown size={12} className="text-emerald-500" />
}

function StatChip({ label, value, color }: { label: string; value: number | string; color: 'amber' | 'emerald' | 'red' | 'indigo' }) {
  const colorMap = {
    amber: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/30',
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
  }
  return (
    <div className={cn(
      'flex flex-col items-center justify-center min-w-0 px-2 sm:px-4 py-2.5 rounded-2xl border backdrop-blur-sm transition-all hover:scale-105 duration-300',
      colorMap[color]
    )}>
      <span className="text-xl font-black tracking-tighter">{value}</span>
      <span className="text-[9px] font-bold uppercase tracking-widest opacity-60 truncate">{label}</span>
    </div>
  )
}
