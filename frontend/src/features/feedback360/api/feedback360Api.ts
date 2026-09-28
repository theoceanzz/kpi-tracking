import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

export type F360Relationship = 'SELF' | 'MANAGER' | 'PEER' | 'DIRECT_REPORT' | 'OTHER'
export type F360CampaignStatus = 'DRAFT' | 'NOMINATING' | 'OPEN' | 'CLOSED' | 'RELEASED'
export type F360SubjectStatus =
  | 'NOMINATING' | 'NOMINATION_SUBMITTED' | 'APPROVED' | 'COLLECTING' | 'COMPLETED' | 'INSUFFICIENT'
export type F360AssignmentStatus = 'PENDING' | 'IN_PROGRESS' | 'SUBMITTED' | 'DECLINED' | 'REMOVED' | 'EXPIRED'
export type F360QuestionType = 'RATING' | 'TEXT'
export type F360ScoringMode = 'DEVELOPMENT_ONLY' | 'BEHAVIOR_AXIS' | 'BLEND_CONDUCT'

export const SCORING_MODE_LABEL = perLanguage((): Record<F360ScoringMode, string> => ({
  DEVELOPMENT_ONLY: i18n.t('feedback360:feedback360Api.developmentOnlyNotCountedTowardRating'),
  BEHAVIOR_AXIS: i18n.t('feedback360:feedback360Api.replaceTheConductScoreWhenThe'),
  BLEND_CONDUCT: i18n.t('feedback360:feedback360Api.blendWithTheConductScoreBy'),
}))

export const RELATIONSHIP_LABEL = perLanguage((): Record<F360Relationship, string> => ({
  SELF: i18n.t('feedback360:feedback360Api.selfAssessment'),
  MANAGER: i18n.t('feedback360:feedback360Api.manager'),
  PEER: i18n.t('feedback360:feedback360Api.peer'),
  DIRECT_REPORT: i18n.t('feedback360:feedback360Api.directReport'),
  OTHER: i18n.t('feedback360:feedback360Api.collaborator'),
}))

export const CAMPAIGN_STATUS_LABEL = perLanguage((): Record<F360CampaignStatus, string> => ({
  DRAFT: i18n.t('feedback360:feedback360Api.draft'),
  NOMINATING: i18n.t('feedback360:feedback360Api.nominating'),
  OPEN: i18n.t('feedback360:feedback360Api.evaluating'),
  CLOSED: i18n.t('feedback360:feedback360Api.closed'),
  RELEASED: i18n.t('feedback360:feedback360Api.published'),
}))

export const ASSIGNMENT_STATUS_LABEL = perLanguage((): Record<F360AssignmentStatus, string> => ({
  PENDING: i18n.t('feedback360:feedback360Api.notStarted'),
  IN_PROGRESS: i18n.t('feedback360:feedback360Api.inProgress'),
  SUBMITTED: i18n.t('feedback360:feedback360Api.submitted'),
  DECLINED: i18n.t('feedback360:feedback360Api.declined'),
  REMOVED: i18n.t('feedback360:feedback360Api.removed'),
  EXPIRED: i18n.t('feedback360:feedback360Api.expired'),
}))

// ───────────────────────── Bộ câu hỏi ─────────────────────────

export interface F360Question {
  id: string
  questionType: F360QuestionType
  text: string
  /** Rỗng = hỏi mọi nhóm. */
  relationships: F360Relationship[]
  required: boolean
  allowNa: boolean
  position: number
}

export interface F360Competency {
  id: string
  name: string
  description?: string | null
  weight: number
  position: number
  questions: F360Question[]
}

export interface F360Template {
  id: string
  name: string
  description?: string | null
  scaleMax: number
  isDefault: boolean
  totalWeight: number
  updatedAt?: string
  competencies: F360Competency[]
  openQuestions: F360Question[]
}

export interface F360QuestionInput {
  text: string
  relationships?: F360Relationship[]
  required?: boolean
  allowNa?: boolean
}

export interface F360TemplateInput {
  name: string
  description?: string | null
  scaleMax?: number
  copyFromId?: string
  competencies?: { name: string; description?: string | null; weight: number; questions: F360QuestionInput[] }[]
  openQuestions?: F360QuestionInput[]
}

// ───────────────────────── Chiến dịch ─────────────────────────

export interface F360Campaign {
  id: string
  name: string
  description?: string | null
  status: F360CampaignStatus
  kpiCycleId?: string | null
  kpiCycleName?: string | null
  templateId?: string | null
  templateName?: string | null
  scaleMax: number
  anonymityThreshold: number
  strictAnonymity: boolean
  includeSelf: boolean
  managerAnonymous: boolean
  releaseToSubject: boolean
  autoClose: boolean
  relationshipWeights: Record<F360Relationship, number>
  maxPeers: number
  maxDirectReports: number
  maxAssignmentsPerRater: number
  maxNominees: number
  allowNomination: boolean
  nominationDeadline?: string | null
  scoringMode: F360ScoringMode
  blendConductPercent?: number | null
  aiSummary: boolean
  unlinkedAt?: string | null
  orgAllowsRating: boolean
  /** Ngày mở dự kiến: tới giờ này nháp đủ điều kiện được tự khởi động. */
  startAt?: string | null
  dueAt?: string | null
  launchedAt?: string | null
  closedAt?: string | null
  releasedAt?: string | null
  createdAt: string
  createdByName?: string | null
  subjectCount: number
  assignmentCount: number
  submittedCount: number
  canManage: boolean
  /** Tên các năng lực được hỏi — tóm tắt cho thẻ chiến dịch. */
  competencyNames?: string[]
  questionCount?: number
}

export interface F360CampaignInput {
  name: string
  description?: string | null
  kpiCycleId?: string | null
  templateId?: string | null
  /** Năng lực + câu hỏi soạn ngay trong form — thành bộ câu hỏi riêng của chiến dịch. */
  questions?: F360TemplateInput
  startAt?: string | null
  dueAt?: string | null
  anonymityThreshold?: number
  includeSelf?: boolean
  managerAnonymous?: boolean
  releaseToSubject?: boolean
  autoClose?: boolean
  relationshipWeights?: Partial<Record<F360Relationship, number>>
  maxPeers?: number
  maxDirectReports?: number
  maxAssignmentsPerRater?: number
  maxNominees?: number
  allowNomination?: boolean
  nominationDeadline?: string | null
  strictAnonymity?: boolean
  scoringMode?: F360ScoringMode
  blendConductPercent?: number | null
  aiSummary?: boolean
}

export interface F360SubjectRow {
  id: string
  userId: string
  fullName: string
  email?: string | null
  avatarUrl?: string | null
  orgUnitId?: string | null
  orgUnitName?: string | null
  status: F360SubjectStatus
  overallScore?: number | null
  submittedCount: number
  assignmentCount: number
  progress: { relationship: F360Relationship; submitted: number; total: number }[]
  warnings: string[]
}

export interface F360AssignmentRow {
  id: string
  subjectId: string
  raterId: string
  raterName: string
  raterEmail?: string | null
  raterAvatarUrl?: string | null
  relationship: F360Relationship
  source: 'AUTO' | 'NOMINATED' | 'ADDED'
  status: F360AssignmentStatus
  declineReason?: string | null
  submittedAt?: string | null
  lastRemindedAt?: string | null
}

export interface F360GenerateResult {
  subjectsProcessed: number
  assignmentsCreated: number
  warnings: string[]
}

export interface F360Event {
  id: string
  action: string
  actorName?: string | null
  subjectName?: string | null
  detail?: string | null
  createdAt: string
}

// ───────────────────────── Người chấm ─────────────────────────

export interface F360Task {
  assignmentId: string
  campaignId: string
  campaignName: string
  dueAt?: string | null
  subjectUserId: string
  subjectName: string
  subjectAvatarUrl?: string | null
  relationship: F360Relationship
  status: F360AssignmentStatus
  anonymous: boolean
  submittedAt?: string | null
}

export interface F360FormQuestion {
  id: string
  questionType: F360QuestionType
  text: string
  required: boolean
  allowNa: boolean
  score?: number | null
  na?: boolean
  comment?: string | null
}

export interface F360Form {
  assignmentId: string
  campaignId: string
  campaignName: string
  dueAt?: string | null
  subjectName: string
  subjectAvatarUrl?: string | null
  subjectOrgUnitName?: string | null
  relationship: F360Relationship
  status: F360AssignmentStatus
  editable: boolean
  anonymous: boolean
  strictAnonymity: boolean
  anonymityThreshold: number
  scaleMax: number
  sections: { competencyKey?: string | null; title: string; questions: F360FormQuestion[] }[]
}

export interface F360AnswerInput {
  questionId: string
  score?: number | null
  na?: boolean
  comment?: string | null
}

// ───────────────────────── Báo cáo ─────────────────────────

export interface F360Group {
  key: string
  label: string
  relationships: string[]
  raterCount: number
  visible: boolean
  anonymous: boolean
  weight: number
}

export interface F360CompetencyScore {
  key: string
  name: string
  weight: number
  position: number
  byGroup: Record<string, number>
  self?: number | null
  others?: number | null
  gap?: number | null
  divergent?: boolean
}

export interface F360QuestionScore {
  id: string
  competencyKey?: string | null
  competencyName?: string | null
  text: string
  position: number
  byGroup: Record<string, number>
  hiddenGroups: string[]
  self?: number | null
  others?: number | null
}

export interface F360Result {
  scaleMax: number
  anonymityThreshold: number
  overallScore?: number | null
  selfScore?: number | null
  othersScore?: number | null
  responseCount: number
  insufficient: boolean
  groups: F360Group[]
  competencies: F360CompetencyScore[]
  questions: F360QuestionScore[]
  blindSpots: { name: string; self: number; others: number; gap: number }[]
  hiddenStrengths: { name: string; self: number; others: number; gap: number }[]
  top: { competencyName?: string | null; text: string; score: number }[]
  bottom: { competencyName?: string | null; text: string; score: number }[]
}

export interface F360Report {
  subjectId: string
  userId: string
  fullName: string
  avatarUrl?: string | null
  orgUnitName?: string | null
  campaignId: string
  campaignName: string
  campaignStatus: F360CampaignStatus
  subjectStatus: F360SubjectStatus
  closedAt?: string | null
  releasedAt?: string | null
  result?: F360Result | null
  comments: {
    questionId: string
    question: string
    items: { id: string; text: string; groupLabel: string; hidden: boolean }[]
  }[]
  aiSummary?: string | null
  canHideComments: boolean
  selfView: boolean
  /** TB nhóm đơn vị (đủ ngưỡng k) — chỉ có khi người xem không phải chính subject. */
  comparison?: { label: string; subjectCount: number; overall?: number | null; byCompetency: Record<string, number> } | null
}

export interface F360Nomination {
  subjectId: string
  campaignId: string
  campaignName: string
  nominationDeadline?: string | null
  status: F360SubjectStatus
  maxNominees: number
  submittedAt?: string | null
  approverName?: string | null
  subjectUserId: string
  subjectName: string
  subjectAvatarUrl?: string | null
  orgUnitName?: string | null
  raters: {
    assignmentId: string
    raterId: string
    name: string
    avatarUrl?: string | null
    relationship: F360Relationship
    source: 'AUTO' | 'NOMINATED' | 'ADDED'
  }[]
}

export interface F360Heatmap {
  scaleMax: number
  anonymityThreshold: number
  competencies: string[]
  rows: { orgUnitId?: string | null; orgUnitName: string; rolledUp: boolean; subjectCount: number; overall?: number | null; scores: Record<string, number> }[]
  excludedCount: number
}

export interface F360MyReport {
  subjectId: string
  campaignId: string
  campaignName: string
  releasedAt?: string | null
  overallScore?: number | null
  selfScore?: number | null
  scaleMax: number
  responseCount?: number | null
}

const BASE = '/feedback360'
const data = <T>(p: Promise<{ data: ApiResponse<T> }>) => p.then(r => r.data.data)

export const feedback360Api = {
  // Bộ câu hỏi
  listTemplates: (organizationId: string) =>
    data(axiosInstance.get<ApiResponse<F360Template[]>>(`${BASE}/templates`, { params: { organizationId } })),
  getTemplate: (organizationId: string, id: string) =>
    data(axiosInstance.get<ApiResponse<F360Template>>(`${BASE}/templates/${id}`, { params: { organizationId } })),

  // Chiến dịch
  listCampaigns: (organizationId: string) =>
    data(axiosInstance.get<ApiResponse<F360Campaign[]>>(`${BASE}/campaigns`, { params: { organizationId } })),
  getCampaign: (id: string) => data(axiosInstance.get<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}`)),
  /** Nháp: bộ đang soạn; đã khởi động: bản chụp câu hỏi lúc khởi động. */
  getCampaignQuestions: (id: string) =>
    data(axiosInstance.get<ApiResponse<F360Template>>(`${BASE}/campaigns/${id}/questions`)),
  createCampaign: (organizationId: string, body: F360CampaignInput) =>
    data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns`, body, { params: { organizationId } })),
  updateCampaign: (id: string, body: F360CampaignInput) =>
    data(axiosInstance.put<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}`, body)),
  deleteCampaign: (id: string) => axiosInstance.delete(`${BASE}/campaigns/${id}`),
  listSubjects: (id: string) =>
    data(axiosInstance.get<ApiResponse<F360SubjectRow[]>>(`${BASE}/campaigns/${id}/subjects`)),
  addSubjects: (id: string, body: { userIds?: string[]; orgUnitId?: string; includeChildren?: boolean }) =>
    data(axiosInstance.post<ApiResponse<F360SubjectRow[]>>(`${BASE}/campaigns/${id}/subjects`, body)),
  removeSubject: (id: string, subjectId: string) =>
    axiosInstance.delete(`${BASE}/campaigns/${id}/subjects/${subjectId}`),
  generateRaters: (id: string, reset: boolean) =>
    data(axiosInstance.post<ApiResponse<F360GenerateResult>>(`${BASE}/campaigns/${id}/generate-raters`, null, { params: { reset } })),
  listAssignments: (id: string, subjectId: string) =>
    data(axiosInstance.get<ApiResponse<F360AssignmentRow[]>>(`${BASE}/campaigns/${id}/subjects/${subjectId}/assignments`)),
  addAssignment: (id: string, body: { subjectId: string; raterId: string; relationship: F360Relationship }) =>
    data(axiosInstance.post<ApiResponse<F360AssignmentRow>>(`${BASE}/campaigns/${id}/assignments`, body)),
  removeAssignment: (id: string, assignmentId: string) =>
    axiosInstance.delete(`${BASE}/campaigns/${id}/assignments/${assignmentId}`),
  reopenAssignment: (id: string, assignmentId: string, reason: string) =>
    axiosInstance.post(`${BASE}/campaigns/${id}/assignments/${assignmentId}/reopen`, { reason }),
  launch: (id: string) => data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/launch`)),
  extend: (id: string, dueAt: string) =>
    data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/extend`, { dueAt })),
  close: (id: string) => data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/close`)),
  reopen: (id: string, reason: string, dueAt: string) =>
    data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/reopen`, { reason, dueAt })),
  release: (id: string) => data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/release`)),
  start: (id: string) => data(axiosInstance.post<ApiResponse<F360Campaign>>(`${BASE}/campaigns/${id}/start`)),
  heatmap: (id: string) => data(axiosInstance.get<ApiResponse<F360Heatmap>>(`${BASE}/campaigns/${id}/analytics`)),
  /** Tải Excel kết quả; trả Blob + tên file lấy từ Content-Disposition. */
  exportExcel: async (id: string) => {
    const res = await axiosInstance.get(`${BASE}/campaigns/${id}/export`, { responseType: 'blob' })
    const cd = String(res.headers['content-disposition'] ?? '')
    const m = /filename\*=UTF-8''([^;]+)/.exec(cd)
    return { blob: res.data as Blob, fileName: m?.[1] ? decodeURIComponent(m[1]) : 'danh-gia-360.xlsx' }
  },
  regenerateSummary: (id: string, subjectId: string) =>
    axiosInstance.post(`${BASE}/campaigns/${id}/subjects/${subjectId}/ai-summary`),

  // Đề cử
  myNominations: () => data(axiosInstance.get<ApiResponse<F360Nomination[]>>(`${BASE}/me/nominations`)),
  nominate: (subjectId: string, raterIds: string[]) =>
    data(axiosInstance.put<ApiResponse<F360Nomination>>(`${BASE}/me/nominations/${subjectId}`, { raterIds })),
  approvals: () => data(axiosInstance.get<ApiResponse<F360Nomination[]>>(`${BASE}/approvals`)),
  approve: (subjectId: string, body: { add?: { raterId: string; relationship: F360Relationship }[]; remove?: string[]; approve?: boolean }) =>
    data(axiosInstance.put<ApiResponse<F360Nomination>>(`${BASE}/approvals/${subjectId}`, body)),
  remind: (id: string) =>
    axiosInstance.post<ApiResponse<number>>(`${BASE}/campaigns/${id}/remind`).then(r => r.data),
  events: (id: string) => data(axiosInstance.get<ApiResponse<F360Event[]>>(`${BASE}/campaigns/${id}/events`)),

  // Người chấm
  myTasks: () => data(axiosInstance.get<ApiResponse<F360Task[]>>(`${BASE}/me/tasks`)),
  getForm: (assignmentId: string) =>
    data(axiosInstance.get<ApiResponse<F360Form>>(`${BASE}/assignments/${assignmentId}`)),
  saveDraft: (assignmentId: string, answers: F360AnswerInput[]) =>
    data(axiosInstance.put<ApiResponse<F360Form>>(`${BASE}/assignments/${assignmentId}/draft`, { answers })),
  submit: (assignmentId: string, answers: F360AnswerInput[]) =>
    data(axiosInstance.post<ApiResponse<F360Form>>(`${BASE}/assignments/${assignmentId}/submit`, { answers })),
  decline: (assignmentId: string, reason: string) =>
    axiosInstance.post(`${BASE}/assignments/${assignmentId}/decline`, { reason }),

  // Báo cáo
  myReports: () => data(axiosInstance.get<ApiResponse<F360MyReport[]>>(`${BASE}/me/reports`)),
  getReport: (subjectId: string) =>
    data(axiosInstance.get<ApiResponse<F360Report>>(`${BASE}/subjects/${subjectId}/report`)),
  hideAnswer: (answerId: string, reason: string) =>
    axiosInstance.post(`${BASE}/answers/${answerId}/hide`, { reason }),
}
