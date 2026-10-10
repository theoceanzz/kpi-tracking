import { appendFilesWithSources } from '@/features/documents/librarySource'
import axiosInstance from '@/lib/axios'
import { sendMultipart } from '@/lib/upload'
import type { ApiResponse } from '@/types/api'
import type {
  DiscussionComment, DiscussionLocation, DiscussionPage, DiscussionReactionType, DiscussionTargetType, MentionCandidate,
} from '../types'

const BASE = '/discussions'
const seg = (t: DiscussionTargetType) => t.toLowerCase()

export const discussionApi = {
  page: (type: DiscussionTargetType, id: string, cursor?: string | null, size = 20) =>
    axiosInstance
      .get<ApiResponse<DiscussionPage>>(`${BASE}/${seg(type)}/${id}/comments`, { params: { cursor: cursor ?? undefined, size } })
      .then((r) => r.data.data),

  around: (commentId: string) =>
    axiosInstance.get<ApiResponse<DiscussionPage>>(`${BASE}/comments/${commentId}/around`).then((r) => r.data.data),

  replies: (commentId: string, cursor?: string | null, size = 20) =>
    axiosInstance
      .get<ApiResponse<DiscussionPage>>(`${BASE}/comments/${commentId}/replies`, { params: { cursor: cursor ?? undefined, size } })
      .then((r) => r.data.data),

  locate: (commentId: string) =>
    axiosInstance.get<ApiResponse<DiscussionLocation>>(`${BASE}/comments/${commentId}/locate`).then((r) => r.data.data),

  create: (type: DiscussionTargetType, id: string, input: { body: string; parentId?: string | null; mentionIds: string[]; files: File[] }) => {
    const form = new FormData()
    if (input.body) form.append('body', input.body)
    if (input.parentId) form.append('parentId', input.parentId)
    input.mentionIds.forEach((m) => form.append('mentionIds', m))
    appendFilesWithSources(form, input.files)
    return sendMultipart<ApiResponse<DiscussionComment>>(`${BASE}/${seg(type)}/${id}/comments`, form)
      .then((r) => r.data.data)
  },

  update: (commentId: string, input: { body: string; mentionIds: string[] }) =>
    axiosInstance.patch<ApiResponse<DiscussionComment>>(`${BASE}/comments/${commentId}`, input).then((r) => r.data.data),

  remove: (commentId: string) => axiosInstance.delete(`${BASE}/comments/${commentId}`).then(() => undefined),

  react: (commentId: string, reaction: DiscussionReactionType) =>
    axiosInstance.put<ApiResponse<DiscussionComment>>(`${BASE}/comments/${commentId}/reactions/${reaction}`).then((r) => r.data.data),

  markRead: (type: DiscussionTargetType, id: string) =>
    axiosInstance.post(`${BASE}/${seg(type)}/${id}/read`).then(() => undefined),

  mentionable: (type: DiscussionTargetType, id: string, q: string) =>
    axiosInstance
      .get<ApiResponse<MentionCandidate[]>>(`${BASE}/${seg(type)}/${id}/mentionable`, { params: { q: q || undefined } })
      .then((r) => r.data.data),
}
