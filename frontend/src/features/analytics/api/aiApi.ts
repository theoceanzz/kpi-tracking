import axiosInstance, { XSRF_COOKIE_NAME } from '@/lib/axios'
import { ENV } from '@/config/env'
import type { ApiResponse, PageResponse, PageParams } from '@/types/api'

export interface AiChatRequest {
  message: string
  conversationId?: string
  /** Đơn vị đang xét (khi bấm thẻ Insight): backend đặt làm "đơn vị hiện tại" của lượt. */
  focusUnitId?: string
  /** Form đang mở trên màn hình, để trợ lý gợi ý điền hộ. Chỉ là định danh — backend tự biết form đó có ô nào. */
  openFormId?: string
  /** Giá trị các ô đang có, để trợ lý không đề xuất lại thứ người dùng đã tự điền. */
  openFormValues?: Record<string, unknown>
  /**
   * Các ô ĐANG hiện và sửa được trên màn hình. Máy chủ lấy giao với bản khai báo của nó, nên
   * đây chỉ THU HẸP — client bị sửa không bịa thêm được ô nào. Vắng field = giữ hành vi cũ.
   */
  openFormFields?: string[]
  /** Form đang mở có mục nhận tệp không. Không có thì trợ lý đừng mời gửi tệp. */
  openFormAcceptsFiles?: boolean
  /** Tên tệp người dùng đang GHIM ở ô chat — ứng viên để trợ lý đính vào biểu mẫu. */
  pinnedFileNames?: string[]
  /**
   * Tên các tệp minh chứng vừa kẹp. CHỈ TÊN — nội dung tệp không rời trình duyệt, nó sang thẳng
   * biểu mẫu báo cáo rồi mới tải lên khi người dùng bấm gửi. Trợ lý chỉ cần biết là có tệp.
   */
  attachmentNames?: string[]
}

/** Một ô trong bản đề xuất điền form. */
export interface FormPatchEntry {
  /** Tên trường trong schema form, dùng để gọi setValue. */
  field: string
  label: string
  /** Giá trị sẽ điền — chuỗi, số, boolean, hoặc mảng ID. */
  value: unknown
  /** Bản hiển thị cho người đọc: với ô tham chiếu đây là TÊN chứ không phải UUID. */
  display: string
  reason: string
}

/** Đề xuất điền form. Là đề xuất chứ không phải lệnh — người dùng tự chọn ô nào muốn nhận. */
export interface FormPatch {
  formId: string
  entries: FormPatchEntry[]
}

/** Lựa chọn bấm được khi trợ lý hỏi lại để làm rõ (lấy từ dữ liệu thật của hệ thống). */
export interface ClarificationOption {
  /** Nhãn hiển thị, kèm cấp/đơn vị cha để phân biệt. */
  label: string
  /** Nội dung gửi lại như câu trả lời của người dùng khi bấm chọn. */
  value: string
}

export interface PendingActionItem {
  id: string
  /** Tên đọc được, vd "Nguyễn Văn Staff — Số task hoàn thành". */
  label: string
  /** Thông tin phụ để thẩm định, vd "kỳ Tháng 6/2026, đạt 12/10 task". */
  detail?: string
}

/**
 * Lời mời xác nhận một thao tác GHI do trợ lý chuẩn bị.
 *
 * <p>CHƯA có gì được thay đổi khi field này xuất hiện — nó mô tả việc SẼ làm nếu người dùng bấm
 * xác nhận. Cùng kỷ luật với {@link FormPatch}: trợ lý đề nghị, người dùng quyết.
 */
export interface PendingAction {
  id: string
  kind: 'SUBMISSION_REVIEW' | 'KPI_CRITERIA_REVIEW' | 'KPI_ADJUSTMENT_REVIEW' | 'SEND_REMINDER' | 'KPI_SUBMIT' | 'REWARD_GRANT_REVIEW' | 'CYCLE_FINALIZE' | 'CYCLE_REOPEN' | 'CYCLE_SEND' | 'KPI_DECOMPOSE'
  decision?: 'APPROVE' | 'REJECT'
  title: string
  note?: string
  items: PendingActionItem[]
}

export interface ConfirmActionResult {
  /** Câu để chèn vào khung chat như một lời của trợ lý. */
  text: string
  succeeded: number
  failed: number
  failures: string[]
}

export interface AiChatResponse {
  text: string
  /** Chỉ có ở lượt trợ lý hỏi lại; lượt trả lời bình thường sẽ vắng field này. */
  options?: ClarificationOption[]
  /** Chỉ có khi người dùng nhờ điền form đang mở; lượt bình thường sẽ vắng field này. */
  formPatch?: FormPatch
  /**
   * Câu hỏi gợi ý tiếp theo. Trước đây phải gọi thêm POST /ai/followups để lấy phần này — nay nó
   * về cùng câu trả lời, nên một lượt chat là MỘT request. Vắng ở lượt không sinh gợi ý.
   */
  followups?: FollowupPools
  /**
   * Trợ lý mời người dùng gửi tài liệu minh chứng: vẽ một vùng thả tệp ngay trong bong bóng trả
   * lời. Vắng field ở mọi lượt bình thường.
   */
  evidenceRequest?: boolean
  /**
   * Trợ lý vừa đính tệp đang ghim vào biểu mẫu: client thực hiện việc chuyển. Vắng ở mọi lượt
   * bình thường.
   */
  attachFiles?: boolean
  /**
   * Trợ lý đề nghị một thao tác GHI (duyệt bài nộp, duyệt chỉ tiêu, nhắc nhở...) và chờ xác nhận.
   * Vắng ở mọi lượt bình thường.
   */
  pendingAction?: PendingAction
  /**
   * Id của lời mời vừa được chạy XONG ở lượt này — người dùng xác nhận bằng cách nhắn "xác nhận"
   * thay vì bấm nút. Client dùng nó để tắt thẻ xác nhận cũ còn nằm trên màn hình.
   */
  consumedActionId?: string
}

export interface ConversationResponse {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
  /** Thời điểm ghim; null = không ghim. */
  pinnedAt?: string | null
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

// Các endpoint gọi LLM có thể chạy lâu hơn nhiều so với request thường,
// nên dùng timeout riêng 300s thay vì timeout global (100s).
export const AI_TIMEOUT = 300000

/** Việc trợ lý đang làm: một công đoạn của chuỗi xử lý, hoặc một lần tra cứu dữ liệu. */
export interface StageEvent {
  /** Mã ổn định để đối chiếu: tên lớp công đoạn, hoặc "tool:<tên tool>". */
  code: string
  /** Nhãn tiếng Việt để hiện cho người dùng, luôn ở dạng "Đang…". */
  label: string
}

export interface ChatStreamHandlers {
  onStage?: (stage: StageEvent) => void
  /** Một mẩu chữ. Là BẢN XEM TRƯỚC chưa qua lọc — phải thay bằng nội dung của onDone. */
  onToken?: (text: string) => void
  onDone?: (response: AiChatResponse) => void
  onError?: (message: string) => void
}

/** Đọc cookie theo tên. Chỉ dùng cho cookie CSRF, vốn cố ý KHÔNG phải HttpOnly. */
function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find(c => c.startsWith(name + '='))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
}

/** Một tài liệu đã nạp vào kho tri thức của trợ lý. */
export interface RagDocument {
  id: string
  /** null = bộ hướng dẫn KeyGo chung toàn hệ thống; có giá trị = tài liệu của tổ chức đó. */
  organizationId: string | null
  /** GUIDE do quản trị nền tảng nạp; ba loại còn lại là của tổ chức. */
  source: 'GUIDE' | 'REGULATION' | 'JOB_DESCRIPTION' | 'STRATEGY'
  title: string
  fileName?: string
  status: 'PENDING' | 'READY' | 'FAILED'
  chunkCount: number
  imageCount: number
  errorMessage?: string | null
  createdAt: string
}

export const RAG_SOURCE_LABELS: Record<RagDocument['source'], string> = {
  GUIDE: 'Hướng dẫn KeyGo · toàn hệ thống',
  REGULATION: 'Quy chế của tổ chức',
  JOB_DESCRIPTION: 'Mô tả công việc / chức năng nhiệm vụ',
  STRATEGY: 'Chiến lược, mục tiêu năm',
}

/** Một đoạn đang nằm trong kho vector — đúng như trợ lý sẽ nhận (đã có [mục] chèn đầu). */
export interface RagChunk {
  id: string
  order: number | null
  index: number | null
  title: string | null
  parent: string | null
  route: string | null
  roles: string | null
  text: string
  images: string[]
  captions: string[]
}

/**
 * Một kết quả "thử tìm". `score` là điểm gộp RRF của chế độ hybrid (thường ≤ 0,033): chỉ để xếp
 * hạng trong cùng một lần tìm, không phải độ giống cosine.
 */
export interface RagSearchHit {
  score: number | null
  docId: string | null
  docTitle: string | null
  title: string | null
  parent: string | null
  route: string | null
  text: string
  images: string[]
}

export const aiApi = {
  /**
   * Bản SSE của {@link chat}: báo tiến độ, phát chữ dần, rồi kết bằng câu trả lời CHÍNH THỨC.
   *
   * <p>Chữ ở `onToken` là BẢN XEM TRƯỚC chưa qua lọc — luôn phải thay bằng `onDone`.
   *
   * <p>Dùng `fetch` chứ không dùng axios vì cần đọc dần thân phản hồi. Đổi lại phải TỰ gắn
   * `X-XSRF-TOKEN` — axios làm việc đó tự động nhờ `withCredentials`, còn `fetch` thô thì không,
   * và thiếu nó Spring Security trả 403 mà không nói gì thêm.
   */
  chatStream: async (request: AiChatRequest, handlers: ChatStreamHandlers) => {
    const xsrf = readCookie(XSRF_COOKIE_NAME)
    const res = await fetch(`${ENV.API_BASE_URL}/ai/chat/stream`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(xsrf ? { 'X-XSRF-TOKEN': xsrf } : {}),
      },
      body: JSON.stringify(request),
    })
    if (!res.ok || !res.body) {
      // Dựng lỗi theo ĐÚNG hình dạng lỗi của axios ({ response: { status, data } }) để chỗ bắt lỗi
      // ở màn hình dùng chung được một nhánh cho cả hai đường — nhánh 429 đọc data.message.
      const data = await res.json().catch(() => undefined)
      throw Object.assign(new Error(data?.message ?? 'Chat stream failed'), {
        response: { status: res.status, data },
      })
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Khung SSE: các dòng "event:" / "data:" ngăn cách nhau bằng một dòng trống. Một khung có thể
    // bị cắt qua nhiều lần đọc, nên chỉ xử lý phần đã đủ và giữ lại phần dở trong buffer.
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let split: number
        while ((split = buffer.indexOf('\n\n')) >= 0) {
          const frame = buffer.slice(0, split)
          buffer = buffer.slice(split + 2)

          let event = 'message'
          const dataLines: string[] = []
          for (const line of frame.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart())
          }
          if (!dataLines.length) continue

          let payload: any
          try {
            payload = JSON.parse(dataLines.join('\n'))
          } catch {
            continue // khung hỏng thì bỏ, không làm chết cả luồng
          }

          if (event === 'stage') handlers.onStage?.(payload as StageEvent)
          else if (event === 'token') handlers.onToken?.(payload.text ?? '')
          else if (event === 'done') handlers.onDone?.(payload as AiChatResponse)
          else if (event === 'error') handlers.onError?.(payload.message ?? 'Lỗi không xác định')
        }
      }
    } finally {
      // Đóng kết nối kể cả khi thoát giữa chừng (onError ném ra ngoài). Bỏ qua thì socket còn treo
      // tới lúc bộ dọn rác đụng tới, và trình duyệt chỉ cho vài kết nối cùng lúc tới một máy chủ.
      reader.cancel().catch(() => {})
    }
  },

  /**
   * Xác nhận và chạy một thao tác trợ lý đã chuẩn bị.
   *
   * <p>`itemIds` chỉ để THU HẸP — backend loại mọi id không có trong lời mời gốc, nên không gửi
   * thêm được mục lạ. Bỏ trống = làm hết.
   */
  confirmAction: (actionId: string, itemIds?: string[]) =>
    axiosInstance
      .post<ApiResponse<ConfirmActionResult>>(`/ai/actions/${actionId}/confirm`, { itemIds })
      .then(res => res.data.data),

  /** Kho tri thức: tài liệu của tổ chức mình (bộ hướng dẫn chung quản lý ở platformAdminApi). */
  listRagDocuments: () =>
    axiosInstance
      .get<ApiResponse<RagDocument[]>>('/ai/rag/documents')
      .then(res => res.data.data),

  /**
   * Nạp một tệp .docx. Chạy đồng bộ ở backend (đọc mục, cất ảnh, embedding tại chỗ) nên tệp lớn
   * mất vài giây; timeout nới như lượt chat.
   */
  uploadRagDocument: (file: File, source: RagDocument['source'], title?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('source', source)
    if (title) form.append('title', title)
    return axiosInstance
      .post<ApiResponse<RagDocument>>('/ai/rag/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: AI_TIMEOUT,
      })
      .then(res => res.data.data)
  },

  deleteRagDocument: (id: string) =>
    axiosInstance.delete<ApiResponse<void>>(`/ai/rag/documents/${id}`).then(res => res.data),

  /** Các đoạn của một tài liệu, theo thứ tự mục. */
  listRagChunks: (id: string) =>
    axiosInstance
      .get<ApiResponse<RagChunk[]>>(`/ai/rag/documents/${id}/chunks`)
      .then(res => res.data.data),

  /** Chạy đúng bộ truy hồi của trợ lý với một câu hỏi — xem nó "thấy gì". */
  searchRag: (q: string) =>
    axiosInstance
      .get<ApiResponse<RagSearchHit[]>>('/ai/rag/search', { params: { q } })
      .then(res => res.data.data),

  chat: (request: AiChatRequest) =>
    axiosInstance
      .post<ApiResponse<AiChatResponse>>('/ai/chat', request, { timeout: AI_TIMEOUT })
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

  /** Đổi tên và/hoặc ghim — trường bỏ trống giữ nguyên. */
  updateConversation: (id: string, body: { title?: string; pinned?: boolean }) =>
    axiosInstance
      .patch<ApiResponse<ConversationResponse>>(`/ai/conversations/${id}`, body)
      .then(res => res.data.data),

  /** Hoàn tác xoá (dòng xoá mềm được mở lại). */
  restoreConversation: (id: string) =>
    axiosInstance
      .post<ApiResponse<ConversationResponse>>(`/ai/conversations/${id}/restore`)
      .then(res => res.data.data),

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
}
