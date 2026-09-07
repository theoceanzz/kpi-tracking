import axiosInstance from '@/lib/axios'
import type { ApiResponse } from '@/types/api'

/** Các loại mã do tổ chức tự đặt mẫu. Khớp enum CodeType ở backend. */
export type CodeType = 'OBJECTIVE' | 'KEY_RESULT' | 'BSC_PERSPECTIVE'

export interface CodeRule {
  codeType: CodeType
  /** Nhãn tiếng Việt do backend trả — giao diện khỏi giữ bảng dịch thứ hai. */
  label: string
  pattern: string
  autoGenerate: boolean
  allowManualOverride: boolean
  /** Token dùng được cho loại mã này, chưa gồm ô số {###}. */
  supportedTokens: string[]
  /** Mã sẽ sinh ra nếu tạo mới ngay lúc này. Null khi mẫu đang không hợp lệ. */
  preview?: string | null
  previewError?: string | null
}

export interface CodePreviewResponse {
  codeType: CodeType
  pattern: string
  code: string
}

export interface UpdateCodeRuleRequest {
  codeType: CodeType
  pattern?: string
  autoGenerate?: boolean
  allowManualOverride?: boolean
}

export const codeRuleApi = {
  list: (orgId: string) =>
    axiosInstance
      .get<ApiResponse<CodeRule[]>>(`/organizations/${orgId}/code-rules`)
      .then(r => r.data.data),

  update: (orgId: string, rules: UpdateCodeRuleRequest[]) =>
    axiosInstance
      .put<ApiResponse<CodeRule[]>>(`/organizations/${orgId}/code-rules`, rules)
      .then(r => r.data.data),

  /** Xem trước mã kế tiếp cho một mẫu chưa lưu. Bỏ `pattern` để xem theo mẫu đang lưu. */
  preview: (orgId: string, type: CodeType, pattern?: string) =>
    axiosInstance
      .get<ApiResponse<CodePreviewResponse>>(`/organizations/${orgId}/code-rules/preview`, {
        params: { type, ...(pattern ? { pattern } : {}) },
      })
      .then(r => r.data.data.code),
}
