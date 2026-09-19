import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Loader2, MessageSquare, Sparkles, Database } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { aiApi, type ConversationResponse, type InsightCard, type FollowupPools, type ClarificationOption, type PendingAction, type AiChatResponse } from '../api/aiApi'
import InsightCards from '../components/InsightCards'
import AiDisabledPage from '../components/AiDisabledPage'
import FollowupSuggestions from '../components/FollowupSuggestions'
import EvidenceAttachBar, { AttachedChips, PinnedChips } from '../components/EvidenceAttachBar'
import { MicButton } from '@/components/common/MicButton'
import { usePinnedFilesStore, attachPinnedTo } from '@/store/pinnedFilesStore'
import { useChatFileDrop } from '../hooks/useChatFileDrop'
import EvidenceDropCard from '../components/EvidenceDropCard'
import PendingActionCard from '../components/PendingActionCard'
import { useFormAssistStore } from '@/store/formAssistStore'
import ThinkingSummary from '../components/ThinkingSummary'
import AnswerMarkdown from '../components/AnswerMarkdown'
import { useStageProgress } from '../hooks/useStageProgress'
import { useTypewriter } from '../hooks/useTypewriter'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import ConversationSidebar from '../components/ConversationSidebar'
import { useTourScope } from '@/hooks/useTourScope'
import { getApiErrorMessage } from '@/lib/apiError'

/** Tên gọi thân mật = từ cuối của họ tên ("Nguyễn Văn Minh" → "Minh"). */
function givenName(fullName?: string | null): string {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] || 'bạn'
}

/**
 * Toast tối có nút "Hoàn tác" cho các thao tác trên hội thoại. Không dùng toast xanh mặc định:
 * đây không phải "thành công" cần chúc mừng mà là một thay đổi có thể lấy lại trong vài giây.
 */
function undoToast(message: string, onUndo: () => void) {
  toast(message, {
    duration: 6000,
    action: { label: 'Hoàn tác', onClick: onUndo },
    style: { background: 'var(--color-ai-toast, #151a2d)', color: '#fff', border: 0, fontWeight: 500 },
    actionButtonStyle: { background: 'var(--color-ai-solid)', color: '#fff', fontWeight: 600, borderRadius: 8, padding: '0 12px', height: 32 },
  })
}

/** Gợi ý mở đầu cho màn hình trống — câu ngắn, bấm là gửi luôn. */
const STARTER_PROMPTS = [
  'Xem tổng quan hiệu suất công ty',
  'Ai đang có nguy cơ nghỉ việc?',
  'Duyệt các chỉ tiêu đang chờ',
  'Phòng ban nào cần can thiệp?',
]

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  followups?: FollowupPools
  /** Lượt trợ lý hỏi lại: hiện nút chọn thay vì gợi ý câu hỏi tiếp theo. */
  options?: ClarificationOption[]
  /** Đang được gõ dần ra màn hình. Nội dung đầy đủ đã nằm sẵn ở `content`. */
  typing?: boolean
  /** Thời gian trợ lý xử lý lượt này. Vắng ở tin nhắn tải từ lịch sử hội thoại. */
  thinkingSeconds?: number
  /** Các bước đã chạy trong lượt, để bấm mở ra xem. */
  steps?: string[]
  /** Trợ lý mời gửi minh chứng: vẽ vùng thả ngay dưới câu trả lời này. */
  evidenceRequest?: boolean
  /** Trợ lý đề nghị một thao tác GHI và chờ xác nhận. */
  pendingAction?: PendingAction
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi có thể giúp gì cho bạn?\n\nBạn có thể hỏi tôi về:\n- **Tổng quan KPI** của tổ chức\n- **Hiệu suất** các phòng ban\n- **Phân tích xu hướng** theo thời gian\n- **So sánh** giữa các đơn vị',
}

export default function AiAssistantPage() {
  useTourScope('ai-assistant')

  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  const [input, setInput] = useState('')
  // Tệp KHÔNG còn nằm ở đây: nó đi thẳng vào form qua fileSink ngay lúc kẹp. Xem formAssistStore.
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
  /**
   * Id các lời mời đã được chạy bằng cách NHẮN "xác nhận" thay vì bấm nút. Thẻ tương ứng phải tự
   * khoá lại — không có tập này thì người dùng vẫn thấy nút, bấm vào lại nhận "không còn hiệu lực".
   */
  const [consumedActionIds, setConsumedActionIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const [conversations, setConversations] = useState<ConversationResponse[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const turnRef = useRef(0)
  const activeInsightRef = useRef<InsightCard | null>(null)

  // Chỗ nhận tệp của form đang mở. Ở TRANG này thực tế luôn vắng — /ai-assistant là route toàn
  // màn hình nên không biểu mẫu nào mount cùng lúc — và nút kẹp sẽ tắt kèm câu giải thích.
  // Vẫn nối đầy đủ để hôm nào trang có form nhúng là chạy ngay, không phải sửa lại.
  const fileSink = useFormAssistStore(s => s.active?.fileSink)
  // Nền tất định: thả tệp vào BẤT KỲ ĐÂU trong cột chat cũng ghim được, kể cả khi model quên
  // gọi tool mở vùng thả. Xem useChatFileDrop.
  const { getRootProps: dropProps, isDragActive } = useChatFileDrop()


  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    autoResize(e.target)
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Gõ xong thì bỏ cờ, để phần gợi ý câu hỏi tiếp theo hiện ra sau chứ không chen ngang lúc đang gõ.
  useEffect(() => {
    if (!isTyping && typingIdRef.current) {
      const id = typingIdRef.current
      typingIdRef.current = null
      setMessages(prev => prev.map(m => (m.id === id ? { ...m, typing: false } : m)))
    }
  }, [isTyping])

  const loadConversations = useCallback(async () => {
    try {
      setLoadingConversations(true)
      const data = await aiApi.getConversations({ page: 0, size: 50 })
      setConversations(data.content)
    } catch {
      /* silent */
    } finally {
      setLoadingConversations(false)
    }
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

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

  useEffect(() => { loadInsights() }, [loadInsights])

  if (org && org.enableAi === false) return <AiDisabledPage />

  const handleNewChat = () => {
    setConversationId(null)
    turnRef.current = 0
    activeInsightRef.current = null
    setMessages([WELCOME_MSG])
    setInput('')
    setShowInsights(true)
    loadInsights()
    setMobileSidebarOpen(false)
    textareaRef.current?.focus()
  }

  const handleSelectConversation = async (conv: ConversationResponse) => {
    setMobileSidebarOpen(false)
    if (conv.id === conversationId) return
    setLoadingMessages(true)
    setConversationId(conv.id)
    setShowInsights(false)
    turnRef.current = 0
    activeInsightRef.current = null
    setMessages([])
    try {
      const data = await aiApi.getMessages(conv.id, { page: 0, size: 200 })
      const loaded: Message[] = data.content
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ id: m.id, role: m.role as 'user' | 'assistant', content: m.content }))
      setMessages(loaded.length > 0 ? loaded : [WELCOME_MSG])
    } catch {
      setMessages([WELCOME_MSG])
    } finally {
      setLoadingMessages(false)
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }

  /**
   * Xoá NGAY rồi cho hoàn tác trên toast, thay vì hỏi "bạn có chắc?": cuộc trò chuyện xoá nhầm
   * lấy lại được (xoá mềm + endpoint restore), nên hộp xác nhận chỉ là một cú bấm thừa.
   */
  const handleDelete = async (conv: ConversationResponse) => {
    const title = conv.title || 'Cuộc trò chuyện'
    const wasActive = conversationId === conv.id
    setConversations(prev => prev.filter(c => c.id !== conv.id))
    if (wasActive) handleNewChat()
    try {
      await aiApi.deleteConversation(conv.id)
    } catch (err) {
      setConversations(prev => [conv, ...prev])
      toast.error(getApiErrorMessage(err, 'Không xoá được cuộc trò chuyện'))
      return
    }
    undoToast(`Đã xóa cuộc trò chuyện "${title}".`, async () => {
      try {
        const restored = await aiApi.restoreConversation(conv.id)
        setConversations(prev => [restored, ...prev.filter(c => c.id !== restored.id)])
        if (wasActive) handleSelectConversation(restored)
      } catch (err) {
        toast.error(getApiErrorMessage(err, 'Không khôi phục được cuộc trò chuyện'))
      }
    })
  }

  const handleRename = async (conv: ConversationResponse, title: string) => {
    const previous = conv.title || ''
    const apply = (next: ConversationResponse) =>
      setConversations(prev => prev.map(c => (c.id === next.id ? next : c)))
    apply({ ...conv, title })
    try {
      apply(await aiApi.updateConversation(conv.id, { title }))
    } catch (err) {
      apply(conv)
      toast.error(getApiErrorMessage(err, 'Không đổi tên được'))
      return
    }
    undoToast(`Đã đổi tên thành "${title}".`, async () => {
      try { apply(await aiApi.updateConversation(conv.id, { title: previous || 'Cuộc trò chuyện' })) }
      catch (err) { toast.error(getApiErrorMessage(err, 'Không hoàn tác được')) }
    })
  }

  const handleTogglePin = async (conv: ConversationResponse) => {
    const pinned = !conv.pinnedAt
    try {
      const next = await aiApi.updateConversation(conv.id, { pinned })
      // Ghim lên đầu / bỏ ghim về đúng chỗ theo ngày — cùng thứ tự API trả, khỏi tải lại danh sách.
      setConversations(prev => {
        const rest = prev.filter(c => c.id !== next.id)
        if (pinned) return [next, ...rest]
        const idx = rest.findIndex(c => !c.pinnedAt && new Date(c.createdAt) < new Date(next.createdAt))
        return idx === -1 ? [...rest, next] : [...rest.slice(0, idx), next, ...rest.slice(idx)]
      })
      toast.success(pinned ? 'Đã ghim cuộc trò chuyện.' : 'Đã bỏ ghim.')
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Không ghim được'))
    }
  }

  const sendMessage = async (text: string, insight?: InsightCard | null) => {
    const userMsg = text.trim()
    if (!userMsg || isLoading) return


    setShowInsights(false)
    // Người dùng luôn hơn hiệu ứng: hỏi tiếp thì câu trước hiện trọn ngay.
    finishTyping()
    beginTurn()
    setMessages(prev => [
      ...prev.filter(m => m.id !== 'welcome'),
      { id: Date.now().toString(), role: 'user', content: userMsg },
    ])
    setIsLoading(true)


    try {
      let activeId = conversationId
      if (!activeId) {
        const conv = await aiApi.createConversation(userMsg.slice(0, 60))
        activeId = conv.id
        setConversationId(activeId)
        setConversations(prev => [conv, ...prev])
      }

      const focusUnitId =
        insight?.context?.entityType === 'ORG_UNIT' ? insight.context.entityId : undefined
      // Hộp chứa thay vì biến let: TypeScript không theo dõi được phép gán bên trong callback,
      // nên với `let` nó thu hẹp kiểu thành never sau phép kiểm null.
      const box: { value: AiChatResponse | null } = { value: null }
      await aiApi.chatStream(
        {
          message: userMsg,
          conversationId: activeId,
          focusUnitId,
          // Đọc từ sink lúc gửi: trợ lý luôn thấy đúng danh sách tệp ĐANG có trên form.
          attachmentNames: useFormAssistStore.getState().active?.fileSink?.current().map(f => f.name),
          openFormAcceptsFiles: useFormAssistStore.getState().active?.fileSink ? true : undefined,
          pinnedFileNames: usePinnedFilesStore.getState().files.map(f => f.name),
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
        const detail = getApiErrorMessage(error, 'Lỗi không xác định')
        errorContent = `⚠️ ${detail}`
      }
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: errorContent },
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    activeInsightRef.current = null
    sendMessage(text, insight)
  }

  const handleSelectQuestion = (insight: InsightCard, question: string) => {
    activeInsightRef.current = insight
    setSelectedQuestion(question)
    setInput(question)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleSelectFollowupQuestion = (question: string) => {
    setSelectedQuestion(question)
    setInput(question)
    setTimeout(() => textareaRef.current?.focus(), 100)
  }

  const handleShowInsights = () => {
    setShowInsights(true)
    loadInsights()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const lastAssistantId = [...messages].reverse().find(m => m.role === 'assistant')?.id
  // Màn hình trống = chưa có lượt hỏi nào; lời chào mặc định không tính.
  const isFresh = !loadingMessages && !isLoading && messages.every(m => m.id === 'welcome')

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full flex bg-[var(--color-background)] overflow-hidden relative">

        {/* Mobile overlay */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        <ConversationSidebar
          conversations={conversations}
          loading={loadingConversations}
          activeId={conversationId}
          collapsed={collapsed}
          mobileOpen={mobileSidebarOpen}
          onToggleCollapsed={() => setCollapsed(v => !v)}
          onCloseMobile={() => setMobileSidebarOpen(false)}
          onNew={handleNewChat}
          onSelect={handleSelectConversation}
          onRename={handleRename}
          onTogglePin={handleTogglePin}
          onDelete={handleDelete}
        />

        {/* ═══ MAIN CHAT ═══ */}
        <div
          {...dropProps()}
          className={cn(
            'relative flex flex-col flex-1 min-w-0',
            isDragActive && 'ring-2 ring-inset ring-[var(--color-ai)]',
          )}
        >
          {/* Lớp phủ khi đang kéo tệp qua. pointer-events-none để nó không nuốt mất sự kiện drop. */}
          {isDragActive && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[var(--color-ai-soft)]/90">
              <p className="text-sm font-medium text-[var(--color-ai)]">Thả tệp vào đây để ghim</p>
            </div>
          )}

          {/* Header */}
          <header className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="-ml-1 shrink-0 text-[var(--color-muted-foreground)] md:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                aria-label="Mở danh sách hội thoại"
              >
                <MessageSquare aria-hidden="true" />
              </Button>
              <div className="relative shrink-0">
                <div className="flex h-12 w-12 items-center justify-center rounded-card bg-[var(--color-ai-solid)] text-white">
                  <Sparkles size={22} aria-hidden="true" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-background)] bg-[var(--color-success-solid)]" aria-hidden="true" />
              </div>
              <h1 className="text-page-title leading-tight text-[var(--color-foreground)]">Trợ lý K.AI</h1>
            </div>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="px-4 md:px-6 py-6">
              <div className="mx-auto max-w-4xl space-y-6">

                {loadingMessages ? (
                  <div className="space-y-5">
                    {[70, 45, 80, 55].map((w, i) => (
                      <div key={i} className={cn('flex items-end gap-3', i % 2 !== 0 && 'flex-row-reverse')}>
                        <div className="w-8 h-8 rounded-full animate-pulse bg-[var(--color-muted)] shrink-0" />
                        <div
                          className="animate-pulse h-14 rounded-card bg-[var(--color-muted)]"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                ) : isFresh ? (
                  <div className="flex min-h-[46vh] flex-col items-center justify-center px-2 text-center">
                    <h2 className="text-balance text-[28px] font-semibold leading-tight text-[var(--color-ai)] sm:text-[34px]">
                      Chào {givenName(user?.fullName)},<br />hôm nay bạn muốn làm gì?
                    </h2>
                    <p className="mt-4 max-w-md text-base text-[var(--color-muted-foreground)]">
                      Hỏi Trợ lý K.AI bất cứ điều gì về hiệu suất, mục tiêu hay nhân sự của tổ chức — hoặc bắt đầu từ gợi ý bên dưới.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                      {STARTER_PROMPTS.map(q => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => sendMessage(q)}
                          disabled={isLoading || loadingMessages}
                          className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-2.5 text-[15px] font-medium text-[var(--color-foreground)] shadow-sm transition-colors hover:border-[var(--color-ai-line)] hover:bg-[var(--color-ai-soft)] hover:text-[var(--color-ai)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ai-accent)] disabled:opacity-50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="flex flex-col">
                      {msg.role === 'user' ? (
                        /* Lượt người dùng: rãnh dọc + nhãn nhỏ thay cho bong bóng và avatar.
                           Avatar cũ ăn 44px mỗi bên và chính nó tạo cảm giác "chatbot mặc định". */
                        <div className="border-l-2 border-[var(--color-ai-line)] pl-3 py-0.5">
                          <div className="text-eyebrow text-[var(--color-ai)]">
                            Bạn hỏi
                          </div>
                          <div className="mt-0.5 text-sm whitespace-pre-wrap text-[var(--color-foreground)]">
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        /* Lượt trợ lý: trải hết chiều ngang, không nền không viền — bảng và số
                           liệu có đủ chỗ thở thay vì bị nhét trong bong bóng. */
                        <div className="text-sm text-[var(--color-foreground)]">
                          {msg.thinkingSeconds != null && (
                            <ThinkingSummary seconds={msg.thinkingSeconds} steps={msg.steps} />
                          )}
                          {/* Đang gõ thì hiện phần đã gõ; nội dung đầy đủ vẫn nằm ở msg.content
                              nên hiệu ứng có hỏng cũng không mất chữ. */}
                          <AnswerMarkdown>{msg.typing ? typedText : msg.content}</AnswerMarkdown>
                        </div>
                      )}

                        {/* Trợ lý hỏi lại: cho bấm chọn thẳng, khỏi gõ lại tên */}
                        {msg.role === 'assistant' && msg.options?.length && msg.id === lastAssistantId && !isLoading && !msg.typing && (
                          <div className="mt-2 flex flex-wrap gap-2">
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

                        {/* Vùng thả minh chứng, khi trợ lý vừa mời người dùng gửi tài liệu */}
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

                        {msg.role === 'assistant' && msg.evidenceRequest && (
                          <EvidenceDropCard sink={fileSink} disabled={isLoading} />
                        )}

                        {/* Follow-up suggestions under the latest assistant answer */}
                        {msg.role === 'assistant' && msg.followups && msg.id === lastAssistantId && !isLoading && !msg.typing && (
                          <FollowupSuggestions
                            pools={msg.followups}
                            onSelectQuestion={handleSelectFollowupQuestion}
                            selectedQuestion={selectedQuestion}
                            onShowInsights={handleShowInsights}
                          />
                        )}
                    </div>
                  ))
                )}

                {/* Proactive insight cards */}
                {!loadingMessages && showInsights && (insightsLoading || insights.length > 0) && (
                  <div>
                    <InsightCards insights={insights} onSelectQuestion={handleSelectQuestion} selectedQuestion={selectedQuestion} loading={insightsLoading} />
                  </div>
                )}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex items-end gap-3">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center shadow-sm">
                      <Sparkles size={14} className="text-[var(--color-primary-foreground)]" />
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-card rounded-bl-sm px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="h-2 w-2 rounded-full bg-[var(--color-ai-line)] animate-bounce motion-reduce:animate-none"
                              style={{ animationDelay: `${i * 150}ms` }}
                            />
                          ))}
                        </div>
                        {/* Vòng gọi tool chiếm phần lớn 10-15 giây của một lượt; nói rõ đang làm gì
                            thì quãng chờ đỡ như treo máy. */}
                        {stageLabel && (
                          <span className="text-xs text-[var(--color-muted-foreground)]">{stageLabel}…</span>
                        )}
                        {elapsedSec > 0 && (
                          <span className="text-xs tabular-nums text-[var(--color-muted-foreground)] opacity-70">{elapsedSec}s</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
          </ScrollArea>

          {/* Input area */}
          <div className="shrink-0 px-4 md:px-6 py-3 border-t border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="mx-auto max-w-4xl">
              <PinnedChips sink={fileSink} />
              <AttachedChips sink={fileSink} />
              <div className="flex items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] py-2 pl-3 pr-2 shadow-sm transition-colors focus-within:border-[var(--color-ai-accent)] focus-within:ring-2 focus-within:ring-[var(--color-ai-accent)]">
                <EvidenceAttachBar sink={fileSink} disabled={isLoading || loadingMessages} />
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={conversationId ? 'Tiếp tục cuộc trò chuyện…' : 'Hỏi về KPI, mục tiêu, hiệu suất phòng ban…'}
                  disabled={loadingMessages}
                  rows={1}
                  className="no-edit-hint scrollbar-hide min-h-9 flex-1 resize-none bg-transparent py-1.5 text-base leading-6 placeholder:text-[var(--color-muted-foreground)] focus:outline-none disabled:opacity-50"
                  style={{ maxHeight: '160px', overflowY: 'auto' }}
                />
                <MicButton
                  onText={text => {
                    setInput(text)
                    // Giãn ô y như lúc gõ tay, nếu không câu dài đọc xong bị khuất.
                    if (textareaRef.current) autoResize(textareaRef.current)
                  }}
                  getBaseText={() => input}
                  disabled={isLoading || loadingMessages}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || loadingMessages}
                  size="icon"
                  aria-label="Gửi"
                  className="h-10 w-10 shrink-0 rounded-card bg-[var(--color-ai-solid)] text-white hover:bg-[var(--color-ai)] hover:opacity-90"
                >
                  {isLoading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                </Button>
              </div>

              <div className="flex items-center justify-between mt-1.5 px-1">
                <div className="flex items-center gap-1.5 text-caption">
                  <Database size={12} aria-hidden="true" />
                  Dữ liệu từ hệ thống KPI của tổ chức
                </div>
                <p className="text-caption">
                  Shift + Enter để xuống dòng
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
