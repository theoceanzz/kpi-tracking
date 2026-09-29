import { intlDateLocale } from '@/i18n/format'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CalendarRange, ChevronDown, ListChecks, Settings2, SlidersHorizontal, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/common/DateTimePicker'
import { cn } from '@/lib/utils'
import { useKpiCycles } from '@/features/kpi/hooks/useKpiCycles'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useUpdateOrganization } from '@/features/orgunits/hooks/useUpdateOrganization'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  feedback360Api, RELATIONSHIP_LABEL, SCORING_MODE_LABEL,
  type F360Campaign, type F360CampaignInput, type F360Relationship, type F360ScoringMode, type F360Template,
} from '../api/feedback360Api'
import { useF360Campaigns, useF360Template, useF360Templates, useOrgId } from '../hooks/useFeedback360'
import { fmtDate, fromLocalInput, toLocalInput } from '../utils/f360Format'
import { allowedRange, suggestNominationDeadline, suggestWindow, windowProblem } from '../utils/f360Schedule'
import { questionCount, questionSetBlocker, toDraft, toTemplateInput, type QuestionSetDraft } from '../utils/questionSet'
import QuestionSetEditor from './QuestionSetEditor'
import CopyQuestionsPanel from './CopyQuestionsPanel'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { useStateDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'

const NO_CYCLE = '__none__'
const COPY_PLACEHOLDER = '__copy__'
const WEIGHTED: F360Relationship[] = ['MANAGER', 'PEER', 'DIRECT_REPORT', 'OTHER', 'SELF']

/**
 * Tạo/sửa chiến dịch 360.
 *
 * <p>Năng lực và câu hỏi được soạn THẲNG TRONG form này (như hạng mục soạn trong bộ tiêu chí BSC):
 * mỗi chiến dịch có bộ câu hỏi riêng, không còn màn "Bộ câu hỏi" tách rời phải tạo trước rồi quay lại
 * chọn. Chiến dịch mới bắt đầu từ bộ mặc định của tổ chức; muốn dùng lại câu hỏi của đợt trước thì
 * chép từ chiến dịch đó ("Chép câu hỏi từ").
 *
 * <p>Thời gian KHÔNG nhập tay: chọn mục đích (phát triển / vào xếp loại) và kỳ KPI, form tự điền ngày
 * mở và hạn trong kỳ theo `utils/f360Schedule` — vào xếp loại thì chạy cuối kỳ để kịp hiệu chỉnh/chốt,
 * phát triển thì giữa kỳ. "Điều chỉnh" cho sửa trong biên của kỳ; đổi kỳ hoặc mục đích là tính lại.
 *
 * <p>Ẩn danh, trọng số và luật chọn người chấm có mặc định tốt nên thu vào "Tuỳ chọn nâng cao".
 *
 * <p>Đang chạy (đề cử/đánh giá) chỉ đổi được tên, mô tả và hạn — phần còn lại đã quyết định phiếu
 * người ta đang điền nên được ẩn đi thay vì bày ra một loạt ô bị khoá.
 */
export default function CampaignFormDialog({ campaign, onClose, onSubmit, saving }: {
  campaign: F360Campaign | null
  onClose: () => void
  onSubmit: (body: F360CampaignInput) => void
  saving: boolean
}) {
  const { t: tr } = useTranslation('feedback360')
  const locked = !!campaign && campaign.status !== 'DRAFT'
  const orgId = useOrgId()
  const { data: org } = useOrganization(orgId)
  // Đọc cờ tổ chức trực tiếp (không lấy từ bản chiến dịch đã tải) để bật xong là form mở khoá ngay.
  const allowsRating = org ? !!org.feedback360AffectsRating : !!campaign?.orgAllowsRating
  const { hasPermission } = useHasPermission()
  const canConfigureOrg = hasPermission('COMPANY:UPDATE')
  const updateOrg = useUpdateOrganization(orgId)
  const enableRating = () => updateOrg.mutate({ feedback360AffectsRating: true }, {
    onSuccess: () => toast.success(tr('CampaignFormDialog.allowed360ToCountTowardThe')),
    onError: e => toast.error(getApiErrorMessage(e, tr('CampaignFormDialog.couldNotUpdateTheConfiguration'))),
  })
  const { data: templates = [], isSuccess: templatesLoaded } = useF360Templates(!locked)
  const { data: campaigns = [] } = useF360Campaigns()
  const { data: ownTemplate, isSuccess: ownLoaded } = useF360Template(!locked ? campaign?.templateId : null)
  const { data: cyclesPage } = useKpiCycles({ size: 100, sortBy: 'startDate', direction: 'desc' })
  const cycles = cyclesPage?.content ?? []

  const [form, setForm] = useState(() => ({
    name: campaign?.name ?? '',
    description: campaign?.description ?? '',
    kpiCycleId: campaign?.kpiCycleId ?? NO_CYCLE,
    startAt: toLocalInput(campaign?.startAt),
    dueAt: toLocalInput(campaign?.dueAt),
    anonymityThreshold: campaign?.anonymityThreshold ?? 3,
    includeSelf: campaign?.includeSelf ?? true,
    managerAnonymous: campaign?.managerAnonymous ?? false,
    releaseToSubject: campaign?.releaseToSubject ?? true,
    autoClose: campaign?.autoClose ?? true,
    maxPeers: campaign?.maxPeers ?? 5,
    maxDirectReports: campaign?.maxDirectReports ?? 6,
    maxAssignmentsPerRater: campaign?.maxAssignmentsPerRater ?? 10,
    maxNominees: campaign?.maxNominees ?? 5,
    allowNomination: campaign?.allowNomination ?? false,
    nominationDeadline: toLocalInput(campaign?.nominationDeadline),
    strictAnonymity: campaign?.strictAnonymity ?? true,
    aiSummary: campaign?.aiSummary ?? false,
    scoringMode: (campaign?.scoringMode ?? 'DEVELOPMENT_ONLY') as F360ScoringMode,
    blendConductPercent: campaign?.blendConductPercent ?? 60,
    weights: {
      MANAGER: 40, PEER: 30, DIRECT_REPORT: 20, OTHER: 10, SELF: 0,
      ...(campaign?.relationshipWeights ?? {}),
    } as Record<F360Relationship, number>,
  }))
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm(f => ({ ...f, [k]: v }))
  // Chỉ nháp phần thông tin chiến dịch; bộ câu hỏi nạp bất đồng bộ từ mẫu nên không đưa vào (sẽ bị coi nhầm là "đã sửa").
  const draft = useStateDraft(form, setForm, { key: `f360-campaign:${campaign?.id ?? 'new'}`, enabled: true })
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // Nháp đã có ngày mở/hạn thì giữ nguyên cho tới khi người dùng đổi kỳ hoặc mục đích.
  const [adjusting, setAdjusting] = useState(false)
  const [windowNote, setWindowNote] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(!!campaign)

  const cycleOf = (id: string) => cycles.find(c => c.id === id) ?? null
  const selectedCycle = cycleOf(form.kpiCycleId)

  /** Tính lại ngày mở/hạn (và hạn đề cử) cho mục đích + kỳ vừa chọn. */
  const applyWindow = (mode: F360ScoringMode, cycleId: string, patch: Partial<typeof form> = {}) => {
    const w = suggestWindow(mode, cycleOf(cycleId))
    if (typeof w === 'string') {
      setWindowNote(w)
      setForm(f => ({ ...f, ...patch, scoringMode: mode, kpiCycleId: cycleId, startAt: '', dueAt: '' }))
      return
    }
    setWindowNote(w.label)
    setAdjusting(false)
    setForm(f => ({
      ...f, ...patch, scoringMode: mode, kpiCycleId: cycleId,
      startAt: toLocalInput(w.start.toISOString()),
      dueAt: toLocalInput(w.due.toISOString()),
      nominationDeadline: toLocalInput(suggestNominationDeadline(w.start, w.due).toISOString()),
    }))
  }
  // Chiến dịch mới: điền khung gợi ý ngay lần đầu (không gắn kỳ → mở ngay, hạn sau 2 tuần).
  if (!seeded && !locked) {
    setSeeded(true)
    applyWindow(form.scoringMode, form.kpiCycleId)
  }
  const changeMode = (mode: F360ScoringMode) => {
    let cycleId = form.kpiCycleId
    if (mode !== 'DEVELOPMENT_ONLY' && cycleId === NO_CYCLE) {
      // Vào xếp loại bắt buộc có kỳ: chọn sẵn kỳ đang diễn ra / sắp kết thúc gần nhất.
      const now = Date.now()
      const current = cycles
        .filter(c => c.status !== 'LOCKED' && c.endDate && new Date(c.endDate).getTime() > now)
        .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())[0]
      cycleId = current?.id ?? NO_CYCLE
    }
    applyWindow(mode, cycleId)
  }
  const [questions, setQuestions] = useState<QuestionSetDraft | null>(null)
  // Nguồn đang xem trước để chép; Select "Chép câu hỏi từ…" luôn quay về placeholder (không giữ dấu tích).
  const [copySource, setCopySource] = useState<{ value: string; label: string; template: F360Template | null } | null>(null)

  // Nạp bản nháp câu hỏi một lần khi nguồn sẵn sàng: bộ hiện có của chiến dịch đang sửa, hoặc bộ
  // mặc định của tổ chức cho chiến dịch mới (tổ chức chưa có bộ nào thì bắt đầu từ một năng lực trống).
  if (!locked && questions === null) {
    if (campaign?.templateId ? ownLoaded : templatesLoaded) {
      setQuestions(toDraft(campaign?.templateId ? ownTemplate : templates.find(t => t.isDefault) ?? templates[0]))
    }
  }

  // Mỗi mục một giá trị RIÊNG (nhiều chiến dịch cũ cùng trỏ vào một bộ; dùng id bộ làm value thì
  // Radix coi chúng là một lựa chọn và tích tất cả cùng lúc).
  const copySources = [
    ...templates.map(t => ({ value: `tpl:${t.id}`, templateId: t.id, label: t.name + (t.isDefault ? tr('CampaignFormDialog.defaultTemplate') : tr('CampaignFormDialog.template')) })),
    ...campaigns.filter(c => c.id !== campaign?.id && c.templateId)
      .map(c => ({ value: `camp:${c.id}`, templateId: c.templateId!, label: tr('CampaignFormDialog.campaign', { name: c.name }) })),
  ]
  const previewCopy = (value: string) => {
    const src = copySources.find(s => s.value === value)
    if (!src || !orgId) return
    setCopySource({ value, label: src.label, template: null })
    feedback360Api.getTemplate(orgId, src.templateId)
      .then(t => setCopySource(cur => (cur?.value === value ? { ...cur, template: t } : cur)))
      .catch(e => { setCopySource(null); toast.error(getApiErrorMessage(e, tr('CampaignFormDialog.couldNotLoadTheQuestionSet'))) })
  }
  const othersWeight = WEIGHTED.filter(r => r !== 'SELF').reduce((s, r) => s + (Number(form.weights[r]) || 0), 0)
  const scoring = form.scoringMode !== 'DEVELOPMENT_ONLY'
  const scoringNeedsCycle = scoring && form.kpiCycleId === NO_CYCLE
  const startDate = form.startAt ? new Date(form.startAt) : null
  const dueDate = form.dueAt ? new Date(form.dueAt) : null
  const range = allowedRange(form.scoringMode, selectedCycle)
  const scheduleProblem = locked ? null : windowProblem(form.scoringMode, selectedCycle, startDate, dueDate)
  const nominationProblem = !locked && form.allowNomination && startDate && dueDate && (!form.nominationDeadline
    || new Date(form.nominationDeadline) <= startDate || new Date(form.nominationDeadline) >= dueDate)
    ? tr('CampaignFormDialog.theNominationDeadlineMustBeBetween') : null
  const scoringNeedsScale5 = scoring && !!questions && questions.scaleMax !== 5

  // Một dòng lý do duy nhất ở chân form — nói thẳng vì sao nút Lưu đang khoá.
  const blocker = !form.name.trim() ? tr('CampaignFormDialog.enterACampaignNameToSave')
    : !locked && othersWeight <= 0 ? tr('CampaignFormDialog.theTotalWeightOfTheGroups')
      : !locked && !questions ? tr('CampaignFormDialog.loadingQuestionSet')
      : !locked && questionSetBlocker(questions!) ? questionSetBlocker(questions!)
      : !locked && scoringNeedsCycle ? tr('CampaignFormDialog.aCampaignThatCountsTowardRating')
      : !locked && scheduleProblem ? (windowNote && !startDate ? windowNote : scheduleProblem)
      : nominationProblem ? nominationProblem
        : !locked && scoringNeedsScale5 ? tr('CampaignFormDialog.aCampaignThatCountsTowardRating2')
          : null

  const advancedSummary = [
    tr('CampaignFormDialog.anonymousFromPeople', { count: form.anonymityThreshold, value: form.strictAnonymity ? tr('CampaignFormDialog.strict') : '' }),
    form.aiSummary ? tr('CampaignFormDialog.aiSummary') : null,
    form.autoClose ? tr('CampaignFormDialog.autoClosesAfterTheDeadline') : null,
  ].filter(Boolean).join(' · ')

  const submit = () => {
    const body: F360CampaignInput = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      dueAt: fromLocalInput(form.dueAt),
      nominationDeadline: form.allowNomination ? fromLocalInput(form.nominationDeadline) : null,
    }
    if (!locked) {
      Object.assign(body, {
        kpiCycleId: form.kpiCycleId === NO_CYCLE ? null : form.kpiCycleId,
        startAt: fromLocalInput(form.startAt),
        questions: questions ? toTemplateInput(questions, form.name) : undefined,
        anonymityThreshold: form.anonymityThreshold,
        includeSelf: form.includeSelf,
        managerAnonymous: form.managerAnonymous,
        releaseToSubject: form.releaseToSubject,
        autoClose: form.autoClose,
        maxPeers: form.maxPeers,
        maxDirectReports: form.maxDirectReports,
        maxAssignmentsPerRater: form.maxAssignmentsPerRater,
        relationshipWeights: form.weights,
        maxNominees: form.maxNominees,
        allowNomination: form.allowNomination,
        strictAnonymity: form.strictAnonymity,
        aiSummary: form.aiSummary,
        scoringMode: form.scoringMode,
        blendConductPercent: form.scoringMode === 'BLEND_CONDUCT' ? form.blendConductPercent : null,
      })
    }
    onSubmit(body)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="xl"
      title={campaign ? tr('CampaignFormDialog.edit360Campaign') : tr('CampaignFormDialog.create360Campaign')}
      description={locked
        ? tr('CampaignFormDialog.theCampaignIsRunningSoOnly')
        : tr('CampaignFormDialog.theCampaignIsSavedAsA')}
      footer={
        <DialogFooter
          note={blocker ?? undefined}
          secondary={<Button variant="outline" onClick={onClose}>{tr('CampaignFormDialog.cancel')}</Button>}
          primary={<Button onClick={submit} disabled={!!blocker || saving}>{saving ? tr('CampaignFormDialog.saving') : campaign ? tr('CampaignFormDialog.save') : tr('CampaignFormDialog.createCampaign')}</Button>}
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-5">
        {/* ── Thông tin chính ── */}
        <div className="space-y-3">
          <Field label={tr('CampaignFormDialog.campaignName')}>
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder={tr('CampaignFormDialog.eG360ReviewFirstHalf')} />
          </Field>

          {locked ? (
            <Field label={tr('CampaignFormDialog.evaluationDeadline')}>
              <DateTimePicker value={form.dueAt} onChange={v => set('dueAt', v)} />
            </Field>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={tr('CampaignFormDialog.purpose')}>
                  <Select value={form.scoringMode} onValueChange={v => changeMode(v as F360ScoringMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SCORING_MODE_LABEL()) as F360ScoringMode[]).map(k => (
                        <SelectItem key={k} value={k} disabled={k !== 'DEVELOPMENT_ONLY' && !allowsRating}>{SCORING_MODE_LABEL()[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label={tr('CampaignFormDialog.kpiCycle')} hint={scoring ? tr('CampaignFormDialog.requiredWhenCountingTowardRating') : tr('CampaignFormDialog.optional')}>
                  <Select value={form.kpiCycleId} onValueChange={v => applyWindow(form.scoringMode, v)}>
                    <SelectTrigger><SelectValue placeholder={tr('CampaignFormDialog.chooseCycle')} /></SelectTrigger>
                    <SelectContent>
                      {!scoring && <SelectItem value={NO_CYCLE}>{tr('CampaignFormDialog.noCycle')}</SelectItem>}
                      {scoring && form.kpiCycleId === NO_CYCLE && <SelectItem value={NO_CYCLE} disabled>{tr('CampaignFormDialog.chooseKpiCycle')}</SelectItem>}
                      {cycles.map(c => (
                        <SelectItem key={c.id} value={c.id} disabled={scoring && c.status === 'LOCKED'}>
                          {c.name} ({fmtDate(c.startDate)} - {fmtDate(c.endDate)}){c.status === 'LOCKED' ? tr('CampaignFormDialog.locked') : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              {!allowsRating && (
                <div className="flex flex-wrap items-center gap-3 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2">
                  <p className="min-w-0 flex-1 text-caption">
                    {tr('CampaignFormDialog.want360ToCountTowardThe')}
                    {!canConfigureOrg && tr('CampaignFormDialog.askAnAdministratorToEnableIt')}
                  </p>
                  {canConfigureOrg && (
                    <Button size="sm" variant="outline" onClick={enableRating} disabled={updateOrg.isPending}>
                      {updateOrg.isPending ? tr('CampaignFormDialog.enabling') : tr('CampaignFormDialog.allow')}
                    </Button>
                  )}
                </div>
              )}
              {form.scoringMode === 'BLEND_CONDUCT' && (
                <div className="grid items-end gap-3 sm:grid-cols-2">
                  <NumberField label={tr('CampaignFormDialog.shareOfTheManagersConductScore')} value={form.blendConductPercent} onChange={v => set('blendConductPercent', v)} />
                  <p className="pb-2 text-caption tabular-nums">
                    {tr('CampaignFormDialog.n360ScoreShare')} {Math.max(0, 100 - (Number(form.blendConductPercent) || 0))}%
                  </p>
                </div>
              )}
              <p className="flex items-start gap-1.5 text-caption">
                <Target size={13} className="mt-0.5 shrink-0" />
                <span>{MODE_HINT[form.scoringMode](form.blendConductPercent)}</span>
              </p>

              {/* ── Thời gian: tự điền theo kỳ + mục đích ── */}
              <div className="rounded-control border border-[var(--color-border)] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <CalendarRange size={16} className="shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    {startDate && dueDate ? (
                      <p className="text-sm">
                        {tr('CampaignFormDialog.open')} <span className="font-semibold tabular-nums">{fmtDateTime(startDate)}</span>
                        {' → '}{tr('CampaignFormDialog.due')} <span className="font-semibold tabular-nums">{fmtDateTime(dueDate)}</span>
                        <span className="text-caption"> · {Math.max(1, Math.round((dueDate.getTime() - startDate.getTime()) / 86_400_000))} {tr('CampaignFormDialog.days')}</span>
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--color-muted-foreground)]">{tr('CampaignFormDialog.noTimeFrameYet')}</p>
                    )}
                    <p className="text-caption">
                      {windowNote ?? (campaign ? tr('CampaignFormDialog.timeFrameSavedChangeTheCycle') : '')}
                      {startDate ? tr('CampaignFormDialog.onceThereAreEnoughRatersThe') : ''}
                    </p>
                  </div>
                  {(startDate || form.kpiCycleId === NO_CYCLE) && (
                    <Button variant="ghost" size="sm" onClick={() => setAdjusting(a => !a)} aria-expanded={adjusting}>
                      <SlidersHorizontal /> {adjusting ? tr('CampaignFormDialog.done') : tr('CampaignFormDialog.adjust')}
                    </Button>
                  )}
                </div>
                {adjusting && (
                  <div className="mt-3 space-y-2 border-t border-[var(--color-border)] pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={tr('CampaignFormDialog.startDate')}><DateTimePicker value={form.startAt} onChange={v => { set('startAt', v); setWindowNote(null) }} /></Field>
                      <Field label={tr('CampaignFormDialog.evaluationDeadline')}><DateTimePicker value={form.dueAt} onChange={v => { set('dueAt', v); setWindowNote(null) }} /></Field>
                    </div>
                    {range && (
                      <p className="text-caption">
                        {tr('CampaignFormDialog.allowedWithin')} {fmtDate(range.min.toISOString())} - {fmtDate(range.max.toISOString())}
                        {scoring ? tr('CampaignFormDialog.fromTheStartOfTheCycle') : tr('CampaignFormDialog.withinTheCycle')}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <Field label={tr('CampaignFormDialog.description')} hint={tr('CampaignFormDialog.optional')}>
            <Textarea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </Field>
        </div>

        {!locked && (
          <>
            {/* ── Câu hỏi đánh giá: soạn thẳng tại đây ── */}
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="flex items-center gap-1.5 text-sm font-semibold"><ListChecks size={15} className="text-slate-400" />{tr('CampaignFormDialog.evaluationQuestions')}</h4>
                  <p className="text-caption">
                    {questions ? tr('CampaignFormDialog.competenciesQuestions', { length: questions.competencies.length, questions: questionCount(questions) }) : ''}
                    {tr('CampaignFormDialog.eachCompetencyHasAWeightTotal')}
                  </p>
                </div>
                {copySources.length > 0 && (
                  <Select value={COPY_PLACEHOLDER} onValueChange={previewCopy}>
                    <SelectTrigger className="h-8 w-full sm:w-[240px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={COPY_PLACEHOLDER} disabled>{tr('CampaignFormDialog.copyQuestionsFrom')}</SelectItem>
                      {copySources.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {questions && copySource ? (
                <CopyQuestionsPanel
                  key={copySource.value}
                  sourceLabel={copySource.label}
                  template={copySource.template}
                  current={questions}
                  onCancel={() => setCopySource(null)}
                  onApply={(next, n) => {
                    setQuestions(next)
                    setCopySource(null)
                    const total = Math.round(next.competencies.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 100) / 100
                    toast.success(tr('CampaignFormDialog.copiedQuestions', { count: n, value: Math.abs(total - 100) >= 0.01 ? tr('CampaignFormDialog.theTotalWeightIsClickSplit', { total }) : '' }))
                  }}
                />
              ) : questions
                ? <QuestionSetEditor value={questions} onChange={setQuestions} />
                : <div className="h-24 animate-pulse rounded-card bg-[var(--color-muted)]" />}
            </section>

            {/* ── Quy trình: ba lựa chọn thường phải quyết cho mỗi chiến dịch ── */}
            <section className="space-y-1">
              <h4 className="text-sm font-semibold">{tr('CampaignFormDialog.process')}</h4>
              <Toggle label={tr('CampaignFormDialog.revieweesAssessThemselves')} hint={tr('CampaignFormDialog.forComparisonWithOthersBlindSpots')} checked={form.includeSelf} onChange={v => set('includeSelf', v)} />
              <Toggle label={tr('CampaignFormDialog.letRevieweesNominateAdditionalRaters')} hint={tr('CampaignFormDialog.opensANominationPhaseBeforeScoring')} checked={form.allowNomination} onChange={v => set('allowNomination', v)} />
              {form.allowNomination && (
                <div className="grid gap-3 pb-2 sm:grid-cols-2">
                  <Field label={tr('CampaignFormDialog.nominationDeadline')}><DateTimePicker value={form.nominationDeadline} onChange={v => set('nominationDeadline', v)} /></Field>
                  <NumberField label={tr('CampaignFormDialog.maxNominees')} value={form.maxNominees} onChange={v => set('maxNominees', v)} />
                </div>
              )}
              <Toggle label={tr('CampaignFormDialog.letRevieweesViewTheirReportWhen')} checked={form.releaseToSubject} onChange={v => set('releaseToSubject', v)} />
            </section>

            {/* ── Tuỳ chọn nâng cao: mặc định đã hợp lý, chỉ mở khi cần ── */}
            <section className="rounded-card border border-[var(--color-border)]">
              <button type="button" onClick={() => setAdvancedOpen(o => !o)} aria-expanded={advancedOpen}
                className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <Settings2 size={16} className="shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{tr('CampaignFormDialog.advancedOptions')}</span>
                  <span className="block truncate text-caption">{advancedSummary}</span>
                </span>
                <ChevronDown size={16} className={cn('shrink-0 text-[var(--color-muted-foreground)] transition-transform', advancedOpen && 'rotate-180')} />
              </button>
              {advancedOpen && (
                <div className="space-y-5 border-t border-[var(--color-border)] p-4">
                  <Group title={tr('CampaignFormDialog.anonymity')}>
                    <Field label={tr('CampaignFormDialog.minimumFormsPerGroupToShow')}>
                      <Select value={String(form.anonymityThreshold)} onValueChange={v => set('anonymityThreshold', Number(v))}>
                        <SelectTrigger className="sm:max-w-[240px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} {tr('CampaignFormDialog.people')}{n === 3 ? tr('CampaignFormDialog.recommended') : ''}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Toggle label={tr('CampaignFormDialog.strictAnonymity')} hint={tr('CampaignFormDialog.onCloseRemovesTheLinkBetween')} checked={form.strictAnonymity} onChange={v => set('strictAnonymity', v)} />
                    <Toggle label={tr('CampaignFormDialog.alsoAnonymizeManagersForms')} hint={tr('CampaignFormDialog.thereIsUsuallyOnlyOneManager')} checked={form.managerAnonymous} onChange={v => set('managerAnonymous', v)} />
                  </Group>

                  <Group title={tr('CampaignFormDialog.automation')}>
                    <Toggle label={tr('CampaignFormDialog.autoCloseTheCampaign24Hours')} checked={form.autoClose} onChange={v => set('autoClose', v)} />
                    <Toggle label={tr('CampaignFormDialog.summarizeCommentsWithAiOnClose')} hint={tr('CampaignFormDialog.onlySummarizesWhenThereAreEnough')} checked={form.aiSummary} onChange={v => set('aiSummary', v)} />
                  </Group>

                  <Group title={tr('CampaignFormDialog.weightsByGroup')} hint={tr('CampaignFormDialog.weightsOfAbsentOrHiddenGroups')}>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                      {WEIGHTED.map(r => (
                        <NumberField key={r} label={RELATIONSHIP_LABEL()[r]} value={form.weights[r]}
                          onChange={v => set('weights', { ...form.weights, [r]: v })} />
                      ))}
                    </div>
                  </Group>

                  <Group title={tr('CampaignFormDialog.automaticRaterSelection')}>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <NumberField label={tr('CampaignFormDialog.maxPeers')} value={form.maxPeers} onChange={v => set('maxPeers', v)} />
                      <NumberField label={tr('CampaignFormDialog.maxDirectReports')} value={form.maxDirectReports} onChange={v => set('maxDirectReports', v)} />
                      <NumberField label={tr('CampaignFormDialog.maxFormsPerRater')} value={form.maxAssignmentsPerRater} onChange={v => set('maxAssignmentsPerRater', v)} />
                    </div>
                  </Group>
                </div>
              )}
            </section>
          </>
        )}
      </div>

    </Dialog>
  )
}

/** Một câu nói rõ chế độ làm gì với điểm hành vi — cùng một tên "điểm hành vi" ở mọi chỗ. */
const MODE_HINT: Record<F360ScoringMode, (blend: number) => string> = {
  DEVELOPMENT_ONLY: () => i18n.t('feedback360:CampaignFormDialog.n360ResultsAreForRevieweesAnd'),
  BEHAVIOR_AXIS: () => i18n.t('feedback360:CampaignFormDialog.anyoneWhoseManagerHasNotScored')
    + i18n.t('feedback360:CampaignFormDialog.onlyOneCampaignPerCycleCounts'),
  BLEND_CONDUCT: blend => i18n.t('feedback360:CampaignFormDialog.conductScoreManagerScore360Score', { blend, max: Math.max(0, 100 - blend) })
    + i18n.t('feedback360:CampaignFormDialog.onlyOneCampaignPerCycleCounts'),
}

function fmtDateTime(d: Date) {
  return d.toLocaleString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline gap-1.5 text-xs font-medium">
        {label}{hint && <span className="font-normal text-[var(--color-muted-foreground)]">({hint})</span>}
      </span>
      {children}
    </label>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <h5 className="text-sm font-semibold">{title}</h5>
        {hint && <p className="text-caption">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-caption">{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5 shrink-0" />
    </div>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <Input type="number" min={0} className="no-edit-hint" value={value} onChange={e => onChange(Number(e.target.value))} />
    </Field>
  )
}
