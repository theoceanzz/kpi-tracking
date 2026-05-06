import React, { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Loader2, Minimize2, Maximize2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiApi } from '../api/aiApi'

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
  toolResult?: any;
}

export default function AiAssistantWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Xin chào! Tôi có thể giúp gì cho bạn? (Ví dụ: "Có bao nhiêu thành viên trong phòng ban xyz?")' }
  ])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom()
    }
  }, [messages, isOpen, isMinimized])

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
      console.error('AI Chat Error Response:', error?.response?.data)
      console.error('AI Chat Error Status:', error?.response?.status)
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
    <div className={cn(
      "fixed right-6 bottom-6 w-[380px] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-300 z-50",
      isMinimized ? "h-[60px]" : "h-[600px] max-h-[80vh]"
    )}>
      {/* Header */}
      <div className="h-[60px] bg-indigo-600 px-4 flex items-center justify-between shrink-0 cursor-pointer select-none" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
            <Bot size={18} />
          </div>
          <div>
            <h3 className="text-white font-bold text-sm">Trợ lý AI (Gemini)</h3>
            <p className="text-indigo-200 text-[10px]">Luôn sẵn sàng hỗ trợ</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized) }} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false) }} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50 dark:bg-slate-900/50">
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex flex-col", msg.role === 'user' ? "items-end" : "items-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === 'user' 
                    ? "bg-indigo-600 text-white rounded-tr-sm" 
                    : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm shadow-sm"
                )}>
                  {msg.content}
                </div>
                
                {msg.toolResult && (
                  <div className="mt-2 w-[85%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                      <CheckCircle2 size={14} className="text-emerald-500" /> Đã sử dụng tool: {msg.toolUsed}
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2 font-mono text-[11px] text-slate-600 dark:text-slate-300 break-all">
                      {msg.toolResult.message}
                    </div>
                  </div>
                )}
              </div>
            ))}
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
            <div className="relative flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nhập câu hỏi..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
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
            <p className="text-[10px] text-center text-slate-400 mt-2">AI có thể cung cấp thông tin không chính xác. Hãy kiểm tra lại.</p>
          </div>
        </>
      )}
    </div>
  )
}
