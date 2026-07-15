import axiosInstance from '@/lib/axios'
import type { ApiResponse, PageResponse, PageParams } from '@/types/api'

export interface AiChatRequest {
  message: string
  conversationId?: string
  /** Đơn vị đang xét (khi bấm thẻ Insight): backend đặt làm "đơn vị hiện tại" của lượt. */
  focusUnitId?: string
}

/** Lựa chọn bấm được khi trợ lý hỏi lại để làm rõ (lấy từ dữ liệu thật của hệ thống). */
export interface ClarificationOption {
  /** Nhãn hiển thị, kèm cấp/đơn vị cha để phân biệt. */
  label: string
  /** Nội dung gửi lại như câu trả lời của người dùng khi bấm chọn. */
  value: string
}

export interface AiChatResponse {
  text: string
  /** Chỉ có ở lượt trợ lý hỏi lại; lượt trả lời bình thường sẽ vắng field này. */
  options?: ClarificationOption[]
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

export type InsightType = 'EXCEED' | 'BELOW' | 'SPIKE' | 'DROP' | 'DEADLINE_RISK' | 'SUMMARY'

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

// Các endpoint gọi LLM có thể chạy lâu hơn nhiều so với request thường,
// nên dùng timeout riêng 300s thay vì timeout global (100s).
const AI_TIMEOUT = 300000

export const aiApi = {
  chat: (request: AiChatRequest) =>
    axiosInstance
      .post<ApiResponse<AiChatResponse>>('/ai/chat-org-unit', request, { timeout: AI_TIMEOUT })
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
      .get<ApiResponse<InsightCard[]>>('/ai/insights', { timeout: AI_TIMEOUT })
      .then(res => res.data.data),

  getFollowups: (request: FollowupRequest) =>
    axiosInstance
      .post<ApiResponse<FollowupPools>>('/ai/followups', request, { timeout: AI_TIMEOUT })
      .then(res => res.data.data),
}
