import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, X, Loader2, Minimize2, Maximize2, Expand, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useMyAiQuota } from '@/features/organization/hooks/useAiQuota'
import { aiApi, type InsightCard, type FollowupPools, type ClarificationOption, type FormPatch, type PendingAction, type AiChatResponse } from '../api/aiApi'
import { useFormAssistStore } from '@/store/formAssistStore'
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
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [input, setInput] = useState('')
  // Tệp KHÔNG còn nằm ở đây nữa: nó đi thẳng vào form qua fileSink ngay lúc kẹp. Giữ một bản sao
  // ở ô chat là dựng danh sách thứ hai của cùng một thứ, mà hai bản thì sẽ lệch.
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
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


  // Backend chỉ cấp quyền dùng AI cho vai trò rank <= 1 (trưởng/phó đơn vị) — xem
  // ManagerContextResolver.resolve(). Người khác gọi sẽ nhận chuỗi từ chối kèm HTTP 200,
  // vừa khó chịu vừa tốn một lượt rate limit, nên ẩn hẳn nút.
  const isManager = user?.memberships?.some(m => (m.roleRank ?? 99) <= 1) ?? false

  // Hạn mức token còn lại — chỉ tải khi mở panel, để đóng thì không tốn request nào.
  const { data: quota } = useMyAiQuota(isOpen && isManager)

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

  const sendMessage = async (text: string, insight?: InsightCard | null) => {
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

      const focusUnitId =
        insight?.context?.entityType === 'ORG_UNIT' ? insight.context.entityId : undefined
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
          onError: message => { throw new Error(message) },
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

      turnRef.current += 1
    } catch (error: any) {
      const status = error?.response?.status
      let errorContent: string
      if (status === 402) {
        errorContent = '⚠️ **Hệ thống AI đã đạt giới hạn token.** Vui lòng thử lại sau ít phút hoặc liên hệ quản trị viên.'
      } else if (status === 429) {
        errorContent = `⚠️ ${error?.response?.data?.message || 'Bạn gửi yêu cầu AI quá nhanh, vui lòng thử lại sau ít phút.'}`
      } else {
        const errorDetail = error?.response?.data?.message || error?.message || 'Lỗi không xác định'
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
  if (!isManager || org?.enableAi === false) return null

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg shadow-violet-200 dark:shadow-none flex items-center justify-center transition-transform hover:scale-110 z-50 group"
      >
        <Bot size={24} />
        <span className="absolute right-full mr-4 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          Trợ lý AI
        </span>
      </button>
    )
  }

  return (
    <div
      {...dropProps()}
      className={cn(
        'fixed right-3 bottom-3 sm:right-6 sm:bottom-6 w-[calc(100vw-1.5rem)] sm:w-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 z-500',
        isMinimized ? 'h-[60px]' : 'h-[700px] max-h-[85vh]',
        isDragActive && 'ring-2 ring-[var(--color-ai)] ring-offset-2',
      )}
    >
      {/* Lớp phủ khi đang kéo tệp qua — nói rõ thả vào đâu cũng được. pointer-events-none để nó
          không nuốt mất sự kiện drop của chính vùng bên dưới. */}
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-ai-soft)]/90">
          <p className="text-sm font-bold text-[var(--color-ai)]">Thả tệp vào đây để ghim</p>
        </div>
      )}
      {/* Header */}
      <div
        className="h-[60px] bg-violet-600 px-4 flex items-center justify-between shrink-0 cursor-pointer select-none"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Trợ lý AI</h3>
            <p className="text-violet-200 text-[10px]">
              {quota
                ? `Còn ${quota.remaining.toLocaleString('vi-VN')}/${quota.spendable.toLocaleString('vi-VN')} token tháng này`
                : conversationIdRef.current
                  ? 'Đang trong cuộc trò chuyện'
                  : 'Luôn sẵn sàng hỗ trợ'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* New chat */}
          <button
            onClick={e => {
              e.stopPropagation()
              handleNewChat()
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Cuộc trò chuyện mới"
          >
            <SquarePen size={15} />
          </button>

          {/* Expand to full screen */}
          <button
            onClick={e => {
              e.stopPropagation()
              setIsOpen(false)
              navigate('/ai-assistant')
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Mở toàn màn hình"
          >
            <Expand size={15} />
          </button>

          <button
            onClick={e => {
              e.stopPropagation()
              setIsMinimized(!isMinimized)
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>

          <button
            onClick={e => {
              e.stopPropagation()
              setIsOpen(false)
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
            {messages.map(msg => (
              <div key={msg.id} className="flex flex-col">
                {msg.role === 'user' ? (
                  /* Lượt người dùng: KHÔNG bong bóng đặc. Một rãnh dọc màu AI + nhãn nhỏ là đủ
                     phân định lượt, mà không ăn mất chiều ngang của câu trả lời bên dưới. */
                  <div className="border-l-2 border-[var(--color-ai-line)] pl-3 py-0.5">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ai)]">
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
                <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-violet-500" />
                  {/* Vòng gọi tool chiếm phần lớn 10-15 giây của một lượt; nói rõ đang làm gì
                      thì quãng chờ đỡ như treo máy. */}
                  {stageLabel && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{stageLabel}…</span>
                  )}
                  {elapsedSec > 0 && (
                    <span className="text-xs tabular-nums text-slate-400 dark:text-slate-500">{elapsedSec}s</span>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <PinnedChips sink={fileSink} />
            <AttachedChips sink={fileSink} />
            <div className="relative flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-28 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none transition-shadow"
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
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-1.5 bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2">
              AI có thể cung cấp thông tin không chính xác. Hãy kiểm tra lại.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
