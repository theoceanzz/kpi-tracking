import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { useAuthStore } from '@/store/authStore'
import {
  feedback360Api,
  type F360AnswerInput,
  type F360CampaignInput,
  type F360Relationship,
} from '../api/feedback360Api'
import { useTranslation } from 'react-i18next'

const KEY = 'feedback360'

export function useOrgId() {
  return useAuthStore(s => s.user?.memberships?.[0]?.organizationId)
}

/** Mutation có toast thành công/thất bại và làm mới các query 360 liên quan. */
function useF360Mutation<TVars, TData>(
  fn: (vars: TVars) => Promise<TData>,
  opts: { success?: string | ((data: TData) => string); error: string; invalidate?: unknown[][] },
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: data => {
      const msg = typeof opts.success === 'function' ? opts.success(data) : opts.success
      if (msg) toast.success(msg)
      ;(opts.invalidate ?? [[KEY]]).forEach(queryKey => qc.invalidateQueries({ queryKey }))
    },
    onError: (e: unknown) => {
      toast.error(getApiErrorMessage(e, opts.error))
    },
  })
}

// ───────────────────────── Bộ câu hỏi ─────────────────────────

export function useF360Templates(enabled = true) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: [KEY, 'templates', orgId],
    queryFn: () => feedback360Api.listTemplates(orgId!),
    enabled: !!orgId && enabled,
  })
}

/** Một bộ câu hỏi đầy đủ (kèm năng lực) — bộ riêng của chiến dịch đang sửa, hoặc bộ để chép. */
export function useF360Template(id: string | null | undefined) {
  const orgId = useOrgId()
  return useQuery({
    queryKey: [KEY, 'template', orgId, id],
    queryFn: () => feedback360Api.getTemplate(orgId!, id!),
    enabled: !!orgId && !!id,
  })
}

// ───────────────────────── Chiến dịch ─────────────────────────

export function useF360Campaigns() {
  const orgId = useOrgId()
  return useQuery({
    queryKey: [KEY, 'campaigns', orgId],
    queryFn: () => feedback360Api.listCampaigns(orgId!),
    enabled: !!orgId,
  })
}

export function useF360Campaign(id?: string | null) {
  return useQuery({
    queryKey: [KEY, 'campaign', id],
    queryFn: () => feedback360Api.getCampaign(id!),
    enabled: !!id,
  })
}

export function useF360CampaignQuestions(id?: string | null) {
  return useQuery({
    queryKey: [KEY, 'campaign', id, 'questions'],
    queryFn: () => feedback360Api.getCampaignQuestions(id!),
    enabled: !!id,
  })
}

export function useF360Subjects(campaignId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'subjects', campaignId],
    queryFn: () => feedback360Api.listSubjects(campaignId!),
    enabled: !!campaignId,
  })
}

export function useF360Assignments(campaignId?: string | null, subjectId?: string | null) {
  return useQuery({
    queryKey: [KEY, 'assignments', campaignId, subjectId],
    queryFn: () => feedback360Api.listAssignments(campaignId!, subjectId!),
    enabled: !!campaignId && !!subjectId,
  })
}

export function useF360Events(campaignId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'events', campaignId],
    queryFn: () => feedback360Api.events(campaignId!),
    enabled: !!campaignId && enabled,
  })
}

export function useF360CampaignMutations() {
  const { t } = useTranslation('feedback360')
  const orgId = useOrgId()
  return {
    create: useF360Mutation((body: F360CampaignInput) => feedback360Api.createCampaign(orgId!, body),
      { success: t('useFeedback360.campaignCreated'), error: t('useFeedback360.couldNotCreateTheCampaign') }),
    update: useF360Mutation(({ id, body }: { id: string; body: F360CampaignInput }) => feedback360Api.updateCampaign(id, body),
      { success: t('useFeedback360.campaignSaved'), error: t('useFeedback360.couldNotSaveTheCampaign') }),
    remove: useF360Mutation((id: string) => feedback360Api.deleteCampaign(id),
      { success: t('useFeedback360.campaignDeleted'), error: t('useFeedback360.couldNotDeleteTheCampaign') }),
    addSubjects: useF360Mutation(({ id, body }: { id: string; body: { userIds?: string[]; orgUnitId?: string; includeChildren?: boolean } }) =>
      feedback360Api.addSubjects(id, body),
      { success: t('useFeedback360.revieweesAdded'), error: t('useFeedback360.couldNotAddReviewees') }),
    removeSubject: useF360Mutation(({ id, subjectId }: { id: string; subjectId: string }) => feedback360Api.removeSubject(id, subjectId),
      { success: t('useFeedback360.revieweeRemoved'), error: t('useFeedback360.couldNotRemoveTheReviewee') }),
    generateRaters: useF360Mutation(({ id, reset }: { id: string; reset: boolean }) => feedback360Api.generateRaters(id, reset),
      { success: r => t('useFeedback360.createdFormsForPeople', { assignmentsCreated: r.assignmentsCreated, subjectsProcessed: r.subjectsProcessed }), error: t('useFeedback360.couldNotGenerateRaters') }),
    addAssignment: useF360Mutation(({ id, body }: { id: string; body: { subjectId: string; raterId: string; relationship: F360Relationship } }) =>
      feedback360Api.addAssignment(id, body),
      { success: t('useFeedback360.raterAdded'), error: t('useFeedback360.couldNotAddTheRater') }),
    removeAssignment: useF360Mutation(({ id, assignmentId }: { id: string; assignmentId: string }) =>
      feedback360Api.removeAssignment(id, assignmentId),
      { success: t('useFeedback360.raterRemoved'), error: t('useFeedback360.couldNotRemoveTheRater') }),
    reopenAssignment: useF360Mutation(({ id, assignmentId, reason }: { id: string; assignmentId: string; reason: string }) =>
      feedback360Api.reopenAssignment(id, assignmentId, reason),
      { success: t('useFeedback360.formReopenedAndTheRaterNotified'), error: t('useFeedback360.couldNotReopenTheForm') }),
    launch: useF360Mutation((id: string) => feedback360Api.launch(id),
      { success: t('useFeedback360.campaignStartedRatersHaveBeenInvited'), error: t('useFeedback360.couldNotStartTheCampaign') }),
    extend: useF360Mutation(({ id, dueAt }: { id: string; dueAt: string }) => feedback360Api.extend(id, dueAt),
      { success: t('useFeedback360.extended'), error: t('useFeedback360.couldNotExtend') }),
    close: useF360Mutation((id: string) => feedback360Api.close(id),
      { success: t('useFeedback360.campaignClosedAndResultsComputed'), error: t('useFeedback360.couldNotCloseTheCampaign') }),
    reopen: useF360Mutation(({ id, reason, dueAt }: { id: string; reason: string; dueAt: string }) =>
      feedback360Api.reopen(id, reason, dueAt),
      { success: t('useFeedback360.campaignReopened'), error: t('useFeedback360.couldNotReopenTheCampaign') }),
    release: useF360Mutation((id: string) => feedback360Api.release(id),
      { success: t('useFeedback360.reportsPublished'), error: t('useFeedback360.couldNotPublishTheReports') }),
    start: useF360Mutation((id: string) => feedback360Api.start(id),
      { success: t('useFeedback360.scoringStartedRatersHaveBeenInvited'), error: t('useFeedback360.couldNotStart') }),
    exportExcel: useF360Mutation(async (id: string) => {
      const { blob, fileName } = await feedback360Api.exportExcel(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    }, { error: t('useFeedback360.couldNotExportTheExcelFile'), invalidate: [] }),
    regenerateSummary: useF360Mutation(({ id, subjectId }: { id: string; subjectId: string }) =>
      feedback360Api.regenerateSummary(id, subjectId),
      { success: t('useFeedback360.regeneratingTheSummaryReloadTheReport'), error: t('useFeedback360.couldNotRegenerateTheSummary'), invalidate: [] }),
    remind: useF360Mutation((id: string) => feedback360Api.remind(id),
      { success: r => r.message ?? t('useFeedback360.reminderSent'), error: t('useFeedback360.couldNotSendTheReminder') }),
  }
}

// ───────────────────────── Người chấm & báo cáo ─────────────────────────

export function useF360Tasks() {
  return useQuery({ queryKey: [KEY, 'tasks'], queryFn: feedback360Api.myTasks })
}

export function useF360MyReports(enabled = true) {
  return useQuery({ queryKey: [KEY, 'my-reports'], queryFn: feedback360Api.myReports, enabled })
}

export function useF360Form(assignmentId?: string) {
  return useQuery({
    queryKey: [KEY, 'form', assignmentId],
    queryFn: () => feedback360Api.getForm(assignmentId!),
    enabled: !!assignmentId,
    // Phiếu đang điền: không tự tải lại khi quay lại tab, kẻo đè lên lựa chọn chưa kịp lưu.
    refetchOnWindowFocus: false,
  })
}

export function useF360FormMutations(assignmentId: string) {
  const { t } = useTranslation('feedback360')
  const qc = useQueryClient()
  const setForm = (data: unknown) => qc.setQueryData([KEY, 'form', assignmentId], data)
  const saveDraft = useMutation({
    mutationFn: (answers: F360AnswerInput[]) => feedback360Api.saveDraft(assignmentId, answers),
    onSuccess: data => {
      setForm(data)
      qc.invalidateQueries({ queryKey: [KEY, 'tasks'] })
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, t('useFeedback360.couldNotSaveTheDraft'))),
  })
  const submit = useMutation({
    mutationFn: (answers: F360AnswerInput[]) => feedback360Api.submit(assignmentId, answers),
    onSuccess: data => {
      setForm(data)
      qc.invalidateQueries({ queryKey: [KEY, 'tasks'] })
      toast.success(t('useFeedback360.evaluationFormSubmitted'))
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, t('useFeedback360.couldNotSubmitTheForm'))),
  })
  const decline = useMutation({
    mutationFn: (reason: string) => feedback360Api.decline(assignmentId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      toast.success(t('useFeedback360.formDeclined'))
    },
    onError: (e: unknown) => toast.error(getApiErrorMessage(e, t('useFeedback360.couldNotDeclineTheForm'))),
  })
  return { saveDraft, submit, decline }
}

export function useF360Heatmap(campaignId?: string | null, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'heatmap', campaignId],
    queryFn: () => feedback360Api.heatmap(campaignId!),
    enabled: !!campaignId && enabled,
  })
}

export function useF360Nominations() {
  return useQuery({ queryKey: [KEY, 'nominations'], queryFn: feedback360Api.myNominations })
}

export function useF360Approvals() {
  return useQuery({ queryKey: [KEY, 'approvals'], queryFn: feedback360Api.approvals })
}

export function useF360NominationMutations() {
  const { t } = useTranslation('feedback360')
  return {
    nominate: useF360Mutation(({ subjectId, raterIds }: { subjectId: string; raterIds: string[] }) =>
      feedback360Api.nominate(subjectId, raterIds),
      { success: t('useFeedback360.nominationsSentToTheApprover'), error: t('useFeedback360.couldNotSendTheNominations') }),
    approve: useF360Mutation(({ subjectId, body }: {
      subjectId: string
      body: { add?: { raterId: string; relationship: F360Relationship }[]; remove?: string[]; approve?: boolean }
    }) => feedback360Api.approve(subjectId, body),
      { success: t('useFeedback360.raterListUpdated'), error: t('useFeedback360.couldNotUpdateTheList') }),
  }
}

export function useF360Report(subjectId?: string) {
  return useQuery({
    queryKey: [KEY, 'report', subjectId],
    queryFn: () => feedback360Api.getReport(subjectId!),
    enabled: !!subjectId,
    retry: false,
  })
}

export function useF360HideAnswer(subjectId: string) {
  const { t } = useTranslation('feedback360')
  return useF360Mutation(({ answerId, reason }: { answerId: string; reason: string }) =>
    feedback360Api.hideAnswer(answerId, reason),
  { success: t('useFeedback360.commentHidden'), error: t('useFeedback360.couldNotHideTheComment'), invalidate: [[KEY, 'report', subjectId]] })
}
