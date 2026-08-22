import axiosInstance from '@/lib/axios'
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

// Các endpoint gọi LLM có thể chạy lâu hơn nhiều so với request thường,
// nên dùng timeout riêng 300s thay vì timeout global (100s).
const AI_TIMEOUT = 300000

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

/** Đọc cookie theo tên. Chỉ dùng cho XSRF-TOKEN, vốn cố ý KHÔNG phải HttpOnly. */
function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find(c => c.startsWith(name + '='))
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null
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
    const xsrf = readCookie('XSRF-TOKEN')
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
