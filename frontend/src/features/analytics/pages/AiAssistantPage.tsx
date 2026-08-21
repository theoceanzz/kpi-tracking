import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Bot, Send, Loader2, SquarePen, Trash2,
  MessageSquare, PanelLeftClose, PanelLeftOpen, Sparkles,
  Clock, Database,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import { aiApi, type ConversationResponse, type InsightCard, type FollowupPools, type ClarificationOption, type AiChatResponse } from '../api/aiApi'
import InsightCards from '../components/InsightCards'
import AiDisabledPage from '../components/AiDisabledPage'
import FollowupSuggestions from '../components/FollowupSuggestions'
import ThinkingSummary from '../components/ThinkingSummary'
import AnswerMarkdown from '../components/AnswerMarkdown'
import { useStageProgress } from '../hooks/useStageProgress'
import { useTypewriter } from '../hooks/useTypewriter'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

function truncateWords(text: string, max = 15): string {
  const words = text.trim().split(/\s+/)
  return words.length <= max ? text : words.slice(0, max).join(' ') + '...'
}

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
}

const WELCOME_MSG: Message = {
  id: 'welcome',
  role: 'assistant',
  content: 'Xin chào! Tôi có thể giúp gì cho bạn?\n\nBạn có thể hỏi tôi về:\n- **Tổng quan KPI** của tổ chức\n- **Hiệu suất** các phòng ban\n- **Phân tích xu hướng** theo thời gian\n- **So sánh** giữa các đơn vị',
}

export default function AiAssistantPage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: org } = useOrganization(orgId)

  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG])
  const [isLoading, setIsLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)

  const [conversations, setConversations] = useState<ConversationResponse[]>([])
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setDeletingId(id)
    try {
      await aiApi.deleteConversation(id)
      setConversations(prev => prev.filter(c => c.id !== id))
      if (conversationId === id) handleNewChat()
    } catch {
      /* silent */
    } finally {
      setDeletingId(null)
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
        { message: userMsg, conversationId: activeId, focusUnitId },
        {
          onStage: pushStage,
          onDone: r => { box.value = r },
          onError: message => { throw new Error(message) },
        },
      )
      const { seconds, steps } = endTurn()
      const response = box.value
      if (!response) throw new Error('Luồng kết thúc mà không có câu trả lời')

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
        const detail = error?.response?.data?.message || error?.message || 'Lỗi không xác định'
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

        {/* ═══ SIDEBAR ═══ */}
        <aside className={cn(
          'flex flex-col border-r border-[var(--color-border)] transition-all duration-300',
          'bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-slate-950',
          'fixed inset-y-0 left-0 z-40 w-[272px] md:static md:z-auto md:shrink-0',
          collapsed ? 'md:w-[60px]' : 'md:w-[272px]',
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0',
        )}>
          {/* Sidebar top bar */}
          <div className={cn(
            'flex items-center gap-2 p-3 shrink-0',
            collapsed ? 'md:justify-center' : 'justify-between',
          )}>
            {!collapsed && (
              <Button
                onClick={handleNewChat}
                size="sm"
                className="flex-1 justify-start gap-2 text-xs h-9"
              >
                <SquarePen size={14} />
                Cuộc trò chuyện mới
              </Button>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden md:flex h-9 w-9 shrink-0 text-[var(--color-muted-foreground)]"
                  onClick={() => setCollapsed(v => !v)}
                >
                  {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{collapsed ? 'Mở rộng' : 'Thu gọn'}</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9 shrink-0 text-[var(--color-muted-foreground)]"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <PanelLeftClose size={16} />
            </Button>
          </div>

          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mx-auto h-9 w-9 text-violet-600"
                  onClick={handleNewChat}
                >
                  <SquarePen size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Cuộc trò chuyện mới</TooltipContent>
            </Tooltip>
          )}

          <Separator />

          {/* Conversation list */}
          {!collapsed && (
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {loadingConversations ? (
                  <div className="space-y-2 px-1 pt-1">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="animate-pulse h-14 rounded-xl bg-[var(--color-muted)]" />
                    ))}
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                      <MessageSquare size={22} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[var(--color-foreground)]">Chưa có cuộc trò chuyện</p>
                      <p className="text-xs text-[var(--color-muted-foreground)] mt-1">Bắt đầu hỏi AI để tạo mới</p>
                    </div>
                  </div>
                ) : (
                  conversations.map(conv => {
                    const isActive = conversationId === conv.id
                    return (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConversation(conv)}
                        className={cn(
                          'w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group relative',
                          isActive
                            ? 'bg-violet-600 text-white shadow-sm shadow-violet-200 dark:shadow-none'
                            : 'hover:bg-[var(--color-muted)] text-[var(--color-foreground)]',
                        )}
                      >
                        <div className="flex items-start gap-2.5 pr-6">
                          <div className={cn(
                            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                            isActive ? 'bg-white/20' : 'bg-violet-50 dark:bg-violet-900/30',
                          )}>
                            <MessageSquare size={13} className={isActive ? 'text-white' : 'text-violet-500'} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn(
                              'text-sm font-medium leading-tight',
                              isActive ? 'text-white' : 'text-[var(--color-foreground)]',
                            )}>
                              {truncateWords(conv.title || 'Cuộc trò chuyện', 6)}
                            </p>
                            <p className={cn(
                              'text-[11px] mt-0.5 flex items-center gap-1',
                              isActive ? 'text-violet-200' : 'text-[var(--color-muted-foreground)]',
                            )}>
                              <Clock size={10} />
                              {formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true, locale: vi })}
                            </p>
                          </div>
                        </div>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              role="button"
                              onClick={e => handleDelete(conv.id, e)}
                              className={cn(
                                'absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100',
                                isActive
                                  ? 'hover:bg-white/20 text-violet-200 hover:text-white'
                                  : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-[var(--color-muted-foreground)] hover:text-red-500',
                              )}
                            >
                              {deletingId === conv.id
                                ? <Loader2 size={13} className="animate-spin" />
                                : <Trash2 size={13} />
                              }
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="right">Xóa cuộc trò chuyện</TooltipContent>
                        </Tooltip>
                      </button>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          )}

          {/* Sidebar collapsed icons */}
          {collapsed && (
            <ScrollArea className="flex-1">
              <div className="flex flex-col items-center gap-1 p-2">
                {conversations.slice(0, 20).map(conv => (
                  <Tooltip key={conv.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleSelectConversation(conv)}
                        className={cn(
                          'w-9 h-9 rounded-xl flex items-center justify-center transition-colors',
                          conversationId === conv.id
                            ? 'bg-violet-600 text-white'
                            : 'hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]',
                        )}
                      >
                        <MessageSquare size={15} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-[200px] truncate">
                      {truncateWords(conv.title || 'Cuộc trò chuyện')}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </ScrollArea>
          )}
        </aside>

        {/* ═══ MAIN CHAT ═══ */}
        <div className="flex flex-col flex-1 min-w-0">

          {/* Header */}
          <header className="shrink-0 px-4 md:px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-background)]">
            <div className="flex items-center justify-between max-w-3xl mx-auto">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9 shrink-0 text-[var(--color-muted-foreground)] -ml-1"
                  onClick={() => setMobileSidebarOpen(true)}
                >
                  <MessageSquare size={18} />
                </Button>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-violet-200 dark:shadow-none">
                    <Bot size={20} className="text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-white dark:border-slate-900" />
                </div>
                <div>
                  <h1 className="text-base font-bold leading-tight text-[var(--color-foreground)]">Trợ lý AI Analytics</h1>
                  <p className="text-xs text-[var(--color-muted-foreground)]">Khai thác dữ liệu KPI bằng ngôn ngữ tự nhiên</p>
                </div>
              </div>
              {conversationId && (
                <Badge variant="secondary" className="hidden sm:flex gap-1.5 shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Đang trong cuộc trò chuyện
                </Badge>
              )}
            </div>
          </header>

          {/* Messages */}
          <ScrollArea className="flex-1">
            <div className="px-4 md:px-6 py-6">
              <div className="max-w-3xl mx-auto space-y-6">

                {loadingMessages ? (
                  <div className="space-y-5">
                    {[70, 45, 80, 55].map((w, i) => (
                      <div key={i} className={cn('flex items-end gap-3', i % 2 !== 0 && 'flex-row-reverse')}>
                        <div className="w-8 h-8 rounded-full animate-pulse bg-[var(--color-muted)] shrink-0" />
                        <div
                          className="animate-pulse h-14 rounded-2xl bg-[var(--color-muted)]"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className="flex flex-col">
                      {msg.role === 'user' ? (
                        /* Lượt người dùng: rãnh dọc + nhãn nhỏ thay cho bong bóng và avatar.
                           Avatar cũ ăn 44px mỗi bên và chính nó tạo cảm giác "chatbot mặc định". */
                        <div className="border-l-2 border-[var(--color-ai-line)] pl-3 py-0.5">
                          <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-ai)]">
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
                  <div className="max-w-[82%]">
                    <InsightCards insights={insights} onSelectQuestion={handleSelectQuestion} selectedQuestion={selectedQuestion} loading={insightsLoading} />
                  </div>
                )}

                {/* Typing indicator */}
                {isLoading && (
                  <div className="flex items-end gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl rounded-bl-sm px-5 py-4 shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center gap-1.5">
                          {[0, 1, 2].map(i => (
                            <span
                              key={i}
                              className="w-2 h-2 bg-violet-400 rounded-full animate-bounce"
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
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl shadow-sm hover:shadow-md transition-shadow focus-within:ring-2 focus-within:ring-violet-500/40 focus-within:border-violet-300 px-4 py-2.5">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder={conversationId ? 'Tiếp tục cuộc trò chuyện...' : 'Hỏi về KPI, hiệu suất, xu hướng...'}
                  disabled={loadingMessages}
                  rows={1}
                  className="flex-1 bg-transparent text-sm leading-6 focus:outline-none resize-none placeholder:text-[var(--color-muted-foreground)] disabled:opacity-50"
                  style={{ maxHeight: '160px', overflowY: 'auto' }}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || loadingMessages}
                  size="icon"
                  className="h-8 w-8 rounded-xl shadow-sm shrink-0"
                >
                  {isLoading
                    ? <Loader2 size={15} className="animate-spin" />
                    : <Send size={15} />
                  }
                </Button>
              </div>

              <div className="flex items-center justify-between mt-1.5 px-1">
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-muted-foreground)]">
                  <Database size={10} />
                  Dữ liệu từ hệ thống KPI của tổ chức
                </div>
                <p className="text-[11px] text-[var(--color-muted-foreground)]">
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
