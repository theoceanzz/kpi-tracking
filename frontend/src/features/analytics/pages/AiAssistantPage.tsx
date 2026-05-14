import React, { useState, useRef, useEffect } from 'react'
import { Bot, Send, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiApi } from '../api/aiApi'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  toolResult?: any;
}

export default function AiAssistantPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì cho bạn? (Ví dụ: "Hãy tổng hợp KPI của các phòng ban")' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    
    const userMsg = input.trim()
    setInput('')
    
    const newUserMsg: Message = { id: Date.now().toString(), role: 'user', content: userMsg }
    setMessages(prev => [...prev, newUserMsg])
    setIsLoading(true)

    try {
      const response = await aiApi.chat({ message: userMsg })
      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.text,
        toolUsed: response.toolUsed,
        toolResult: response.toolResult
      }
      setMessages(prev => [...prev, aiMsg])
    } catch (error: any) {
      console.error('AI Chat Error:', error)
      const errorDetail = error?.response?.data?.message || error?.message || 'Lỗi không xác định'
      const errMsg: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `Xin lỗi, đã có lỗi xảy ra: ${errorDetail}` }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] max-h-[100vh] bg-[var(--color-background)]">
      {/* Header */}
      <div className="shrink-0 p-6 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Bot size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trợ lý AI Analytics</h1>
            <p className="text-[var(--color-muted-foreground)]">Khai thác dữ liệu KPI bằng ngôn ngữ tự nhiên</p>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
              <div className={cn(
                "max-w-full md:max-w-[85%] rounded-2xl px-5 py-4",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-tr-sm" 
                  : "bg-[var(--color-card)] text-[var(--color-card-foreground)] border border-[var(--color-border)] rounded-tl-sm shadow-sm"
              )}>
                {msg.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  <div className="prose prose-sm md:prose-base dark:prose-invert prose-indigo max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
              
              {msg.toolResult && (
                <div className="mt-2 w-full md:w-[85%] bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-3 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-muted-foreground)] mb-2">
                    <CheckCircle2 size={14} className="text-emerald-500" /> Đã tra cứu dữ liệu (Tool: {msg.toolUsed})
                  </div>
                  <div className="bg-[var(--color-muted)] rounded-lg p-3 font-mono text-xs text-[var(--color-foreground)] break-all max-h-40 overflow-y-auto custom-scrollbar">
                    {msg.toolResult.message}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start">
              <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
                <div className="flex items-center gap-3 text-[var(--color-muted-foreground)]">
                  <Loader2 size={18} className="animate-spin text-indigo-500" />
                  <span className="text-sm">AI đang suy nghĩ và tổng hợp dữ liệu...</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="shrink-0 p-6 pt-2 bg-[var(--color-background)] border-t border-[var(--color-border)]">
        <div className="max-w-4xl mx-auto relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập câu hỏi để phân tích KPI..."
            className="w-full bg-[var(--color-card)] border border-[var(--color-border)] rounded-2xl px-5 py-4 pr-16 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none shadow-sm transition-shadow hover:shadow-md"
            rows={2}
            style={{ minHeight: '80px', maxHeight: '200px' }}
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-3 bottom-3 p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-[var(--color-muted)] disabled:text-[var(--color-muted-foreground)] text-white rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
        <p className="text-xs text-center text-[var(--color-muted-foreground)] mt-3">
          AI có thể mắc sai lầm. Hãy kiểm chứng các số liệu quan trọng.
        </p>
      </div>
    </div>
  )
}
