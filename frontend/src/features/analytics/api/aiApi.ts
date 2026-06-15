import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse, PageParams } from '@/types/api'

export interface AiChatRequest {
  message: string
  conversationId?: string
}

export interface AiChatResponse {
  text: string
  toolUsed?: string
  toolResult?: any
}

export interface ConversationResponse {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

export interface MessageResponse {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  msgIndex: number
  createdAt: string
}

export type InsightType = 'EXCEED' | 'BELOW' | 'SPIKE' | 'DROP' | 'DEADLINE_RISK'

export interface InsightContext {
  entityType?: string
  entityId?: string
  entityName?: string
  metricKey?: string
  value?: number
  deltaPct?: number
  periodLabel?: string
  daysLeft?: number
}

export interface InsightCard {
  id: string
  type: InsightType
  severity: string
  title: string
  insightText: string
  questionText: string
  context?: InsightContext
}

export interface FollowupPools {
  technical: string[]
  management: string[]
}

export interface FollowupRequest {
  conversationId?: string
  turn: number
  context: string
}

export const aiApi = {
  chat: (request: AiChatRequest) =>
    axiosInstance
      .post<ApiResponse<AiChatResponse>>('/ai/chat-org-unit', request)
      .then(res => res.data.data),

  createConversation: (title?: string) =>
    axiosInstance
      .post<ApiResponse<ConversationResponse>>('/ai/conversations', { title })
      .then(res => res.data.data),

  getConversations: (params?: PageParams) =>
    axiosInstance
      .get<ApiResponse<PageResponse<ConversationResponse>>>('/ai/conversations', { params })
      .then(res => res.data.data),

  deleteConversation: (id: string) =>
    axiosInstance
      .delete<ApiResponse<void>>(`/ai/conversations/${id}`)
      .then(res => res.data),

  getMessages: (conversationId: string, params?: PageParams) =>
    axiosInstance
      .get<ApiResponse<PageResponse<MessageResponse>>>(
        `/ai/conversations/${conversationId}/messages`,
        { params },
      )
      .then(res => res.data.data),

  getInsights: () =>
    axiosInstance
      .get<ApiResponse<InsightCard[]>>('/ai/insights')
      .then(res => res.data.data),

  getFollowups: (request: FollowupRequest) =>
    axiosInstance
      .post<ApiResponse<FollowupPools>>('/ai/followups', request)
      .then(res => res.data.data),
}
