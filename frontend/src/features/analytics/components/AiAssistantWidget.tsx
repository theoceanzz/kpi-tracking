import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, Send, X, Loader2, Minimize2, Maximize2, Expand, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { useMyAiQuota } from '@/features/organization/hooks/useAiQuota'
import { aiApi, type InsightCard, type FollowupPools, type ClarificationOption } from '../api/aiApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import InsightCards from './InsightCards'
import FollowupSuggestions from './FollowupSuggestions'
import { buildFollowupContext } from '../utils/followupContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  followups?: FollowupPools
  /** Lượt trợ lý hỏi lại: hiện nút chọn thay vì gợi ý câu hỏi tiếp theo. */
  options?: ClarificationOption[]
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
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
  const [isLoading, setIsLoading] = useState(false)
  const [insights, setInsights] = useState<InsightCard[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [showInsights, setShowInsights] = useState(true)
  const [selectedQuestion, setSelectedQuestion] = useState<string>('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const conversationIdRef = useRef<string | null>(null)
  const turnRef = useRef(0)
  const activeInsightRef = useRef<InsightCard | null>(null)
  const navigate = useNavigate()

  // Backend chỉ cấp quyền dùng AI cho vai trò rank <= 1 (trưởng/phó đơn vị) — xem
  // ManagerContextResolver.resolve(). Người khác gọi sẽ nhận chuỗi từ chối kèm HTTP 200,
  // vừa khó chịu vừa tốn một lượt rate limit, nên ẩn hẳn nút.
  const isManager = user?.memberships?.some(m => (m.roleRank ?? 99) <= 1) ?? false

  // Hạn mức token còn lại — chỉ tải khi mở panel, để đóng thì không tốn request nào.
  const { data: quota } = useMyAiQuota(isOpen && isManager)

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
      const response = await aiApi.chat({
        message: userText,
        conversationId: conversationIdRef.current,
        focusUnitId,
      })

      const assistantId = (Date.now() + 1).toString()
      const options = response.options ?? []
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: response.text ?? '',
          options: options.length ? options : undefined,
        },
      ])

      turnRef.current += 1

      // Lượt trợ lý hỏi lại đã có sẵn nút chọn -> không gợi ý câu hỏi tiếp theo (backend cũng
      // trả rỗng cho lượt này), nên bỏ luôn lệnh gọi để khỏi tốn thêm một lượt gọi mô hình.
      if (options.length) return

      // Generate follow-up suggestions for this exchange (non-blocking for UX).
      const ctxStr = buildFollowupContext(insight ?? null, userText, response.text)
      try {
        const pools = await aiApi.getFollowups({
          conversationId: conversationIdRef.current ?? undefined,
          turn: turnRef.current,
          context: ctxStr,
        })
        if (pools && (pools.technical?.length || pools.management?.length)) {
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, followups: pools } : m)))
        }
      } catch {
        /* followups are best-effort */
      }
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
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center transition-transform hover:scale-110 z-50 group"
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
      className={cn(
        'fixed right-3 bottom-3 sm:right-6 sm:bottom-6 w-[calc(100vw-1.5rem)] sm:w-[450px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 z-50',
        isMinimized ? 'h-[60px]' : 'h-[700px] max-h-[85vh]',
      )}
    >
      {/* Header */}
      <div
        className="h-[60px] bg-indigo-600 px-4 flex items-center justify-between shrink-0 cursor-pointer select-none"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Trợ lý AI</h3>
            <p className="text-indigo-200 text-[10px]">
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
              <div
                key={msg.id}
                className={cn('flex flex-col', msg.role === 'user' ? 'items-end' : 'items-start')}
              >
                <div
                  className={cn(
                    'max-w-[90%] rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm',
                  )}
                >
                  {msg.role === 'user' ? (
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert prose-indigo max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  )}
                </div>

                {/* Trợ lý hỏi lại: cho bấm chọn thẳng, khỏi gõ lại tên */}
                {msg.role === 'assistant' && msg.options?.length && msg.id === lastAssistantId && !isLoading && (
                  <div className="w-full mt-2 flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <button
                        key={opt.value + opt.label}
                        type="button"
                        onClick={() => sendMessage(opt.value)}
                        className="px-3 py-1.5 text-sm rounded-full border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:bg-indigo-950 dark:hover:bg-indigo-900 transition-colors"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Follow-up suggestions under the latest assistant answer */}
                {msg.role === 'assistant' && msg.followups && msg.id === lastAssistantId && !isLoading && (
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
                <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <div className="relative flex items-center gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 pr-12 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-shadow"
                rows={1}
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 bottom-2 p-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
              >
                <Send size={16} />
              </button>
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
