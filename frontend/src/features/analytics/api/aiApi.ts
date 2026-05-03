import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

export interface AiChatRequest {
  message: string;
}

export interface AiChatResponse {
  text: string;
  toolUsed?: string;
  toolResult?: any;
}

export const aiApi = {
  chat: (request: AiChatRequest) =>
    axiosInstance.post<ApiResponse<AiChatResponse>>('/ai/chat', request, { timeout: 120000 }).then(res => res.data.data),
}
