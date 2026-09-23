import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bot, Send, X, Loader2, Minimize2, Maximize2, Expand, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMyAiQuota } from '@/features/organization/hooks/useAiQuota'
import { aiApi, type InsightCard, type FollowupPools, type ClarificationOption, type FormPatch, type PendingAction, type AiChatResponse } from '../api/aiApi'
import { useFormAssistStore } from '@/store/formAssistStore'
import { useAiAssistantStore } from '@/store/aiAssistantStore'
import { useAiAvailable } from '../hooks/useAiAvailable'
import EvidenceAttachBar, { AttachedChips, PinnedChips } from './EvidenceAttachBar'
import { MicButton } from '@/components/common/MicButton'
import { usePinnedFilesStore, attachPinnedTo } from '@/store/pinnedFilesStore'
import { useChatFileDrop } from '../hooks/useChatFileDrop'
import EvidenceDropCard from './EvidenceDropCard'
import FormPatchPreview from './FormPatchPreview'
import PendingActionCard from './PendingActionCard'
import ThinkingSummary from './ThinkingSummary'
import AnswerMarkdown from './AnswerMarkdown'
import { useStageProgress } from '../hooks/useStageProgress'
import { useTypewriter } from '../hooks/useTypewriter'
import { useNavigate } from 'react-router-dom'
import InsightCards from './InsightCards'
import FollowupSuggestions from './FollowupSuggestions'
import { getApiErrorMessage } from '@/lib/apiError'
import { Button } from '@/components/ui/button'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  followups?: FollowupPools
  /** Lượt trợ lý hỏi lại: hiện nút chọn thay vì gợi ý câu hỏi tiếp theo. */
  options?: ClarificationOption[]
  /** Lượt trợ lý đề xuất điền form đang mở: hiện bản xem trước để người dùng chọn ô nào muốn nhận. */
  formPatch?: FormPatch
  /** Đang được gõ dần ra màn hình. Nội dung đầy đủ đã nằm sẵn ở `content`. */
  typing?: boolean
  /** Thời gian trợ lý xử lý lượt này. Vắng ở tin nhắn tải từ lịch sử hội thoại. */
  thinkingSeconds?: number
  /** Các bước đã chạy trong lượt, để bấm mở ra xem. */
  steps?: string[]
  /** Trợ lý mời gửi minh chứng: vẽ vùng thả ngay dưới câu trả lời này. */
  evidenceRequest?: boolean
  /**
   * Trợ lý đề nghị một thao tác GHI và chờ xác nhận.
   *
   * <p>KHÔNG lọc theo form đang mở như `formPatch`: mấy việc này (duyệt bài nộp, nhắc nhở) không
   * gắn với form nào, nên đóng form không làm lời mời mất nghĩa.
   */
  pendingAction?: PendingAction
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi có thể giúp gì cho bạn? (Ví dụ: "Có bao nhiêu thành viên trong phòng ban xyz?")',
}

export default function AiAssistantWidget() {
  // Cùng phép tính với các nút "K.AI" trên trang (useAiAvailable): thuộc một đơn vị và tổ chức
  // chưa tắt AI. Từ 18/09/2026 backend nhận cả nhân viên (nhóm tool cá nhân) — chỉ người CHƯA thuộc
  // đơn vị nào mới không có gì để hỏi, ẩn nút với họ để khỏi tốn một lượt rate limit cho câu từ chối.
  const aiAvailable = useAiAvailable()

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [input, setInput] = useState('')
  // Tệp KHÔNG còn nằm ở đây nữa: nó đi thẳng vào form qua fileSink ngay lúc kẹp. Giữ một bản sao
  // ở ô chat là dựng danh sách thứ hai của cùng một thứ, mà hai bản thì sẽ lệch.
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
  /**
   * Id các lời mời đã được chạy bằng cách NHẮN "xác nhận" thay vì bấm nút. Thẻ tương ứng phải tự
   * khoá lại — không có tập này thì người dùng vẫn thấy nút, bấm vào lại nhận "không còn hiệu lực".
   */
  const [consumedActionIds, setConsumedActionIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [showInsights, setShowInsights] = useState(true)
  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  // Nhãn "trợ lý đang làm gì". Hook lo phần chống nhấp nháy — các công đoạn đầu lượt xong trong
  // vài trăm mili-giây nên hiện thẳng thì chớp qua không đọc kịp.
  const { label: stageLabel, elapsedSec, begin: beginTurn, push: pushStage, end: endTurn } = useStageProgress()
  // Gõ dần câu trả lời ĐÃ HOÀN CHỈNH. Xem useTypewriter về việc vì sao không stream từ model.
  const { text: typedText, start: startTyping, finish: finishTyping, isTyping } = useTypewriter()
  const typingIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const turnRef = useRef(0)
  const activeInsightRef = useRef<InsightCard | null>(null)
  const navigate = useNavigate()

  // Chỗ nhận tệp của form đang mở, nếu form đó biết nhận. Nghe THEO store (chứ không getState)
  // để nút kẹp tự bật/tắt ngay khi người dùng mở hay đóng biểu mẫu.
  const fileSink = useFormAssistStore(s => s.active?.fileSink)
  // Nền tất định: thả tệp vào BẤT KỲ ĐÂU trong khung chat cũng ghim được, kể cả khi model quên
  // gọi tool mở vùng thả. Xem useChatFileDrop.
  const { getRootProps: dropProps, isDragActive } = useChatFileDrop(isMinimized)

  // Hạn mức token còn lại — chỉ tải khi mở panel, để đóng thì không tốn request nào.
  const { data: quota } = useMyAiQuota(isOpen && aiAvailable)

  // Ô nhập tự giãn theo nội dung, tối đa bằng maxHeight của nó.
  //
  // Bắt buộc phải có kể từ khi thanh cuộn của ô này bị ẩn: ô cao cố định một dòng mà không
  // giãn thì câu hỏi dài bị cắt và KHÔNG còn dấu hiệu nào cho biết còn chữ phía dưới.
  // Đặt ở effect theo `input` thay vì trong onChange để bắt được cả những lần điền sẵn từ
  // gợi ý và lần dọn trắng sau khi gửi.
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [input])

  // Gõ xong thì bỏ cờ, để phần gợi ý câu hỏi tiếp theo hiện ra sau chứ không chen ngang lúc đang gõ.
  useEffect(() => {
    if (!isTyping && typingIdRef.current) {
      const id = typingIdRef.current
      typingIdRef.current = null
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, typing: false } : m)))
    }
  }, [isTyping])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
    }
  }, [messages, isOpen, isMinimized, insights, showInsights])

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true)
    try {
      const data = await aiApi.getInsights()
      setInsights(data ?? [])
    } catch {
      setInsights([])
    } finally {
      setInsightsLoading(false)
    }
  }, [])

  // Proactively load insights when the widget is first opened.
  useEffect(() => {
    if (isOpen && insights.length === 0 && !insightsLoading) {
      loadInsights()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  const handleNewChat = () => {
    conversationIdRef.current = null
    turnRef.current = 0
    activeInsightRef.current = null
    setMessages([WELCOME_MSG])
    setInput('')
    setShowInsights(true)
    loadInsights()
  }

  const sendMessage = async (text: string, insight?: InsightCard | null, opts?: { focusUnitId?: string }) => {
    const userText = text.trim()
    if (!userText || isLoading) return


    setShowInsights(false)
    // Người dùng luôn hơn hiệu ứng: hỏi tiếp thì câu trước hiện trọn ngay.
    finishTyping()
    beginTurn()
    const userMsgId = Date.now().toString()
    setMessages(prev => [
      ...prev.filter(m => m.id !== 'welcome'),
      { id: userMsgId, role: 'user', content: userText },
    ])
    setIsLoading(true)


    try {
      if (!conversationIdRef.current) {
        const conv = await aiApi.createConversation(userText.slice(0, 60))
        conversationIdRef.current = conv.id
      }

      // Nút "K.AI" trên trang truyền thẳng đơn vị đang xem; thẻ Insight thì suy từ ngữ cảnh thẻ.
      const focusUnitId = opts?.focusUnitId
        ?? (insight?.context?.entityType === 'ORG_UNIT' ? insight.context.entityId : undefined)
      // Form đang mở (nếu có) đọc NGAY LÚC GỬI — người dùng có thể đã gõ thêm từ lúc mở panel.
      const activeForm = useFormAssistStore.getState().active

      // Hộp chứa thay vì biến let: TypeScript không theo dõi được phép gán bên trong callback,
      // nên với `let` nó thu hẹp kiểu thành never sau phép kiểm null.
      const box: { value: AiChatResponse | null } = { value: null }
      await aiApi.chatStream(
        {
          message: userText,
          conversationId: conversationIdRef.current,
          focusUnitId,
          openFormId: activeForm?.formId,
          openFormValues: activeForm?.getValues(),
          openFormFields: activeForm?.fillableFields(),
          openFormAcceptsFiles: activeForm?.fileSink ? true : undefined,
          // Tệp đang GHIM — ứng viên để trợ lý đính. Đọc lúc gửi, cùng nếp với openFormValues.
          pinnedFileNames: usePinnedFilesStore.getState().files.map(f => f.name),
          // Đọc từ sink lúc gửi, cùng nếp với openFormValues: trợ lý luôn thấy đúng danh sách tệp
          // ĐANG có trên form, kể cả tệp người dùng tự thả thẳng vào form chứ không qua ô chat.
          attachmentNames: activeForm?.fileSink?.current().map(f => f.name),
        },
        {
          onStage: pushStage,
          onDone: r => { box.value = r },
          // Ném NGUYÊN lỗi: nó đã mang mã HTTP và câu của backend (xem aiApi.streamError).
          onError: err => { throw err },
        },
      )
      const { seconds, steps } = endTurn()
      const response = box.value
      if (!response) throw new Error('Luồng kết thúc mà không có câu trả lời')

      // Trợ lý vừa bảo đính: chuyển tệp ghim sang biểu mẫu. Đi qua đúng hàm mà nút bấm dùng, nên
      // hai đường không thể lệch nhau về phép kiểm hay về việc dọn ghim.
      if (response.attachFiles) attachPinnedTo(useFormAssistStore.getState().active?.fileSink)

      const options = response.options ?? []
      const assistantId = (Date.now() + 1).toString()
      const answer = response.text ?? ''
      // Nội dung đầy đủ vào thẳng message; phần gõ dần chỉ là cách HIỆN nó, nên nếu hiệu ứng có
      // hỏng thì người dùng vẫn đọc được đủ.
      //
      // Câu trả lời RỖNG thì không bật cờ gõ: `isTyping` khi đó không đổi giá trị nên effect dọn cờ
      // không chạy, và bong bóng sẽ kẹt ở trạng thái trống.
      if (answer) {
        typingIdRef.current = assistantId
        startTyping(answer)
      }
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          typing: !!answer,
          thinkingSeconds: seconds,
          steps,
          content: answer,
          options: options.length ? options : undefined,
          // Chỉ giữ đề xuất nếu người dùng VẪN đang mở đúng form đó. Họ có thể đã đóng form trong
          // lúc chờ trả lời, và điền vào một form đã đóng thì vô nghĩa.
          formPatch:
            response.formPatch && response.formPatch.formId === activeForm?.formId
              ? response.formPatch
              : undefined,
          // Câu hỏi gợi ý nay về CÙNG câu trả lời — trước đây phải gọi thêm POST /ai/followups.
          // Backend đã tự bỏ qua ở lượt hỏi lại và lượt không có dữ liệu tool.
          followups: response.followups,
          evidenceRequest: response.evidenceRequest,
          pendingAction: response.pendingAction,

        },
      ])

      // Lượt này người dùng xác nhận bằng tin nhắn -> tắt thẻ xác nhận cũ ở phía trên.
      if (response.consumedActionId) {
        const doneId = response.consumedActionId
        setConsumedActionIds(prev => new Set(prev).add(doneId))
      }

      turnRef.current += 1
    } catch (error: any) {
      const status = error?.response?.status
      let errorContent: string
      if (status === 402) {
        errorContent = '⚠️ **Hệ thống AI đã đạt giới hạn token.** Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.'
      } else if (status === 429) {
        errorContent = `⚠️ ${getApiErrorMessage(error, 'Bạn gửi yêu cầu AI quá nhanh, vui lòng thử lại sau ít phút.')}`
      } else {
        const errorDetail = getApiErrorMessage(error, 'Lỗi không xác định')
        errorContent = `Xin lỗi, đã có lỗi xảy ra: ${errorDetail}`
      }
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: errorContent,
        },
      ])
    } finally {
      setIsLoading(false)
      // Lượt hỏng cũng phải đóng để dừng đồng hồ; kết quả bỏ đi vì không có gì để khoe.
      endTurn()
    }
  }

  const handleSend = () => {
    if (!input.trim() || isLoading) return
    const text = input
    const insight = activeInsightRef.current
    setInput('')
    setSelectedQuestion('')
    activeInsightRef.current = null
    sendMessage(text, insight)
  }

  const handleSelectQuestion = (insight: InsightCard, question: string) => {
    activeInsightRef.current = insight
    setSelectedQuestion(question)
    setInput(question)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleSelectFollowupQuestion = (question: string) => {
    setSelectedQuestion(question)
    setInput(question)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const handleShowInsights = () => {
    setShowInsights(true)
    loadInsights()
  }

  // Câu hỏi soạn sẵn từ nút "K.AI" trên trang: mở khung, bung panel và gửi luôn. Chờ lượt đang
  // chạy (nếu có) xong rồi mới gửi — sendMessage bỏ qua im lặng khi isLoading. Ghi nhớ id đã xử lý
  // vì effect có thể chạy lại (StrictMode) trước khi store kịp xoá.
  const pendingAsk = useAiAssistantStore(s => s.pending)
  const takeAsk = useAiAssistantStore(s => s.take)
  const lastAskIdRef = useRef<number | null>(null)
  const sendRef = useRef(sendMessage)
  sendRef.current = sendMessage
  useEffect(() => {
    if (!pendingAsk || isLoading || lastAskIdRef.current === pendingAsk.id) return
    lastAskIdRef.current = pendingAsk.id
    takeAsk(pendingAsk.id)
    setIsOpen(true)
    setIsMinimized(false)
    setInput('')
    setSelectedQuestion('')
    activeInsightRef.current = null
    void sendRef.current(pendingAsk.prompt, null, { focusUnitId: pendingAsk.focusUnitId })
  }, [pendingAsk, isLoading, takeAsk])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id

  // Điều kiện thoát phải nằm SAU toàn bộ hook: useOrganization là React Query nên org ban đầu
  // undefined rồi mới có dữ liệu — thoát sớm ở lượt render sau sẽ khiến số hook giảm và React
  // ném "Rendered fewer hooks than expected", làm sập cả cây component.
  if (!aiAvailable) return null

  // Portal ra body: AppLayout là khung `position: fixed` nên tự tạo stacking context, z-index ở
  // trong đó vẫn nằm DƯỚI Dialog/Drawer (portal ở body, z-[1000]) — mở modal là nút K.AI bị phủ,
  // bấm không ăn. Ra body thì z-index so trực tiếp với modal và K.AI đứng trên.
  // Thang z của app: 1000 Dialog/Drawer · 1100 Popover/Select/Tooltip · 1300 K.AI — K.AI phải
  // đứng trên MỌI lớp vì nó được gọi từ trong modal (nút "Gợi ý AI" của biểu mẫu tạo chỉ tiêu).
  // `data-ai-widget`: Dialog nhìn vào đó để bỏ qua phím Esc/Tab gõ trong K.AI (xem useDialogBehaviour).
  if (!isOpen) {
    return createPortal(
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Mở K.AI"
        data-ai-widget
        className="group fixed bottom-6 right-6 z-[1300] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-ai-line)] bg-[var(--color-card)] text-[var(--color-ai)] shadow-lg transition-colors hover:bg-[var(--color-ai-soft)]"
      >
        <Bot size={22} />
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-control bg-[var(--color-foreground)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-background)] opacity-0 transition-opacity group-hover:opacity-100">
          K.AI
        </span>
      </button>,
      document.body,
    )
  }

  return createPortal(
    <div
      {...dropProps()}
      data-ai-widget
      className={cn(
        // Bề ngang tăng theo cỡ màn: 450px trên laptop 13-14" là vừa, nhưng trên màn 27"
        // thì đúng khối đó đọc thành một cái tem dán góc, trong khi bảng số liệu AI trả về
        // lại là thứ cần bề ngang nhất.
        'fixed right-3 bottom-3 sm:right-6 sm:bottom-6 w-[calc(100vw-1.5rem)] sm:w-[420px] xl:w-[460px] 2xl:w-[520px] bg-[var(--color-card)] rounded-card shadow-lg border border-[var(--color-border)] flex flex-col overflow-hidden transition-[height,width] duration-200 motion-reduce:transition-none z-[1300]',
        // Chiều cao lấy theo chỗ CÒN LẠI trước, rồi mới chặn trần theo cỡ màn. Cách cũ
        // (`h-[700px] max-h-[85vh]`) tính 85% của cả khung nhìn nên trên màn 768px cao,
        // panel trùm lên tận header: 85vh = 653px + 24px lề dưới, chỉ chừa 91px.
        // `100dvh` chứ không phải `100vh` để trên trình duyệt di động không chui xuống dưới
        // thanh địa chỉ. 6.5rem = 24px lề dưới + 64px header + 16px thở.
        isMinimized ? 'h-14' : 'h-[calc(100dvh-6.5rem)] max-h-[640px] xl:max-h-[720px] 2xl:max-h-[840px]',
        isDragActive && 'ring-2 ring-[var(--color-ai)] ring-offset-2',
      )}
    >
      {/* Lớp phủ khi đang kéo tệp qua — nói rõ thả vào đâu cũng được. pointer-events-none để nó
          không nuốt mất sự kiện drop của chính vùng bên dưới. */}
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-ai-soft)]/90">
          <p className="text-sm font-medium text-[var(--color-ai)]">Thả tệp vào đây để ghim</p>
        </div>
      )}
      {/* Header */}
      <div
        className="flex h-14 shrink-0 cursor-pointer select-none items-center justify-between border-b border-[var(--color-border)] border-l-2 border-l-[var(--color-ai-line)] bg-[var(--color-card)] px-3"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        {/* `min-w-0` + `truncate`: hạn mức đầy đủ ("Còn 1.000.000/1.000.000 token tháng này")
            dài hơn cả nửa bề ngang panel, không cắt được thì nó đẩy bốn nút điều khiển tràn
            ra ngoài mép phải. */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-[var(--color-ai-soft)] text-[var(--color-ai)]" aria-hidden="true">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-section-title text-[var(--color-ai)]">K.AI</h3>
            <p className="truncate text-caption tabular-nums">
              {quota
                ? `Còn ${quota.remaining.toLocaleString('vi-VN')}/${quota.spendable.toLocaleString('vi-VN')} token tháng này`
                : conversationIdRef.current
                  ? 'Đang trong cuộc trò chuyện'
                  : 'Luôn sẵn sàng hỗ trợ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* New chat */}
          <Button variant="secondary" size="icon" onClick={e => {
              e.stopPropagation()
              handleNewChat()
            }} aria-label="Cuộc trò chuyện mới" title="Cuộc trò chuyện mới">
            <SquarePen aria-hidden="true" />
          </Button>

          {/* Expand to full screen */}
          <Button variant="secondary" size="icon" onClick={e => {
              e.stopPropagation()
              setIsOpen(false)
              navigate('/ai-assistant')
            }} aria-label="Mở toàn màn hình" title="Mở toàn màn hình">
            <Expand aria-hidden="true" />
          </Button>

          <Button variant="secondary" size="sm" onClick={e => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }} aria-label={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}>
            {isMinimized ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
          </Button>

          <Button variant="secondary" size="icon" onClick={e => {
              e.stopPropagation()
              setIsOpen(false)
            }} aria-label="Đóng">
            <X aria-hidden="true" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Area */}
          <div className="custom-scrollbar flex-1 space-y-4 overflow-y-auto bg-[var(--color-background)] p-4">
            {messages.map(msg => (
              <div key={msg.id} className="flex flex-col">
                {msg.role === 'user' ? (
                  /* Lượt người dùng: KHÔNG bong bóng đặc. Một rãnh dọc màu AI + nhãn nhỏ là đủ
                     phân định lượt, mà không ăn mất chiều ngang của câu trả lời bên dưới. */
                  <div className="border-l-2 border-[var(--color-ai-line)] pl-3 py-0.5">
                    <div className="text-eyebrow text-[var(--color-ai)]">
                      Bạn hỏi
                    </div>
                    <div className="mt-0.5 text-sm whitespace-pre-wrap text-[var(--color-foreground)]">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  /* Lượt trợ lý: trải hết chiều ngang, không nền không viền. Ở panel 450px, bỏ
                     bong bóng trả lại ~17% bề ngang cho bảng và số liệu. */
                  <div className="text-sm text-[var(--color-foreground)]">
                    {msg.thinkingSeconds != null && (
                      <ThinkingSummary seconds={msg.thinkingSeconds} steps={msg.steps} />
                    )}
                    {/* Đang gõ thì hiện phần đã gõ; nội dung đầy đủ vẫn nằm ở msg.content nên
                        hiệu ứng có hỏng cũng không mất chữ. */}
                    <AnswerMarkdown>{msg.typing ? typedText : msg.content}</AnswerMarkdown>
                  </div>
                )}

                {/* Trợ lý hỏi lại: cho bấm chọn thẳng, khỏi gõ lại tên */}
                {msg.role === 'assistant' && msg.options?.length && msg.id === lastAssistantId && !isLoading && !msg.typing && (
                  <div className="w-full mt-2 flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <button
                        key={opt.value + opt.label}
                        type="button"
                        onClick={() => sendMessage(opt.value)}
                        className="px-3 py-1.5 text-sm rounded-full border border-[var(--color-ai-line)] text-[var(--color-ai)] bg-[var(--color-ai-soft)] hover:brightness-95 dark:hover:brightness-125 transition-[filter]"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Đề xuất điền form đang mở — người dùng xem trước rồi mới chấp nhận */}
                {msg.role === 'assistant' && msg.formPatch && (
                  <FormPatchPreview patch={msg.formPatch} />
                )}

                {/* Thao tác GHI chờ xác nhận — bấm là ghi thật, nên thẻ tự cảnh báo và tự khoá */}

                {msg.role === 'assistant' && msg.pendingAction && (
                  <PendingActionCard
                    action={msg.pendingAction}
                    consumed={consumedActionIds.has(msg.pendingAction.id)}
                    onDone={text =>
                      setMessages(prev => [
                        ...prev,
                        { id: `act-${Date.now()}`, role: 'assistant', content: text },
                      ])
                    }
                  />
                )}

                {/* Vùng thả minh chứng, khi trợ lý vừa mời người dùng gửi tài liệu */}
                {msg.role === 'assistant' && msg.evidenceRequest && (
                  <EvidenceDropCard sink={fileSink} disabled={isLoading} />
                )}

                {/* Follow-up suggestions under the latest assistant answer */}
                {msg.role === 'assistant' && msg.followups && msg.id === lastAssistantId && !isLoading && !msg.typing && (
                  <div className="w-full mt-2">
                    <FollowupSuggestions
                      pools={msg.followups}
                      onSelectQuestion={handleSelectFollowupQuestion}
                      selectedQuestion={selectedQuestion}
                      onShowInsights={handleShowInsights}
                    />
                  </div>
                )}
              </div>
            ))}

            {/* Proactive insight cards */}
            {showInsights && (insightsLoading || insights.length > 0) && (
              <InsightCards insights={insights} onSelectQuestion={handleSelectQuestion} selectedQuestion={selectedQuestion} loading={insightsLoading} />
            )}

            {isLoading && (
              <div className="flex items-start">
                <div className="flex items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2">
                  <Loader2 size={16} className="animate-spin text-[var(--color-ai)]" aria-hidden="true" />
                  {/* Vòng gọi tool chiếm phần lớn 10-15 giây của một lượt; nói rõ đang làm gì
                      thì quãng chờ đỡ như treo máy. */}
                  {stageLabel && (
                    <span className="text-xs text-[var(--color-muted-foreground)]">{stageLabel}…</span>
                  )}
                  {elapsedSec > 0 && (
                    <span className="text-xs tabular-nums text-[var(--color-subtle-foreground)]">{elapsedSec}s</span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <PinnedChips sink={fileSink} />
            <AttachedChips sink={fileSink} />
            <div className="relative flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                className="ai-composer no-edit-hint scrollbar-hide w-full resize-none rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 py-2 pr-24 text-sm leading-6 text-[var(--color-foreground)] transition-[border-color,box-shadow] placeholder:text-[var(--color-muted-foreground)]"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              {/* pr-28 ở textarea chừa chỗ cho BA nút: micro, kẹp giấy, gửi. */}
              <div className="absolute right-2 bottom-1.5 flex items-center gap-0.5">
                <MicButton
                  onText={setInput}
                  getBaseText={() => input}
                  disabled={isLoading}
                  className="p-1.5"
                />
                <EvidenceAttachBar sink={fileSink} disabled={isLoading} />
                <Button variant="ghost" size="icon-sm" onClick={handleSend} disabled={!input.trim() || isLoading} aria-label="Gửi">
                  <Send aria-hidden="true" />
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-caption">
              AI có thể cung cấp thông tin không chính xác. Hãy kiểm tra lại.
            </p>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
