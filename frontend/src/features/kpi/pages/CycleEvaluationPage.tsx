import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useKpiCycles } from '../hooks/useKpiCycles'
import ScopeSelectItems from '@/components/common/ScopeSelectItems'
import { pickCurrentOrNearest } from '@/components/common/dateScope'
import { useUnitCycleSummary, useCycleApprovalChain, useCycleCalibration } from '../hooks/useCycleEvaluation'
import CycleInsightsCard from '../components/CycleInsightsCard'
import FinalizeUnitDialog from '../components/FinalizeUnitDialog'
import CycleFlowBar from '../components/CycleFlowBar'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import UnitScoreDialog from '../components/UnitScoreDialog'
import CycleCalibrationDialog from '../components/CycleCalibrationDialog'
import type { CalibrationSuggestion } from '../api/kpiCycleEvaluationApi'
import SendEvaluationModal from '../components/SendEvaluationModal'
import { useOrgUnitTree } from '@/features/orgunits/hooks/useOrgUnitTree'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useHasPermission } from '@/components/auth/PermissionGate'
import AiShortcutButton from '@/features/analytics/components/AiShortcutButton'
import { aiShortcuts } from '@/features/analytics/aiShortcuts'
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
import { Section, ScoreRow, AxisLine, Collapsible } from '@/components/common/ScoreForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { lookupMatrixRating, resolveMatrixAxes, behaviorSourceLabel } from '@/lib/performanceMatrix'
import {
  CalendarRange, Building2, Award, ChevronRight, Lock,
  AlertTriangle, FileSpreadsheet, Download, Loader2, Mail, PenLine, Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

const MODE_LABEL = perLanguage((): Record<CycleEvaluationMode, string> => ({
  QUANTITATIVE: i18n.t('kpi:CycleEvaluationPage.quantitative'),
  QUALITATIVE: i18n.t('kpi:CycleEvaluationPage.qualitative'),
  BOTH: i18n.t('kpi:CycleEvaluationPage.both'),
}))

const flattenTree = (nodes: any[], level = 0): any[] => {
  let result: any[] = []
  nodes.forEach(node => {
    result.push({ ...node, levelLabel: '—'.repeat(level) + (level > 0 ? ' ' : '') + node.name })
    if (node.children?.length) result = result.concat(flattenTree(node.children, level + 1))
  })
  return result
}

type SortKey = 'userName' | 'managerScore' | 'matrixRating' | 'finalScore'

export default function CycleEvaluationPage() {
  const { t } = useTranslation('kpi')
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
  const [showCalibrateConfirm, setShowCalibrateConfirm] = useState(false)
  const [showUnitScore, setShowUnitScore] = useState(false)
  const [showCalibration, setShowCalibration] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'userName', direction: 'asc' })

  // Chọn sẵn kỳ đang chạy; đang ở kẽ giữa hai kỳ thì giữ nguyên kỳ vừa kết thúc.
  const defaultCycle = useMemo(() => pickCurrentOrNearest(cycles), [cycles])
  useEffect(() => { if (!cycleId && defaultCycle) setCycleId(defaultCycle.id) }, [defaultCycle, cycleId])
  useEffect(() => { if (!orgUnitId && flatOrgUnits.length) setOrgUnitId(flatOrgUnits[0].id) }, [flatOrgUnits, orgUnitId])

  const {
    data: summary, isLoading, finalize,
    reopen, isReopening, saveUserScore, isSavingUserScore,
    saveUnitScore, isSavingUnitScore,
    applyMany, isApplyingMany,
    startCalibration, isCalibrating,
    sendEvaluation, isSending,
  } = useUnitCycleSummary(cycleId, orgUnitId)

  const status = summary?.status ?? 'DRAFT'
  const isDraft = status === 'DRAFT'
  const isCalibratingStep = status === 'CALIBRATING'
  const isFinalized = status === 'FINALIZED'

  // Đề xuất hiệu chỉnh chỉ có nghĩa sau khi đã chốt dữ liệu kỳ (điểm nền đứng yên).
  const { data: plan, isLoading: isPlanLoading } = useCycleCalibration(cycleId, orgUnitId, !isDraft)

  // Chốt dữ liệu kỳ đóng luôn đánh giá đợt + hạnh kiểm, nên còn ai chưa có điểm đợt nào thì
  // phải nói trước — chốt xong mới phát hiện thì phải mở lại về nháp.
  const unscoredCount = summary?.members.filter(m => m.managerScore == null).length ?? 0
  const requestCalibration = () => {
    if (unscoredCount > 0) setShowCalibrateConfirm(true)
    else startCalibration()
  }

  // Một đề xuất → payload lưu điểm kỳ cho đúng người đó, kèm ghi chú nói rõ vì sao đổi.
  const suggestionPayload = (sg: CalibrationSuggestion) => {
    const m = summary?.members.find(x => x.userId === sg.userId)
    if (!m) return null
    const note = t('CycleEvaluationPage.calibratedToTheBellCurveQuota', { fromLevel: sg.fromLevel, toLevel: sg.toLevel })
    const comment = m.comment?.includes(note) ? m.comment : [m.comment, note].filter(Boolean).join('\n')
    return {
      userId: sg.userId,
      // Chế độ thang điểm: kéo điểm chốt qua ngưỡng. Chế độ ma trận: giữ điểm, đặt thẳng hạng.
      finalScore: sg.suggestedScore ?? (m.finalScoreOverridden ? m.finalScore : null),
      qualScore: m.qualScore,
      comment,
      ...(sg.suggestedRating != null ? { matrixRating: sg.suggestedRating } : {}),
      label: sg.userName,
    }
  }
  const [applyingUserId, setApplyingUserId] = useState<string | null>(null)
  const applySuggestion = async (sg: CalibrationSuggestion) => {
    const payload = suggestionPayload(sg)
    if (!payload) return
    setApplyingUserId(sg.userId)
    try {
      await saveUserScore({ ...payload, silent: true })
      toast.success(`${sg.userName}: ${sg.fromLevel} → ${sg.toLevel}`)
    } finally {
      setApplyingUserId(null)
    }
  }
  const applySuggestions = (list: CalibrationSuggestion[]) =>
    applyMany(list.map(suggestionPayload).filter((p): p is NonNullable<typeof p> => p != null))

  // Nút K.AI theo trạng thái đợt: chưa chốt -> mời chốt; đã chốt -> mời mở lại; chỉ có quyền gửi -> mời gửi.
  // Trợ lý dựng lời mời xác nhận kèm bảng điểm, chưa ghi gì cho tới khi bấm xác nhận.
  const aiCyclePrompt = canFinalize
    ? (isFinalized
        ? aiShortcuts.reopenCycle(summary?.cycleName, summary?.orgUnitName)
        : aiShortcuts.finalizeCycle(summary?.cycleName, summary?.orgUnitName))
    : (canSend ? aiShortcuts.sendCycleResults(summary?.cycleName, summary?.orgUnitName) : null)
  const aiCycleLabel = canFinalize ? (isFinalized ? t('CycleEvaluationPage.reopenWithKAi') : t('CycleEvaluationPage.finalizeWithKAi')) : t('CycleEvaluationPage.sendWithKAi')

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
      toast.success(t('CycleEvaluationPage.excelFileExported'))
    } catch {
      toast.error(t('CycleEvaluationPage.excelExportFailed'))
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
      toast.success(t('CycleEvaluationPage.exportedDetailsFor', { userName: member.userName }))
    } catch {
      toast.error(t('CycleEvaluationPage.excelExportFailed'))
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
    if (score == null) return <span className="text-caption">{t('CycleEvaluationPage.no')}</span>
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
          title={t('CycleEvaluationPage.cycleEvaluation')}
          description={t('CycleEvaluationPage.cycleScoreSummaryAverageOfPeriods')}
          stats={[
            { label: t('CycleEvaluationPage.members'), value: summary?.memberCount ?? 0, icon: Users },
            { label: isQualMode ? t('CycleEvaluationPage.selfAssessedLevel') : t('CycleEvaluationPage.selfAssessmentScore'), value: statValue(summary?.selfScore) },
            { label: isQualMode ? t('CycleEvaluationPage.finalizedLevel') : t('CycleEvaluationPage.finalizedScore'), value: statValue(summary?.managerScore) },
            /* Hai trục của ma trận. Kỳ chạy Định lượng KHÔNG có mức định tính, nhưng vẫn có trục
               hành vi khi tổ chức chấm hạnh kiểm — nên điều kiện bám theo việc có số hay không,
               chứ không bám theo chế độ kỳ. */
            ...(summary && (summary.behaviorScore != null || summary.matrixRating != null)
              ? [
                  { label: t('CycleEvaluationPage.avgConduct'), value: summary.behaviorScore != null ? `${summary.behaviorScore}/5` : '—' },
                  { label: t('CycleEvaluationPage.avgRating'), value: summary.matrixRating != null ? `${summary.matrixRating}/5` : '—' },
                ]
              : []),
            /* Xếp loại đơn vị đứng cuối dãy số liệu, tô theo màu hạng — cùng một khối với các con số
               làm ra nó, thay vì một thẻ riêng rớt xuống hàng dưới. */
            ...(summary?.classification
              ? [{
                  label: summary.status === 'FINALIZED' ? t('CycleEvaluationPage.ratingFinalized') : t('CycleEvaluationPage.ratingProvisional'),
                  value: (
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: summary.classificationColor ?? undefined }}
                      title={[
                        summary.status === 'FINALIZED' ? t('CycleEvaluationPage.ratingCapturedWhenTheCycleWas') : t('CycleEvaluationPage.provisionalRatingFromTheCurrentCycle'),
                        summary.classificationProfileName && t('CycleEvaluationPage.profile', { classificationProfileName: summary.classificationProfileName }),
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
          search={{ value: search, onChange: setSearch, placeholder: t('CycleEvaluationPage.searchEmployees') }}
          trailing={
            <div id="tour-cycleeval-actions" className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting || !summary?.members?.length}>
                <FileSpreadsheet aria-hidden="true" /> {isExporting ? t('CycleEvaluationPage.exporting') : t('CycleEvaluationPage.exportExcel')}
              </Button>
              {canSend && (
                <Button variant="outline" size="sm" onClick={() => setShowSend(true)} disabled={!summary?.members?.length} title={t('CycleEvaluationPage.emailTheCycleEvaluationResultsTo')}>
                  <Mail aria-hidden="true" /> {t('CycleEvaluationPage.sendEvaluations')}
                </Button>
              )}
              {aiCyclePrompt && cycleId && orgUnitId && (
                <AiShortcutButton
                  size="sm"
                  label={aiCycleLabel}
                  prompt={aiCyclePrompt}
                  focusUnitId={orgUnitId}
                  title={t('CycleEvaluationPage.kAiChecksThePeriodStatus')}
                />
              )}
            </div>
          }
        >
          <Select value={orgUnitId} onValueChange={setOrgUnitId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-60" aria-label={t('CycleEvaluationPage.unit')}>
              <Building2 size={15} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              <SelectValue placeholder={t('CycleEvaluationPage.chooseUnit')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {flatOrgUnits.map(unit => (
                <SelectItem key={unit.id} value={unit.id}>{unit.levelLabel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-full sm:w-auto sm:min-w-60" aria-label={t('CycleEvaluationPage.evaluationCycles')}>
              <CalendarRange size={15} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden="true" />
              <SelectValue placeholder={t('CycleEvaluationPage.chooseCycle')} />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <ScopeSelectItems items={cycles} selectedId={cycleId} noun={t('CycleEvaluationPage.cycle')} />
            </SelectContent>
          </Select>
          {summary && (
            <Badge variant="outline" className="h-9 self-center" title={t('CycleEvaluationPage.cycleEvaluationMode')}>
              {MODE_LABEL()[summary.mode]}
            </Badge>
          )}
        </FilterBar>

        {/* Dải luồng: trạng thái + nút của từng bước nằm ngay trong ô bước đó. */}
        {summary && (
          <div id="tour-cycleeval-actions">
            <CycleFlowBar
              summary={summary}
              plan={plan}
              chainStep={currentStep}
              canFinalize={canFinalize}
              onCalibrate={requestCalibration}
              isCalibrating={isCalibrating}
              onReopen={cascade => reopen(cascade)}
              isReopening={isReopening}
              onFinalize={() => setShowFinalize(true)}
              onGoUnitScore={() => setShowUnitScore(true)}
              onGoCalibration={() => setShowCalibration(true)}
            />
          </div>
        )}

        {/* Bell curve + luồng duyệt: hai góc nhìn quanh bảng, gộp một thẻ có tab. ② và ③ là
            việc làm một lần nên nằm trong hộp thoại mở từ dải bước, không chiếm chỗ trên trang. */}
        {summary && (
          <CycleInsightsCard
            key={`${summary.orgUnitId}-${summary.status}`}
            curve={summary.bellCurve}
            orgUnitName={summary.orgUnitName}
            chain={chain || []}
            isChainLoading={isChainLoading}
            getScoreColor={getScoreColor}
            getScoreLabel={getScoreLabel}
            onSelectUnit={setOrgUnitId}
          />
        )}

        {/* Cảnh báo: chế độ Định tính nhưng chưa có KPI định tính nào được chấm */}
        {noQualitativeData && (
          <div className="flex items-start gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-4 py-3 text-sm text-[var(--color-warning)]">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-0.5">
              <p className="font-medium">{t('CycleEvaluationPage.noQualitativeKpiDataYet')}</p>
              <p>
                {t('CycleEvaluationPage.thisCycleIsEvaluatedBy')} <b className="font-medium">{t('CycleEvaluationPage.qualitative')}</b>{t('CycleEvaluationPage.butNoQualitativeKpiInThe')} <b className="font-medium">{t('CycleEvaluationPage.quantitative')}</b> / <b className="font-medium">{t('CycleEvaluationPage.both')}</b>.
              </p>
            </div>
          </div>
        )}

        {/* Bảng thành viên */}
        {!cycleId || !orgUnitId ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState icon={Users} title={t('CycleEvaluationPage.chooseCycleAndUnit')} description={t('CycleEvaluationPage.chooseAnEvaluationCycleAndA')} />
          </div>
        ) : isLoading ? (
          <LoadingSkeleton type="table" rows={8} />
        ) : members.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
            <EmptyState
              icon={Users}
              title={search ? t('CycleEvaluationPage.noEmployeesFound') : t('CycleEvaluationPage.theUnitHasNoMembersYet')}
              description={search ? t('CycleEvaluationPage.tryAnotherKeywordOrClearThe') : t('CycleEvaluationPage.thisUnitHasNoMembersTo')}
            />
          </div>
        ) : (
          <>
            <div id="tour-cycleeval-table" className="hidden overflow-x-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:block">
              <table className="w-full">
                <thead>
                  {/* Cột đi đúng ba chặng của phiếu: các đợt → xếp loại kỳ → điểm chốt. */}
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="userName" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('CycleEvaluationPage.employee')}</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow" title={t('CycleEvaluationPage.averageOfPeriodsManagerScoreLarge')}>
                      <SortHeader field="managerScore" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('CycleEvaluationPage.periodsManagerScore')}</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow" title={t('CycleEvaluationPage.conductCompletionLookedUpInThe')}>
                      <SortHeader field="matrixRating" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('CycleEvaluationPage.cycleRating')}</SortHeader>
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left text-eyebrow">
                      <SortHeader field="finalScore" active={sortActive} dir={sortDir} onToggle={handleSort}>{t('CycleEvaluationPage.cycleFinalizedScore')}</SortHeader>
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right text-eyebrow">{t('CycleEvaluationPage.actions')}</th>
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
                            <p className="truncate text-caption">{m.orgUnitName || t('CycleEvaluationPage.employee')}</p>
                          </div>
                        </div>
                      </td>
                      {/* ① Các đợt: quản lý chấm là số chính, tự chấm là dòng phụ. */}
                      <td className="px-4 py-3">
                        <SideCell score={m.managerScore} />
                        <p className="text-caption mt-0.5">
                          {t('CycleEvaluationPage.selfScore')} {m.selfScore != null ? (isQualMode ? `${toLevel(m.selfScore)}/5` : m.selfScore) : t('CycleEvaluationPage.none')}
                        </p>
                      </td>
                      {/* ② Xếp loại kỳ: hạng là số chính, hai trục là dòng phụ. */}
                      <td className="px-4 py-3">
                        <RatingCell member={m} />
                      </td>
                      {/* ③ Điểm chốt: số + vì sao nó khác gợi ý (chỉnh tay / nền / khoá). */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <SideCell score={m.finalScore} />
                          {m.locked && (
                            <Badge variant="success" title={t('CycleEvaluationPage.finalizedAtUnit', { lockedByUnitName: m.lockedByUnitName })}>
                              <Lock size={11} aria-hidden="true" /> {t('CycleEvaluationPage.locked')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-caption mt-0.5">
                          {m.finalScoreOverridden
                            ? <span className="text-[var(--color-info)]">
                                <PenLine size={11} className="mr-1 inline" aria-hidden="true" />{t('CycleEvaluationPage.manuallyAdjusted')}
                                {m.managerScore != null && m.finalScore != null && m.finalScore !== m.managerScore
                                  && ` · TB ${m.managerScore}`}
                                {m.baselineScore != null && m.baselineScore !== m.managerScore && t('CycleEvaluationPage.baseline', { baselineScore: m.baselineScore })}
                              </span>
                            : m.finalScore != null ? t('CycleEvaluationPage.managerAverage') : t('CycleEvaluationPage.notFinalized')}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon-sm"
                            onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                            disabled={exportingUserId === m.userId}
                            aria-label={t('CycleEvaluationPage.exportDetailsFor', { userName: m.userName })}
                            title={t('CycleEvaluationPage.exportCycleEvaluationDetails')}
                          >
                            {exportingUserId === m.userId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                          </Button>
                          <Button variant="ghost" size="icon-sm" aria-label={t('CycleEvaluationPage.viewDetails')} title={t('CycleEvaluationPage.viewDetails')}>
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
                      <p className="truncate text-caption">{m.orgUnitName || t('CycleEvaluationPage.employee')}</p>
                    </div>
                    <Button
                      variant="ghost" size="icon-sm"
                      onClick={e => { e.stopPropagation(); handleExportMember(m) }}
                      disabled={exportingUserId === m.userId}
                      aria-label={t('CycleEvaluationPage.exportDetailsFor', { userName: m.userName })}
                    >
                      {exportingUserId === m.userId ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                    </Button>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-eyebrow">{t('CycleEvaluationPage.periods')}</dt><dd className="mt-0.5"><SideCell score={m.managerScore} /></dd></div>
                    <div><dt className="text-eyebrow">{t('CycleEvaluationPage.cycleRating')}</dt><dd className="mt-0.5"><RatingCell member={m} /></dd></div>
                    <div><dt className="text-eyebrow">{t('CycleEvaluationPage.finalize')}</dt><dd className="mt-0.5"><SideCell score={m.finalScore} /></dd></div>
                  </dl>
                  {(m.finalScoreOverridden || m.locked) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.finalScoreOverridden && <Badge variant="info">{t('CycleEvaluationPage.manuallyAdjusted2')}</Badge>}
                      {m.locked && <Badge variant="success"><Lock size={11} aria-hidden="true" /> {t('CycleEvaluationPage.locked')}</Badge>}
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
            performanceMatrix={org?.performanceMatrix}
          />
        )}

        {/* ② Chấm điểm phòng — chỉ dựng khi mở nên luôn đọc số mới nhất từ summary. */}
        {showUnitScore && summary && (
          <UnitScoreDialog
            summary={summary}
            maxScore={maxScore}
            isQualMode={isQualMode}
            canEdit={canFinalize && isCalibratingStep}
            isSaving={isSavingUnitScore}
            onSave={(score, reason) => saveUnitScore({ score, reason })}
            onClose={() => setShowUnitScore(false)}
            getScoreColor={getScoreColor}
            getScoreLabel={getScoreLabel}
          />
        )}

        {/* ③ Đề xuất hiệu chỉnh — bấm tên trong danh sách thì đóng hộp này, mở phiếu người đó. */}
        {showCalibration && summary && (
          <CycleCalibrationDialog
            plan={plan}
            isLoading={isPlanLoading}
            canEdit={canFinalize && isCalibratingStep}
            applyingUserId={applyingUserId}
            isApplyingAll={isApplyingMany}
            onApply={applySuggestion}
            onApplyAll={applySuggestions}
            onOpenMember={id => {
              const m = summary.members.find(x => x.userId === id)
              if (m) { setShowCalibration(false); setDetailMember(m) }
            }}
            onClose={() => setShowCalibration(false)}
          />
        )}

        {/* ④ Khoá kết quả. Chỉ dựng khi mở nên mỗi lần mở là đọc lại số mới nhất từ summary. */}
        {showFinalize && summary && (
          <FinalizeUnitDialog
            summary={summary}
            plan={plan}
            onFinalize={finalize}
            onClose={() => setShowFinalize(false)}
            getScoreColor={getScoreColor}
            getScoreLabel={getScoreLabel}
          />
        )}

        <ConfirmDialog
          open={showCalibrateConfirm}
          onClose={() => setShowCalibrateConfirm(false)}
          onConfirm={() => { setShowCalibrateConfirm(false); startCalibration() }}
          title={t('CycleEvaluationPage.somePeopleHaveNoPeriodScore')}
          description={t('CycleEvaluationPage.employeesHaveNotBeenScoredBy', { unscoredCount, value: summary?.memberCount ?? 0 })}
          confirmLabel={t('CycleEvaluationPage.finalizeDataAnyway')}
          loading={isCalibrating}
        />

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

/** Một chặng trong mạch "Cơ sở để chấm": số thứ tự, tên, một dòng gợi ý, vài dòng số. */
function Stage({ n, title, hint, current, muted, children }: {
  n: number; title: string; hint?: string; current?: boolean; muted?: boolean; children: ReactNode
}) {
  return (
    <li className={cn(
      'rounded-card border px-3 py-2.5',
      current ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
        : 'border-[var(--color-border)] bg-[var(--color-muted)]',
      muted && 'opacity-60',
    )}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
          current ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-card)] text-[var(--color-muted-foreground)] border border-[var(--color-border)]',
        )}>{n}</span>
        <span className="min-w-0">
          <span className={cn('block truncate text-xs font-semibold', current ? 'text-[var(--color-primary)]' : 'text-[var(--color-foreground)]')}>{title}</span>
          {hint && <span className="text-caption block truncate">{hint}</span>}
        </span>
      </div>
      <dl className="space-y-0.5">{children}</dl>
    </li>
  )
}

function StageRow({ label, value, tone }: { label: string; value: ReactNode; tone?: 'primary' | 'warning' | 'strong' }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <dt className="text-caption">{label}</dt>
      <dd className={cn(
        'tabular-nums',
        tone === 'primary' ? 'font-semibold text-[var(--color-primary)]'
          : tone === 'warning' ? 'font-semibold text-[var(--color-warning)]'
          : tone === 'strong' ? 'text-base font-semibold text-[var(--color-foreground)]'
          : 'font-medium text-[var(--color-foreground)]',
      )}>{value}</dd>
    </div>
  )
}

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-xs font-medium text-[var(--color-subtle-foreground)]">{children}</span>
}

/** Mũi tên giữa hai chặng: ngang ở màn rộng, quay xuống ở màn hẹp. */
function StageArrow() {
  return (
    <li aria-hidden="true" className="flex items-center justify-center text-[var(--color-subtle-foreground)]">
      <ChevronRight size={16} className="rotate-90 lg:rotate-0" />
    </li>
  )
}

/**
 * Ô "Xếp loại kỳ" trong bảng: hạng là số chính, hai trục sinh ra nó là dòng phụ.
 *
 * Trước đây hành vi và xếp loại là hai cột rời, kỳ chạy chế độ Định lượng thì cột hành vi
 * luôn trống dù đã chấm hạnh kiểm — vì cột đọc `qualScore`. Giờ đọc `behaviorScore` (trục thật
 * đưa vào ma trận) và ghi rõ "HK" khi trục lấy từ hạnh kiểm, để chấm hạnh kiểm xong là thấy nó
 * đi vào xếp loại ngay trên bảng.
 */
function RatingCell({ member: m }: { member: CycleUserEvaluation }) {
  const { t } = useTranslation('kpi')
  // Viết đủ chữ: "HV / HT" là ký hiệu của người viết code, người chấm không có lý do gì để biết.
  const axes = [
    m.behaviorScore != null ? t('CycleEvaluationPage.conduct5', { behaviorScore: m.behaviorScore, m: behaviorSourceLabel(m) }) : null,
    m.avgCompletionPercent != null ? t('CycleEvaluationPage.completion', { avgCompletionPercent: Math.round(m.avgCompletionPercent) }) : null,
  ].filter(Boolean)
  return (
    <div className="tabular-nums">
      {m.matrixRating != null ? (
        <span
          className="text-sm font-semibold text-[var(--color-warning)]"
          title={m.ratingOverridden ? t('CycleEvaluationPage.calibratedToTheQuota', { value: m.baselineRating != null ? t('CycleEvaluationPage.baseline5', { baselineRating: m.baselineRating }) : '' }) : undefined}
        >
          {m.matrixRating}<span className="text-caption font-medium">/5</span>
          {m.ratingOverridden && <PenLine size={11} className="ml-1 inline text-[var(--color-info)]" aria-label={t('CycleEvaluationPage.calibrated')} />}
        </span>
      ) : (
        <span className="text-caption">—</span>
      )}
      <p className="text-caption mt-0.5 whitespace-nowrap" title={t('CycleEvaluationPage.twoAxesOfTheRatingMatrix')}>
        {axes.length ? axes.join(' · ') : t('CycleEvaluationPage.missingAnAxisForRating')}
      </p>
    </div>
  )
}

/** Modal xem chi tiết & nhập điểm chốt kỳ cho một nhân viên. */
function UserScoreModal({
  member, maxScore, getScoreColor, getScoreLabel, canEdit, lockedByUnitName, isSaving, onClose, onSave,
  cycleName, cycleId, showConduct, performanceMatrix,
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
  /** Ma trận xếp loại của tổ chức (JSON) — tra tại chỗ để xếp loại đổi ngay khi đang chấm. */
  performanceMatrix?: string | null
}) {
  const { t } = useTranslation('kpi')
  const [score, setScore] = useState<string>(member.finalScore != null ? String(member.finalScore) : '')
  const [qual, setQual] = useState<string>(member.qualScore != null ? String(member.qualScore) : '')
  const [comment, setComment] = useState(member.comment || '')
  const draft = useStateDraft(
    { score, qual, comment },
    v => { setScore(v.score); setQual(v.qual); setComment(v.comment) },
    { key: `cycle-user-score:${cycleId ?? ''}:${member.userId}`, enabled: canEdit },
  )
  const [saved, setSaved] = useState(false)
  const canPromptReward = useCanPromptReward()
  // Phiếu hạnh kiểm không có nút lưu riêng — nút "Lưu điểm chốt" của modal lưu hộ.
  const conductRef = useRef<ConductSheetHandle>(null)
  // Điểm hạnh kiểm ĐANG gõ. Không có nút lưu riêng thì đây là nhịp duy nhất để khối xếp loại
  // bên dưới đổi theo — thiếu nó, người chấm hạnh kiểm xong vẫn thấy xếp loại đứng im và
  // tưởng việc mình vừa làm không đi tới đâu.
  const [conductLive, setConductLive] = useState<{ total: number | null; max: number } | null>(null)

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
  const avgMatrix = avgOf(p => p.matrixRating)

  const parsedQual = qual.trim() === '' ? null : Number(qual)
  const qualInvalid = parsedQual != null && (Number.isNaN(parsedQual) || parsedQual < 0 || parsedQual > 5)

  // Chế độ kỳ quyết định chấm chiều nào: Định lượng → chỉ điểm; Định tính → chỉ mức 0-5;
  // Cả hai → chấm cả hai rồi quy ra ma trận.
  const showQuant = member.mode === 'QUANTITATIVE' || member.mode === 'BOTH'
  const showQual = member.mode === 'QUALITATIVE' || member.mode === 'BOTH'

  // Ở chế độ Định tính, điểm tự ĐG/QLTT vốn là mức 0-5 đã quy đổi ⇒ hiện lại mức gốc.
  const isQualMode = member.mode === 'QUALITATIVE'
  const sideDisplay = (v: number | null): ReactNode => {
    if (v == null) return '—'
    if (!isQualMode) return v
    const lv = Math.round((v / SCORING_POOL) * 5 * 100) / 100
    return <>{lv}<span className="text-sm font-medium text-[var(--color-subtle-foreground)]">/5</span></>
  }

  // Hai trục ma trận theo đúng luật của backend, nhưng tính lại TẠI CHỖ từ những gì đang gõ:
  // mức định tính vừa nhập, điểm hạnh kiểm vừa chấm. Chưa động vào gì thì rơi về số server trả.
  // Phiếu chỉ báo ra điểm của PHÍA người này chấm. Quản lý mở phiếu mà chưa chấm ô nào thì
  // `total` là null, trong khi server vẫn có điểm (nó rơi về điểm nhân viên tự chấm) — nên
  // chưa gõ gì thì lấy số của server, gõ rồi mới lấy số đang gõ.
  const conductTotal = conductLive?.total ?? member.conductScore
  const conductMax = conductLive?.max ?? member.conductMaxScore
  const localAxes = resolveMatrixAxes(
    showQual ? parsedQual : null,
    member.avgCompletionPercent,
    showConduct ? conductTotal : null,
    showConduct ? conductMax : null,
  )
  // Trục hành vi lấy từ 360 (hoặc trộn hạnh kiểm + 360) do backend tính; trang không có dữ liệu 360
  // để tính lại, nên giữ số server trả — trừ khi người chấm vừa gõ mức định tính (định tính luôn thắng).
  const from360 = member.behaviorSource === 'FEEDBACK360' || member.behaviorSource === 'BLENDED'
  const axes = from360 && !(showQual && parsedQual != null)
    ? { ...localAxes, behavior: member.behaviorScore }
    : localAxes
  const matrixLive = lookupMatrixRating(axes.behavior, axes.completion, performanceMatrix) ?? member.matrixRating
  // Ma trận chỉ tra được khi đủ hai trục; thiếu trục nào thì nói thẳng thiếu trục đó thay vì
  // để một ô "—" không giải thích gì.
  const missingAxis = axes.behavior == null
    ? t('CycleEvaluationPage.conductScoreQualitativeKpisOrConduct')
    : axes.completion == null ? t('CycleEvaluationPage.quantitativeKpiCompletion') : null
  const showMatrix = showQual || showConduct

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
    draft.clear()
    if (canPromptReward) setSaved(true)
    else onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="2xl"
      dismissible={!isSaving}
      title={member.userName}
      description={t('CycleEvaluationPage.mode', { value: member.orgUnitName || t('CycleEvaluationPage.employee2'), value2: MODE_LABEL()[member.mode] })}
      headerExtra={
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          {member.finalScoreOverridden && <Badge variant="info">{t('CycleEvaluationPage.manuallyAdjusted2')}</Badge>}
          {!canEdit && (
            <Badge variant="outline" title={lockedByUnitName ? t('CycleEvaluationPage.unitHasFinalized', { lockedByUnitName }) : undefined}>
              <Lock size={11} aria-hidden="true" /> {t('CycleEvaluationPage.viewOnly')}
            </Badge>
          )}
        </div>
      }
      footer={saved && canPromptReward ? (
        // Sau khi lưu điểm mới mời thưởng. Đặt ở footer (ngoài vùng cuộn) để người chấm
        // thấy ngay, và THAY hàng nút: "Bỏ qua" của lời mời đã đóng modal, thêm "Đóng"
        // bên cạnh thì hai nút cùng một việc, người dùng không biết bấm cái nào.
        <div className="shrink-0 border-t border-[var(--color-border)] px-4 py-3 sm:px-5">
          <RewardPrompt
            userId={member.userId}
            fullName={member.userName || ''}
            defaultReason={t('CycleEvaluationPage.outstandingAchievementsInTheCycle', { value: cycleName ? ` ${cycleName}` : '' })}
            onDone={onClose}
          />
        </div>
      ) : (
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={isSaving}>{t('CycleEvaluationPage.close')}</Button>}
          primary={canEdit && !saved && (
            <Button onClick={handleSave} disabled={isSaving || invalid || qualInvalid}>
              {isSaving ? t('CycleEvaluationPage.saving') : t('CycleEvaluationPage.saveFinalizedScore')}
            </Button>
          )}
        />
      )}
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-6">
        {/* ── 1. Cơ sở để chấm ─────────────────────────────────────────────
            Mọi con số CHỈ ĐỂ THAM CHIẾU gom vào một khối, tách hẳn khỏi phần có ô nhập bên
            dưới: trước đây năm thẻ số và một bảng nằm lẫn với ô chấm, người chấm phải tự đoán
            chỗ nào bấm được chỗ nào không. */}
        <Section title={t('CycleEvaluationPage.scoringBasis')} hint={t('CycleEvaluationPage.readLeftRightPeriodCycleRating')}>
          {/* Sáu con số xếp theo MẠCH sinh ra nhau thay vì sáu thẻ ngang hàng: điểm từng đợt
              gộp thành điểm kỳ tạm tính, chụp lại thành điểm nền lúc chốt dữ liệu, rồi người
              chấm chốt trên nền đó. Đọc trái → phải là biết con số bên dưới từ đâu ra. */}
          <ol className="grid gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-stretch">
            {/* ① Các đợt nói gì — hai phía chấm và xếp loại từng đợt gộp lại. Định lượng /
                định tính từng đợt nằm ở bảng "Chi tiết từng đợt" bên dưới, không lặp ở đây. */}
            <Stage n={1} title={t('CycleEvaluationPage.whatThePeriodsSay')} hint={t('CycleEvaluationPage.averageOfScoredPeriods', { count: member.periodBreakdown?.length ?? 0 })}>
              <StageRow label={t('CycleEvaluationPage.managerScore')} value={sideDisplay(member.managerScore)} tone="strong" />
              <StageRow label={t('CycleEvaluationPage.employeeSelfScore')} value={sideDisplay(member.selfScore)} />
              <StageRow label={t('CycleEvaluationPage.periodRating')} value={avgMatrix != null ? <>{avgMatrix}<Unit>/5</Unit></> : '—'} tone="warning" />
            </Stage>
            <StageArrow />
            {/* ② Xếp loại kỳ — hai trục đưa vào ma trận và hạng ra. */}
            <Stage n={2} title={t('CycleEvaluationPage.cycleRating')} hint={t('CycleEvaluationPage.conductCompletionLookedUpInThe2')}>
              <StageRow
                label={t('CycleEvaluationPage.conduct', { member: behaviorSourceLabel(member) })}
                value={member.behaviorScore != null ? <>{member.behaviorScore}<Unit>/5</Unit></> : '—'}
                tone="primary"
              />
              <StageRow label={t('CycleEvaluationPage.kpiCompletion')} value={member.avgCompletionPercent != null ? <>{Math.round(member.avgCompletionPercent)}<Unit>%</Unit></> : '—'} />
              <StageRow label={t('CycleEvaluationPage.rating')} value={member.matrixRating != null ? <>{member.matrixRating}<Unit>/5</Unit></> : '—'} tone="warning" />
            </Stage>
            <StageArrow />
            {/* ③ Điểm chốt — gợi ý = TB quản lý chấm; hiện tại là số đã lưu (kèm nền để thấy đã
                nắn bao nhiêu). Việc của người chấm ở khối dưới là quyết định con số này. */}
            <Stage n={3} title={t('CycleEvaluationPage.cycleFinalizedScore')} hint={t('CycleEvaluationPage.youDecideInTheBlockBelow')} current>
              <StageRow label={t('CycleEvaluationPage.suggestionManagerAverage')} value={sideDisplay(member.managerScore)} />
              <StageRow
                label={member.finalScoreOverridden ? t('CycleEvaluationPage.finalizedManuallyAdjusted') : t('CycleEvaluationPage.finalized')}
                value={member.finalScore != null ? sideDisplay(member.finalScore) : '—'}
                tone="strong"
              />
              {member.baselineScore != null && (
                <StageRow
                  label={t('CycleEvaluationPage.baselineWhenDataWasFinalized')}
                  value={<>
                    {sideDisplay(member.baselineScore)}
                    {member.finalScore != null && member.finalScore !== member.baselineScore && (
                      <Unit> ({member.finalScore > member.baselineScore ? '+' : ''}{Math.round((member.finalScore - member.baselineScore) * 100) / 100})</Unit>
                    )}
                  </>}
                />
              )}
            </Stage>
          </ol>

          {/* Bảng từng đợt gập lại: dài bằng số đợt trong kỳ, mà phần lớn lượt chấm chỉ cần
              nhìn mấy con số trung bình ở trên. */}
          <Collapsible label={t('CycleEvaluationPage.detailsOfEachPeriod')} count={member.periodBreakdown?.length ?? 0} countLabel={t('CycleEvaluationPage.periods2')}>
            <PeriodBreakdownTable member={member} />
          </Collapsible>
        </Section>

        {/* ── 2. Chấm ───────────────────────────────────────────────────
            Một lưới "nhãn | ô nhập" cho cả ba thứ chấm được: điểm chốt, mức định tính, hạnh
            kiểm. Cùng một khuôn nên mắt quét dọc là thấy còn ô nào trống. Con số to, thanh kéo
            trải hết chiều ngang và ba khung màu khác nhau của bản trước làm ba ô nhập trông như
            ba màn hình khác nhau. */}
        <Section title={t('CycleEvaluationPage.scoreTheCycle')} hint={canEdit ? undefined : t('CycleEvaluationPage.youAreInViewOnlyMode')}>
          <div className="divide-y divide-[var(--color-border)] rounded-card border border-[var(--color-border)]">
            {/* Điểm chốt kỳ */}
            {showQuant && (
              <ScoreRow
                label={<>{t('CycleEvaluationPage.cycleFinalizedScore')} {canEdit && <span className="text-[var(--color-error)]">*</span>}</>}
                hint={suggested != null ? t('CycleEvaluationPage.directManagerAvgAcrossPeriods', { suggested }) : t('CycleEvaluationPage.noPeriodScoreYet')}
                trailing={canEdit && suggested != null && parsed !== suggested && (
                  <Button variant="ghost" size="sm" type="button" onClick={() => setScore(String(suggested))} title={t('CycleEvaluationPage.useTheAverageOfTheDirect')}>
                    {t('CycleEvaluationPage.useAvg')} {suggested}
                  </Button>
                )}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="cycle-final-score"
                    type="number" min={0} max={maxScore} step={0.5}
                    value={score}
                    disabled={!canEdit}
                    onChange={e => setScore(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    placeholder={suggested != null ? String(suggested) : '—'}
                    invalid={invalid}
                    suffix={<span className="text-xs">/ {maxScore}</span>}
                    className="w-32"
                    inputClassName="text-base font-semibold tabular-nums"
                  />
                  {/* Nhãn xếp loại + chênh lệch so với TB, cùng một hàng với ô nhập. */}
                  {parsed != null && !invalid ? (
                    <span className={cn('text-eyebrow', getScoreColor(parsed))}>{getScoreLabel(parsed)}</span>
                  ) : (
                    <span className="text-caption">{t('CycleEvaluationPage.notScored')}</span>
                  )}
                  {parsed != null && !invalid && suggested != null && parsed !== suggested && (
                    <span className={cn(
                      'text-eyebrow inline-flex items-center rounded-full px-2 py-0.5',
                      parsed > suggested
                        ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                        : 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                    )}>
                      {parsed > suggested ? '+' : ''}{Math.round((parsed - suggested) * 100) / 100} {t('CycleEvaluationPage.comparedWithAverage')}
                    </span>
                  )}
                  {invalid && <span className="text-xs font-medium text-[var(--color-error)]">{t('CycleEvaluationPage.outsideTheRange0')} {maxScore}</span>}
                </div>
                {canEdit && (
                  <div className="relative mt-3 max-w-xl px-2">
                    {/* Vạch mốc điểm TB các đợt: canh theo tâm nút kéo (rộng ~16px). */}
                    {suggested != null && suggested >= 0 && suggested <= maxScore && maxScore > 0 && (
                      <div
                        className="pointer-events-none absolute top-0 h-2 w-0.5 rounded-full bg-[var(--color-foreground)]"
                        style={{ left: `calc(8px + ${(suggested / maxScore) * 100}% - ${(suggested / maxScore) * 16}px - 1px)` }}
                        title={t('CycleEvaluationPage.averagePeriodScore', { suggested })}
                      />
                    )}
                    <input
                      type="range" min={0} max={maxScore} step={0.5}
                      value={sliderScore}
                      onChange={e => setScore(e.target.value)}
                      aria-label={t('CycleEvaluationPage.dragToChooseTheFinalizedCycle')}
                      className="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--color-border)] accent-[var(--color-success-solid)]"
                    />
                    <div className="text-eyebrow mt-1.5 flex justify-between">
                      <span>0</span>
                      <span>{Math.round(maxScore / 2)}</span>
                      <span>{maxScore}</span>
                    </div>
                  </div>
                )}
              </ScoreRow>
            )}

            {/* Mức định tính cấp kỳ */}
            {showQual && (
              <ScoreRow label={t('CycleEvaluationPage.qualitativeLevel')} hint={t('CycleEvaluationPage.scale05TheMatrixsRow')}>
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    id="cycle-qual-score"
                    type="number" step={0.1} min={0} max={5}
                    value={qual}
                    disabled={!canEdit}
                    onChange={e => setQual(e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    placeholder="—"
                    invalid={qualInvalid}
                    suffix={<span className="text-xs">/ 5</span>}
                    className="w-32"
                    inputClassName="text-base font-semibold tabular-nums"
                  />
                  {qualInvalid
                    ? <span className="text-xs font-medium text-[var(--color-error)]">{t('CycleEvaluationPage.mustBeBetween0And5')}</span>
                    : parsedQual == null && <span className="text-caption">{t('CycleEvaluationPage.notScored')}</span>}
                </div>
              </ScoreRow>
            )}

            {/* Hạnh kiểm — phiếu tự gập/mở; đã khoá (sau chốt dữ liệu) thì chỉ còn để xem. */}
            {showConduct && (
              <ScoreRow label={t('CycleEvaluationPage.conduct2')} hint={t('CycleEvaluationPage.cycleLevelScoringConductAxisWhen')}>
                <ConductInlineSheet
                  ref={conductRef}
                  hideActions
                  target={{ scope: 'CYCLE', cycleId, periodId: null }}
                  userId={member.userId}
                  onLiveScore={(total, max) => setConductLive({ total, max })}
                />
              </ScoreRow>
            )}

            {/* Xếp loại ma trận — kết quả, không phải ô nhập; đổi ngay theo ba ô trên. */}
            {showMatrix && (
              <ScoreRow label={t('CycleEvaluationPage.matrixRating')} hint={t('CycleEvaluationPage.intersectionOfConductCompletion')}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className={cn(
                    'text-2xl font-semibold leading-none tabular-nums',
                    matrixLive != null ? 'text-[var(--color-warning)]' : 'text-[var(--color-subtle-foreground)]'
                  )}>
                    {matrixLive ?? '—'}
                    {matrixLive != null && <span className="text-sm font-medium text-[var(--color-subtle-foreground)]">/5</span>}
                  </span>
                  <dl className="flex flex-wrap gap-x-4 gap-y-0.5">
                    <AxisLine
                      label={t('CycleEvaluationPage.conduct3')}
                      value={axes.behavior != null ? `${axes.behavior}/5` : null}
                      source={axes.behavior == null ? null
                        : (showQual && parsedQual != null ? t('CycleEvaluationPage.qualitativeKpi') : t('CycleEvaluationPage.conduct4'))}
                    />
                    <AxisLine
                      label={t('CycleEvaluationPage.completion2')}
                      value={axes.completion != null ? `${axes.completion}%` : null}
                      source={axes.completion == null ? null
                        : (member.avgCompletionPercent != null ? t('CycleEvaluationPage.quantitativeKpis') : t('CycleEvaluationPage.conduct4'))}
                    />
                  </dl>
                  {missingAxis && (
                    <span className="text-caption basis-full">{t('CycleEvaluationPage.cannotRateYetMissing')} {missingAxis}.</span>
                  )}
                </div>
              </ScoreRow>
            )}
          </div>
        </Section>

        {/* ── 3. Kết luận ──────────────────────────────────────────────── */}
        <Section title={t('CycleEvaluationPage.commentsEvidence')}>
          <div className="space-y-2">
            <label htmlFor="cycle-comment" className="text-label ml-1">{t('CycleEvaluationPage.commentsForTheEmployee')}</label>
            <Textarea
              id="cycle-comment"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              disabled={!canEdit}
              placeholder={t('CycleEvaluationPage.commentsForTheEmployeeThisCycle')}
            />
          </div>

          {/* Minh chứng chốt kỳ: gắn vào (kỳ, người) nên đính kèm được trước khi lưu điểm. */}
          <EvidenceAttachments target={evidenceKey.cycle(cycleId, member.userId)} readOnly={!canEdit} title={t('CycleEvaluationPage.cycleFinalizationEvidence')} />

          {member.evaluatedByName && (
            <p className="text-caption font-medium">
              {t('CycleEvaluationPage.scoredBy')} <span className="font-semibold text-[var(--color-muted-foreground)]">{member.evaluatedByName}</span>
              {member.evaluatedAt && ` · ${format(parseISO(member.evaluatedAt), 'HH:mm dd/MM/yyyy')}`}
            </p>
          )}
        </Section>
      </div>
    </Dialog>
  )
}

/** Chi tiết điểm từng đợt trong kỳ của một nhân viên. */
function PeriodBreakdownTable({ member }: { member: CycleUserEvaluation }) {
  const { t } = useTranslation('kpi')
  if (!member.periodBreakdown?.length) {
    return <p className="text-xs text-[var(--color-subtle-foreground)] italic px-1 py-2">{t('CycleEvaluationPage.noPeriodHasBeenAssignedTo')}</p>
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
              <th className="px-4 py-2.5">{t('CycleEvaluationPage.aPeriod')}</th>
              {showDimensions && <th className="px-4 py-2.5 text-center">{t('CycleEvaluationPage.quantitative')}</th>}
              {showDimensions && <th className="px-4 py-2.5 text-center">{t('CycleEvaluationPage.qualitative')}</th>}
              {showDimensions && <th className="px-4 py-2.5 text-center">{t('CycleEvaluationPage.rating2')}</th>}
              <th className="px-4 py-2.5 text-center">{t('CycleEvaluationPage.selfAssessment')}</th>
              <th className="px-4 py-2.5 text-center">{t('CycleEvaluationPage.directManagerAssessment')}</th>
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
          <span className="font-semibold">{t('CycleEvaluationPage.quantitative')}</span> {t('CycleEvaluationPage.isTheSystemScoreComputedFrom')}{' '}
          <span className="font-semibold">{t('CycleEvaluationPage.qualitative')}</span> {t('CycleEvaluationPage.isTheWeightedAverageLevelOf')}{' '}
          <span className="font-semibold">{t('CycleEvaluationPage.rating2')}</span> {t('CycleEvaluationPage.isThePerformanceMatrixResultAt')}
        </p>
      )}
    </div>
  )
}

