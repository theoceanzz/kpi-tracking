import { useState, useMemo, useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '../hooks/useKpiCycles'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest } from '@/components/common/dateScope'
import { useUnitCycleSummary, useCycleApprovalChain } from '../hooks/useCycleEvaluation'
import CycleApprovalTimeline from '../components/CycleApprovalTimeline'
import CycleBellCurveCard from '../components/CycleBellCurveCard'
import FinalizeUnitDialog from '../components/FinalizeUnitDialog'
import SendEvaluationModal from '../components/SendEvaluationModal'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { getScoringFunctions, SCORING_POOL } from '@/lib/scoring'
import { exportCycleEvaluationToExcel, exportCycleMemberDetailToExcel } from '../utils/cycleEvaluationExport'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import FilterBar from '@/components/common/FilterBar'
import { SortHeader } from '@/components/common/SortHeader'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import UserAvatar from '@/components/common/UserAvatar'
import { format, parseISO } from 'date-fns'
import type { CycleEvaluationMode, CycleUserEvaluation, CyclePeriodBreakdown } from '@/types/kpi'
import RewardPrompt from '@/features/rewards/components/RewardPrompt'
import { useCanPromptReward } from '@/features/rewards/hooks/useCanPromptReward'
import EvidenceAttachments from '@/features/evidence/EvidenceAttachments'
import { evidenceKey } from '@/features/evidence/evidenceApi'
import ConductInlineSheet, { type ConductSheetHandle } from '@/features/conduct/components/ConductInlineSheet'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  CalendarRange, Building2, Award, ChevronRight, CheckCircle2, Lock, LockOpen, MessageSquare,
  AlertTriangle, FileSpreadsheet, Download, Loader2, Mail, PenLine, Users } from 'lucide-react'

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
  const { getScoreColor, getScoreLabel, maxScore } = getScoringFunctions(org)

  const { data: cyclesData } = useKpiCycles({ organizationId: orgId, size: 100, sortBy: 'startDate', direction: 'desc' })
  // Memo hoá vì effect chọn sẵn kỳ mặc định phụ thuộc mảng này — không memo thì mảng đổi
  // tham chiếu mỗi lần render và effect chạy lại vô ích sau mỗi phím gõ ở ô tìm kiếm.
  const cycles = useMemo(() => cyclesData?.content ?? [], [cyclesData])

  const { data: orgUnitTreeData } = useOrgUnitTree()
  const flatOrgUnits = useMemo(() => orgUnitTreeData ? flattenTree(orgUnitTreeData) : [], [orgUnitTreeData])

  const [cycleId, setCycleId] = useState<string>('')
  const [orgUnitId, setOrgUnitId] = useState<string>(user?.memberships?.[0]?.orgUnitId || '')
  const [search, setSearch] = useState('')
  const [detailMember, setDetailMember] = useState<CycleUserEvaluation | null>(null)
  const [showFinalize, setShowFinalize] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'userName', direction: 'asc' })

  // Chọn sẵn kỳ đang chạy; đang ở kẽ giữa hai kỳ thì giữ nguyên kỳ vừa kết thúc.
  const defaultCycle = useMemo(() => pickCurrentOrNearest(cycles), [cycles])
  useEffect(() => { if (!cycleId && defaultCycle) setCycleId(defaultCycle.id) }, [defaultCycle, cycleId])
  useEffect(() => { if (!orgUnitId && flatOrgUnits.length) setOrgUnitId(flatOrgUnits[0].id) }, [flatOrgUnits, orgUnitId])

  const {
    data: summary, isLoading, finalize,
    reopen, isReopening, saveUserScore, isSavingUserScore,
    saveUnitScore,
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


  const [isExporting, setIsExporting] = useState(false)
  const handleExport = async () => {
    if (!summary) return
    setIsExporting(true)
    try {
      await exportCycleEvaluationToExcel(summary, { getScoreLabel })
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
      await exportCycleMemberDetailToExcel(member, summary, { getScoreLabel })
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

  // Chế độ Định tính: điểm hiển thị vốn là mức 0-5 đã quy đổi sang pool chấm.
  // Đảo ngược để hiện đúng mức gốc (VD 90 → 4.5/5) cho khỏi nhầm.
  const isQualMode = summary?.mode === 'QUALITATIVE'
  const toLevel = (v: number | null): number | null =>
    v == null ? null : Math.round((v / SCORING_POOL) * 5 * 100) / 100

  /** Ô điểm tự đánh giá / QLTT / chốt — hiện mức 0-5 ở chế độ Định tính, còn lại hiện điểm + nhãn xếp loại. */
  const SideCell = ({ score }: { score: number | null }) => {
    if (score == null) return <span className="text-caption">Chưa có</span>
    if (isQualMode) {
      const lv = toLevel(score)
      return <span className="text-sm font-medium tabular-nums text-[var(--color-foreground)]">{lv}<span className="text-caption">/5</span></span>
    }
    return (
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={cn('text-sm font-semibold tabular-nums', getScoreColor(score))}>{score}</span>
        <span className="text-caption">{getScoreLabel(score)}</span>
      </span>
    )
  }

  /** Giá trị cho thẻ thống kê đầu trang, đổi sang mức 0-5 ở chế độ Định tính. */
  const statValue = (v: number | null | undefined): number | string => {
    if (v == null) return '—'
    const lv = toLevel(v)
    return isQualMode && lv != null ? `${lv}/5` : v
  }

  const sortActive = sortConfig.key
  const sortDir = sortConfig.direction

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
        <WorkspaceHeader
          id="tour-cycleeval-header"
          title="Đánh giá kỳ"
          description="Tổng hợp điểm theo kỳ (trung bình các đợt) cho nhân viên và đơn vị; chốt xếp loại đơn vị khi kết thúc kỳ."
          stats={[
            { label: 'Thành viên', value: summary?.memberCount ?? 0, icon: Users },
            { label: isQualMode ? 'Mức tự đánh giá' : 'Điểm tự đánh giá', value: statValue(summary?.selfScore) },
            { label: isQualMode ? 'Mức chốt' : 'Điểm chốt', value: statValue(summary?.managerScore) },
            ...(summary && summary.mode !== 'QUANTITATIVE'
              ? [
                  { label: 'TB định tính', value: summary.qualScore != null ? `${summary.qualScore}/5` : '—' },
                  { label: 'TB xếp loại', value: summary.matrixRating != null ? `${summary.matrixRating}/5` : '—' },
                ]
              : []),
            /* Xếp loại đơn vị đứng cuối dãy số liệu, tô theo màu hạng — cùng một khối với các con số
               làm ra nó, thay vì một thẻ riêng rớt xuống hàng dưới. */
            ...(summary?.classification
              ? [{
                  label: summary.status === 'FINALIZED' ? 'Xếp loại · đã chốt' : 'Xếp loại · tạm tính',
                  value: (
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: summary.classificationColor ?? undefined }}
                      title={[
                        summary.status === 'FINALIZED' ? 'Xếp loại chụp lúc chốt kỳ' : 'Xếp loại tạm tính theo điểm kỳ hiện tại — sẽ được chốt cùng đánh giá phòng ban',
                        summary.classificationProfileName && `Hồ sơ: ${summary.classificationProfileName}`,
                      ].filter(Boolean).join(' · ')}
                    >
                      <Award size={15} aria-hidden="true" />
                      {summary.classification}
                    </span>
                  ),
                }]
              : []),
          ]}
        />

        <FilterBar
          id="tour-cycleeval-toolbar"
          search={{ value: search, onChange: setSearch, placeholder: 'Tìm nhân viên…' }}
          trailing={
            <div id="tour-cycleeval-actions" className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || !summary?.members?.length}>
                <FileSpreadsheet aria-hidden="true" /> {isExporting ? 'Đang xuất…' : 'Xuất Excel'}
              </Button>
              {canSend && (
                <Button variant="outline" size="sm" onClick={() => setShowSend(true)} disabled={!summary?.members?.length} title="Gửi kết quả đánh giá kỳ qua email cho nhân viên">
                  <Mail aria-hidden="true" /> Gửi đánh giá
                </Button>
              )}
              {canFinalize && (
                isFinalized ? (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => reopen()}
                    disabled={isReopening || (!!currentStep && !currentStep.canReopen)}
                    title={currentStep?.canReopen === false ? currentStep.blockedReason || undefined : undefined}
                  >
                    <LockOpen aria-hidden="true" /> {isReopening ? 'Đang mở khoá…' : 'Mở khoá để chỉnh'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setShowFinalize(true)}
                    disabled={!!currentStep && !currentStep.canFinalize}
                    title={currentStep?.canFinalize === false ? currentStep.blockedReason || undefined : undefined}
                  >
                    <Lock aria-hidden="true" /> Chốt đánh giá phòng ban
                  </Button>
                )
              )}
            </div>
          }
        >
          <Select value={orgUnitId} onValueChange={setOrgUnitId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-60" aria-label="Đơn vị">
              <Building2 size={15} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              <SelectValue placeholder="Chọn đơn vị" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {flatOrgUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.levelLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-60" aria-label="Kỳ đánh giá">
              <CalendarRange size={15} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              <SelectValue placeholder="Chọn kỳ" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <ScopeSelectItems items={cycles} selectedId={cycleId} noun="kỳ" />
            </SelectContent>
          </Select>
        </FilterBar>

        {/* Trạng thái chốt của đơn vị trong kỳ — một dòng, đọc trước khi nhìn bảng. */}
        {summary && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">Chế độ: {MODE_LABEL[summary.mode]}</Badge>
            {summary.status === 'FINALIZED' ? (
              <Badge variant="success" title={summary.fromSnapshot ? 'Các con số là bản chụp lúc chốt — sửa đánh giá đợt cũ không làm đổi số này' : undefined}>
                <CheckCircle2 size={12} aria-hidden="true" /> Đã chốt{summary.fromSnapshot && ' · số đã lưu'}
              </Badge>
            ) : (
              <Badge variant="warning">Bản nháp</Badge>
            )}
            {summary.status === 'FINALIZED' && (summary.finalizedByName || summary.finalizedAt) && (
              <span className="text-caption whitespace-nowrap">
                {summary.finalizedByName}
                {summary.finalizedByName && summary.finalizedAt && ' · '}
                {summary.finalizedAt && format(parseISO(summary.finalizedAt), 'HH:mm dd/MM/yyyy')}
              </span>
            )}
            {/* Điểm đơn vị được chấm tay là thứ phải nhìn thấy ngay ở trang — đọc số mà
                không biết có người can thiệp thì không giải thích được cho ai. */}
            {summary.overrideScore != null && (
              <Badge
                variant="info"
                title={[summary.overrideReason, summary.overriddenByName && ` — ${summary.overriddenByName}`].filter(Boolean).join(' ') || undefined}
              >
                <PenLine size={12} aria-hidden="true" /> Chấm tay {summary.overrideScore}
                {summary.autoScore != null && <span className="opacity-70">· TB {summary.autoScore}</span>}
              </Badge>
            )}
            {summary.comment && (
              <span title={summary.comment} className="flex min-w-0 max-w-xs items-center gap-1.5 text-caption">
                <MessageSquare size={14} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{summary.comment}</span>
              </span>
            )}
          </div>
        )}

        {/* Luồng duyệt theo cấp: Trưởng đơn vị → các cấp trên → Giám đốc */}
        <div id="tour-cycleeval-chain">
        <CycleApprovalTimeline
          steps={chain || []}
          isLoading={isChainLoading}
          getScoreColor={getScoreColor}
          getScoreLabel={getScoreLabel}
          onSelectUnit={setOrgUnitId}
        />
        </div>

        {/* Phân bố mức của phòng: thứ người chốt kỳ cần nhìn trước khi quyết định điểm đơn vị.
            Chính ô chấm điểm đơn vị đã dọn vào hộp thoại "Chốt đánh giá phòng ban" — chấm rồi
            chốt vốn là một nhịp, để hai chỗ chỉ tổ quên bấm lưu. */}
        {summary?.bellCurve && (
          <CycleBellCurveCard curve={summary.bellCurve} orgUnitName={summary.orgUnitName} />
        )}

        {/* Cảnh báo: chế độ Định tính nhưng chưa có KPI định tính nào được chấm */}
        {noQualitativeData && (
          <div className="flex items-start gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-medium">Chưa có dữ liệu KPI định tính</p>
              <p>
                Kỳ này đang đánh giá theo <b className="font-medium">Định tính</b>, nhưng các đợt trong kỳ chưa có
                chỉ tiêu KPI định tính nào được chấm mức nên toàn bộ điểm đang trống.
                Hãy tạo và chấm KPI định tính cho các đợt, hoặc đổi chế độ kỳ sang <b className="font-medium">Định lượng</b> / <b className="font-medium">Cả hai</b>.
              </p>
            </div>
          </div>
        )}

        {/* Bảng thành viên */}
        {!cycleId || !orgUnitId ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Users} title="Chọn kỳ và đơn vị" description="Chọn một kỳ đánh giá và một đơn vị ở thanh lọc để xem tổng hợp." />
          </div>
        ) : isLoading ? (
          <LoadingSkeleton type="table" rows={8} />
        ) : members.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={Users}
              title={search ? 'Không tìm thấy nhân viên' : 'Đơn vị chưa có nhân sự'}
              description={search ? 'Thử từ khoá khác hoặc xoá tìm kiếm.' : 'Đơn vị này chưa có nhân sự để tổng hợp.'}
            />
          </div>
        ) : (
          <>
            <div id="tour-cycleeval-table" className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="userName" active={sortActive} dir={sortDir} onToggle={handleSort}>Nhân viên</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="selfScore" active={sortActive} dir={sortDir} onToggle={handleSort}>Tự đánh giá</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="managerScore" active={sortActive} dir={sortDir} onToggle={handleSort}>Quản lý trực tiếp</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="finalScore" active={sortActive} dir={sortDir} onToggle={handleSort}>Điểm chốt kỳ</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Định tính</th>
                    <th scope="col" className="px-4 py-2.5 text-right text-eyebrow">Xếp loại</th>
                    <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {members.map((m: CycleUserEvaluation) => (
                    <tr key={m.userId} onClick={() => setDetailMember(m)} className="cursor-pointer transition-colors hover:bg-[var(--color-muted)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            fullName={m.userName}
                            avatarUrl={m.userAvatarUrl}
                            className="h-8 w-8 rounded-control"
                            fallbackClassName="bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{m.userName}</p>
                            <p className="truncate text-caption">{m.orgUnitName || 'Nhân viên'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><SideCell score={m.selfScore} /></td>
                      <td className="px-4 py-3"><SideCell score={m.managerScore} /></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SideCell score={m.finalScore} />
                          {m.finalScoreOverridden && <Badge variant="info">Đã chỉnh tay</Badge>}
                          {m.locked && (
                            <Badge variant="success" title={`Đã chốt ở đơn vị "${m.lockedByUnitName}"`}>
                              <Lock size={11} aria-hidden="true" /> Đã khoá
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.qualScore != null
                          ? <span className="text-sm font-medium text-[var(--color-foreground)]">{m.qualScore}<span className="text-caption">/5</span></span>
                          : <span className="text-caption">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {m.matrixRating != null
                          ? <span className="text-sm font-medium text-[var(--color-foreground)]">{m.matrixRating}<span className="text-caption">/5</span></span>
                          : <span className="text-caption">—</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon-sm"
                            onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                            disabled={exportingUserId === m.userId}
                            aria-label={`Xuất chi tiết của ${m.userName}`}
                            title="Xuất chi tiết đánh giá kỳ"
                          >
                            {exportingUserId === m.userId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label="Xem chi tiết" title="Xem chi tiết">
                            <ChevronRight aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 md:hidden">
              {members.map((m: CycleUserEvaluation) => (
                <div key={m.userId} className="cursor-pointer rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-4 active:bg-[var(--color-muted)]" onClick={() => setDetailMember(m)}>
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      fullName={m.userName}
                      avatarUrl={m.userAvatarUrl}
                      className="h-9 w-9 rounded-control"
                      fallbackClassName="bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-foreground)]">{m.userName}</p>
                      <p className="truncate text-caption">{m.orgUnitName || 'Nhân viên'}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                      disabled={exportingUserId === m.userId}
                      aria-label={`Xuất chi tiết của ${m.userName}`}
                    >
                      {exportingUserId === m.userId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    </Button>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-eyebrow">Tự ĐG</dt><dd className="mt-0.5"><SideCell score={m.selfScore} /></dd></div>
                    <div><dt className="text-eyebrow">QLTT</dt><dd className="mt-0.5"><SideCell score={m.managerScore} /></dd></div>
                    <div><dt className="text-eyebrow">Chốt</dt><dd className="mt-0.5"><SideCell score={m.finalScore} /></dd></div>
                  </dl>
                  {(m.finalScoreOverridden || m.locked) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.finalScoreOverridden && <Badge variant="info">Đã chỉnh tay</Badge>}
                      {m.locked && <Badge variant="success"><Lock size={11} aria-hidden="true" /> Đã khoá</Badge>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
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
            cycleId={cycleId}
            showConduct={org?.enableConduct ?? false}
          />
        )}

        {/* Hộp thoại chốt: gồm luôn ô chấm điểm cho cả đơn vị. Chỉ dựng khi mở nên mỗi lần
            mở là đọc lại số mới nhất từ summary, không cần effect đồng bộ ngược. */}
        {showFinalize && summary && (
          <FinalizeUnitDialog
            summary={summary}
            maxScore={maxScore}
            isQualMode={isQualMode}
            canScoreUnit={canFinalize && !isFinalized}
            onSaveUnitScore={(score, reason) => saveUnitScore({ score, reason })}
            onFinalize={finalize}
            onClose={() => setShowFinalize(false)}
            getScoreColor={getScoreColor}
            getScoreLabel={getScoreLabel}
          />
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
  )
}

/** Modal xem chi tiết & nhập điểm chốt kỳ cho một nhân viên. */
function UserScoreModal({
  member, maxScore, getScoreColor, getScoreLabel, canEdit, lockedByUnitName, isSaving, onClose, onSave,
  cycleName, cycleId, showConduct,
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
  /** Kỳ đang xem — phiếu hạnh kiểm cấp kỳ bám theo đúng kỳ này. */
  cycleId: string
  showConduct: boolean
}) {
  const [score, setScore] = useState<string>(member.finalScore != null ? String(member.finalScore) : '')
  const [qual, setQual] = useState<string>(member.qualScore != null ? String(member.qualScore) : '')
  const [comment, setComment] = useState(member.comment || '')
  const [saved, setSaved] = useState(false)
  const canPromptReward = useCanPromptReward()
  // Phiếu hạnh kiểm không có nút lưu riêng — nút "Lưu điểm chốt kỳ" của modal lưu hộ.
  const conductRef = useRef<ConductSheetHandle>(null)

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
    const lv = Math.round((v / SCORING_POOL) * 5 * 100) / 100
    return <>{lv}<span className="text-[var(--color-subtle-foreground)] text-base font-medium">/5</span></>
  }

  // Lưu xong KHÔNG đóng ngay: hiện lời mời thưởng điểm ngay tại chỗ. Đây là lúc người
  // chấm còn nhớ rõ nhất vì sao nhân viên xứng đáng — bắt họ sang màn hình khác thưởng
  // sau thì gần như chắc chắn sẽ quên. Nhưng tổ chức tắt thưởng (hoặc không có quyền
  // trao) thì RewardPrompt ẩn và không gọi onDone ⇒ đóng luôn, không thì modal đứng im.
  const handleSave = async () => {
    if (invalid || qualInvalid) return
    // Hạnh kiểm lưu TRƯỚC: nó là trục hành vi của xếp loại ma trận, lưu sau thì bản ghi
    // điểm kỳ vừa chốt vẫn mang điểm hành vi cũ. Lưu hỏng thì dừng, đừng chốt tiếp.
    try {
      await conductRef.current?.save()
    } catch {
      return // toast lỗi đã hiện trong hook của phiếu
    }
    await onSave(parsed, parsedQual, comment)
    if (canPromptReward) setSaved(true)
    else onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      dismissible={!isSaving}
      title={member.userName}
      description={`${member.orgUnitName || 'Nhân viên'} · Chế độ ${MODE_LABEL[member.mode]}`}
      footer={saved && canPromptReward ? (
        // Sau khi lưu điểm mới mời thưởng. Đặt ở footer (ngoài vùng cuộn) để người chấm
        // thấy ngay, và THAY hàng nút: "Bỏ qua" của lời mời đã đóng modal, thêm "Đóng"
        // bên cạnh thì hai nút cùng một việc, người dùng không biết bấm cái nào.
        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <RewardPrompt
            userId={member.userId}
            fullName={member.userName || ''}
            defaultReason={`Thành tích nổi bật trong kỳ${cycleName ? ` ${cycleName}` : ''}`}
            onDone={onClose}
          />
        </div>
      ) : (
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSaving}>Đóng</Button>}
          primary={canEdit && !saved && (
            <Button onClick={handleSave} disabled={isSaving || invalid}>
              {isSaving ? 'Đang lưu...' : 'Lưu điểm chốt'}
            </Button>
          )}
        />
      )}
    >
      <div className="space-y-5">
        {/* Điểm tham chiếu */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
            <span className="text-eyebrow block mb-1">Nhân viên tự đánh giá</span>
            <span className="text-2xl font-semibold text-[var(--color-foreground)] tracking-tighter">
              {sideDisplay(member.selfScore)}
            </span>
          </div>
          <div className="p-4 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
            <span className="text-eyebrow block mb-1">QLTT (TB các đợt)</span>
            <span className="text-2xl font-semibold text-[var(--color-foreground)] tracking-tighter">
              {sideDisplay(member.managerScore)}
            </span>
          </div>
        </div>

        {/* Trung bình từng chiều — tham chiếu, không dùng để tính điểm chốt. */}
        {hasDimensionAvg && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
              <span className="text-eyebrow block mb-1">TB định lượng</span>
              <span className="text-lg font-semibold text-[var(--color-foreground)] tracking-tighter">{avgQuant ?? '—'}</span>
            </div>
            <div className="p-3 rounded-card bg-[var(--color-primary-soft)] border border-[var(--color-border)]">
              <span className="text-eyebrow block mb-1">TB định tính</span>
              <span className="text-lg font-semibold text-[var(--color-primary)] tracking-tighter">
                {avgQual != null ? <>{avgQual}<span className="text-[var(--color-subtle-foreground)] text-xs font-medium">/5</span></> : '—'}
              </span>
            </div>
            <div className="p-3 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <span className="text-eyebrow block mb-1">TB xếp loại</span>
              <span className="text-lg font-semibold text-[var(--color-warning)] tracking-tighter">
                {avgMatrix != null ? <>{avgMatrix}<span className="text-[var(--color-subtle-foreground)] text-xs font-medium">/5</span></> : '—'}
              </span>
            </div>
          </div>
        )}

        {/* Chi tiết từng đợt */}
        <div className="space-y-2">
          <span className="text-eyebrow ml-1">Chi tiết từng đợt</span>
          <PeriodBreakdownTable member={member} />
        </div>

        {/* Hạnh kiểm cấp KỲ chấm ngay tại đây — nó là trục hành vi của xếp loại ma trận
            bên dưới, nên phải chấm trước khi chốt điểm kỳ. */}
        {showConduct && (
          <ConductInlineSheet
            ref={conductRef}
            hideActions
            target={{ scope: 'CYCLE', cycleId, periodId: null }}
            userId={member.userId}
          />
        )}

        {/* Nhập điểm chốt — chỉ ở chế độ có chiều định lượng */}
        {showQuant && (
        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <label className="text-label">
              Điểm chốt kỳ {canEdit && <span className="text-[var(--color-error)]">*</span>}
            </label>
            {canEdit && suggested != null && (
              <Button variant="ghost" type="button" onClick={() => setScore(String(suggested))}>
                Dùng điểm TB ({suggested})
              </Button>
            )}
          </div>
          <div className={cn(
            'rounded-card border bg-[var(--color-muted)] px-6 py-6 space-y-5 text-center',
            invalid ? 'border-[var(--color-error-border)]' : 'border-[var(--color-border)]'
          )}>
            <div className="space-y-1.5">
              {/* Điểm hiện tại — mờ đi khi chưa chấm để phân biệt với điểm đã chọn. */}
              <div className={cn(
                'text-6xl font-semibold tracking-tighter transition-all duration-300',
                parsed == null ? 'text-[var(--color-subtle-foreground)]' : getScoreColor(invalid ? null : parsed)
              )}>
                {parsed != null ? parsed : sliderScore}
              </div>
              <p className={cn(
                'text-eyebrow',
                parsed == null ? 'text-[var(--color-subtle-foreground)]' : getScoreColor(invalid ? null : parsed)
              )}>
                {getScoreLabel(invalid ? null : parsed)}
              </p>
              {/* So sánh với điểm TB các đợt để thấy ngay mình đang nâng hay hạ tay. */}
              {parsed != null && !invalid && suggested != null && parsed !== suggested && (
                <span className={cn(
                  'text-eyebrow inline-flex items-center px-3 py-1 rounded-full',
                  parsed > suggested
                    ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)]'
                    : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)] dark:bg-[var(--color-warning-bg)]'
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
                    className="absolute top-0 h-2 w-0.5 rounded-full bg-[var(--color-foreground)] pointer-events-none"
                    style={{ left: `calc(8px + ${(suggested / maxScore) * 100}% - ${(suggested / maxScore) * 16}px - 1px)` }}
                    title={`Điểm TB các đợt: ${suggested}`}
                  />
                )}
                <input
                  type="range" min={0} max={maxScore} step={1}
                  value={sliderScore}
                  onChange={e => setScore(e.target.value)}
                  className="w-full accent-[var(--color-success-solid)] h-2 bg-[var(--color-border)] rounded-full appearance-none cursor-pointer"
                />
                <div className="text-eyebrow flex justify-between mt-3">
                  <span>0</span>
                  <span>{Math.round(maxScore / 2)}</span>
                  <span>{maxScore}</span>
                </div>
              </div>
            )}
          </div>
          {invalid && (
            <p className="text-xs font-medium text-[var(--color-error)] ml-1">
              Điểm cũ ({parsed}) nằm ngoài khoảng 0 – {maxScore}, hãy kéo lại thanh điểm.
            </p>
          )}
        </div>
        )}

        {/* Chấm định tính cấp kỳ + xếp loại ma trận suy ra */}
        {showQual && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-label">
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
                'w-full px-5 py-4 rounded-card border bg-[var(--color-muted)] text-lg font-semibold outline-none transition-all focus:ring-4 focus:ring-[var(--color-ring)] disabled:opacity-70',
                qualInvalid ? 'border-[var(--color-error-border)] focus:border-[var(--color-error-border)]' : 'border-[var(--color-border)] focus:border-[var(--color-primary)]'
              )}
            />
            {qualInvalid && <p className="text-xs font-medium text-[var(--color-error)] ml-1">Mức định tính phải từ 0 đến 5</p>}
          </div>

          <div className="space-y-2">
            <label className="text-label">
              Xếp loại ma trận
            </label>
            <div className="w-full px-5 py-4 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] flex items-center gap-3">
              {member.matrixRating != null ? (
                <span className="text-lg font-semibold text-[var(--color-warning)]">
                  {member.matrixRating}<span className="text-[var(--color-subtle-foreground)] text-sm font-medium">/5</span>
                </span>
              ) : (
                <span className="text-lg font-semibold text-[var(--color-subtle-foreground)]">—</span>
              )}
              <span className="text-caption font-medium leading-tight">
                {member.avgCompletionPercent != null
                  ? <>Trục cột: TB hoàn thành <span className="font-semibold">{member.avgCompletionPercent}%</span></>
                  : 'Chưa có % hoàn thành định lượng'}
              </span>
            </div>
            <p className="text-caption font-medium ml-1 leading-relaxed">
              Tự suy ra từ ma trận hiệu suất của tổ chức khi bấm Lưu — giao giữa mức định tính và TB % hoàn thành định lượng.
            </p>
          </div>
        </div>
        )}

        {!canEdit && (
          <p className="flex items-center gap-1.5 text-caption font-medium ml-1">
            <Lock size={12} />
            {lockedByUnitName
              ? `Đơn vị "${lockedByUnitName}" đã chốt — chỉ xem. Hãy chọn đơn vị đó và bấm "Mở khoá để chỉnh" nếu cần sửa.`
              : 'Bạn không có quyền chấm điểm kỳ.'}
          </p>
        )}

        {/* Nhận xét */}
        <div className="space-y-2">
          <label className="text-label">Nhận xét</label>
          <textarea
            value={comment} onChange={e => setComment(e.target.value)} rows={3} disabled={!canEdit}
            placeholder="Nhận xét cho nhân viên trong kỳ này..."
            className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-success-solid)] resize-none disabled:opacity-70"
          />
        </div>

        {/* Minh chứng chốt kỳ: gắn vào (kỳ, người) nên đính kèm được trước khi lưu điểm. */}
        <EvidenceAttachments target={evidenceKey.cycle(cycleId, member.userId)} readOnly={!canEdit} title="Minh chứng chốt kỳ" />

        {member.evaluatedByName && (
          <p className="text-caption font-medium">
            Chấm bởi <span className="font-semibold text-[var(--color-muted-foreground)]">{member.evaluatedByName}</span>
            {member.evaluatedAt && ` · ${format(parseISO(member.evaluatedAt), 'HH:mm dd/MM/yyyy')}`}
          </p>
        )}
      </div>
    </Dialog>
  )
}

/** Chi tiết điểm từng đợt trong kỳ của một nhân viên. */
function PeriodBreakdownTable({ member }: { member: CycleUserEvaluation }) {
  if (!member.periodBreakdown?.length) {
    return <p className="text-xs text-[var(--color-subtle-foreground)] italic px-1 py-2">Kỳ này chưa có đợt nào được gán.</p>
  }
  // Chế độ "Cả hai": tách riêng 2 chiều để thấy rõ phần định lượng và định tính.
  const showDimensions = member.mode === 'BOTH'
  // Chế độ Định tính: hiện lại mức gốc 0-5 thay vì số đã quy đổi sang pool chấm.
  const isQualMode = member.mode === 'QUALITATIVE'
  const side = (v: number | null) => {
    if (v == null) return '—'
    if (!isQualMode) return v
    return `${Math.round((v / SCORING_POOL) * 5 * 100) / 100}/5`
  }

  return (
    <div className="space-y-1.5">
      <div className="rounded-card border border-[var(--color-border)] overflow-hidden bg-[var(--color-card)]">
        <table className="w-full text-left">
          <thead>
            <tr className="text-eyebrow bg-[var(--color-muted)]">
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
              <tr key={p.periodId} className="border-t border-[var(--color-border)]">
                <td className="px-4 py-2.5 text-caption">{p.periodName}</td>
                {showDimensions && (
                  <td className="px-4 py-2.5 text-caption text-center">{p.quantScore ?? '—'}</td>
                )}
                {showDimensions && (
                  <td className="px-4 py-2.5 text-xs font-medium text-center">
                    {p.qualScore != null
                      ? <span className="text-[var(--color-primary)]">{p.qualScore}<span className="text-[var(--color-subtle-foreground)] font-medium">/5</span></span>
                      : <span className="text-[var(--color-subtle-foreground)]">—</span>}
                  </td>
                )}
                {showDimensions && (
                  <td className="px-4 py-2.5 text-xs font-medium text-center">
                    {p.matrixRating != null
                      ? <span className="inline-flex items-center px-2 py-0.5 rounded-control bg-[var(--color-warning-bg)] text-[var(--color-warning)] border border-[var(--color-warning-border)]">
                          {p.matrixRating}<span className="text-[var(--color-subtle-foreground)] font-medium">/5</span>
                        </span>
                      : <span className="text-[var(--color-subtle-foreground)]">—</span>}
                  </td>
                )}
                <td className="px-4 py-2.5 text-caption text-center">{side(p.selfScore)}</td>
                <td className="px-4 py-2.5 text-caption text-center">{side(p.managerScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showDimensions && (
        <p className="text-caption font-medium px-1 leading-relaxed">
          <span className="font-semibold">Định lượng</span> là điểm hệ thống tính từ KPI định lượng;{' '}
          <span className="font-semibold">Định tính</span> là mức trung bình có trọng số của KPI định tính (thang 0–5);{' '}
          <span className="font-semibold">Xếp loại</span> là kết quả ma trận hiệu suất giao giữa hai trục đó (chỉ có khi đợt đủ cả hai).
          Ba cột này để tham chiếu — điểm chốt kỳ lấy trung bình cột QLTT đánh giá.
        </p>
      )}
    </div>
  )
}

