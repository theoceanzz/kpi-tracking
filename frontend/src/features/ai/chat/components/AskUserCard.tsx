import { useEffect, useRef, useState } from 'react'
import { Check, CircleHelp, CornerDownLeft } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/apiError'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { aiApi, type AskAnswer, type AskQuestion, type AskUserEvent } from '../api/aiApi'

interface Props {
  ask: AskUserEvent
  /** Tóm tắt câu trả lời đã gửi ở lần dựng trước (`null` = đã bỏ qua) — thẻ giữ lại ở trạng thái khoá. */
  answered?: string | null
  /** Báo lên khung chat bản tóm tắt câu trả lời (hoặc `null` khi bỏ qua) để nó nhớ và khoá thẻ. */
  onAnswered?: (summary: string | null) => void
  /** Số giây chờ tối đa của backend (`app.ai.hitl.wait-seconds`). */
  waitSeconds?: number
}

interface Draft {
  picked: string[]
  text: string
}

const EMPTY: Draft = { picked: [], text: '' }

/**
 * Thẻ trợ lý hỏi lại GIỮA LƯỢT — người dùng chọn / nhập rồi lượt chạy tiếp.
 *
 * <p>Mỗi câu hỏi có thể có lựa chọn bấm được (chọn MỘT hoặc chọn NHIỀU) và LUÔN có ô tự nhập: lựa
 * chọn là gợi ý của trợ lý, không phải giới hạn. Thẻ gom được vài câu, trả lời một lần.
 *
 * <p>Khác các nút gợi ý dưới câu trả lời (bấm = một câu hỏi MỚI, trợ lý bắt đầu lại): ở đây lượt vẫn
 * đang chạy trên kết nối SSE và giữ nguyên thứ nó đã tra được; câu trả lời cuối về qua chính luồng đó.
 *
 * <p>Có hạn giờ vì máy chủ đang giữ một luồng để chờ. Hết giờ thì backend tự kết thúc lượt — thẻ chỉ
 * việc nói ra điều đó thay vì để người dùng bấm vào chỗ không còn ai nghe.
 */
export default function AskUserCard({ ask, answered, onAnswered, waitSeconds = 180 }: Props) {
  const questions = ask.questions ?? []
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(() => EMPTY))
  const [sent, setSent] = useState<string | null | undefined>(answered)
  const [busy, setBusy] = useState(false)
  const [left, setLeft] = useState(waitSeconds)
  const done = sent !== undefined || answered !== undefined

  // Đồng hồ ở client chỉ để người dùng biết còn bao lâu; hạn thật nằm ở backend.
  const doneRef = useRef(done)
  doneRef.current = done
  useEffect(() => {
    if (doneRef.current) return
    const timer = setInterval(() => setLeft(s => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(timer)
  }, [ask.questionId])

  const expired = left <= 0
  const disabled = busy || expired
  const single = questions.length === 1

  const labelOf = (q: AskQuestion, value: string) => q.options.find(o => o.value === value)?.label ?? value

  /** Bản tóm tắt để khung chat giữ lại: "câu hỏi: trả lời" từng dòng, hoặc chỉ câu trả lời khi một câu. */
  const summarize = (list: Draft[]) => {
    const lines = questions.map((q, i) => {
      const d = list[i] ?? EMPTY
      const parts = [...d.picked.map(v => labelOf(q, v)), ...(d.text.trim() ? [d.text.trim()] : [])]
      const answer = parts.length ? parts.join(', ') : '(bỏ qua)'
      return single ? answer : `${q.question} → ${answer}`
    })
    return lines.join('\n')
  }

  const send = async (list: Draft[] | null) => {
    if (busy || done) return
    setBusy(true)
    try {
      const answers: AskAnswer[] | null = list
        ? list.map(d => ({ values: d.picked, text: d.text.trim() || undefined }))
        : null
      const accepted = await aiApi.answerTurn(ask.turnId, ask.questionId, answers)
      if (!accepted) {
        toast.info('Câu hỏi này không còn chờ trả lời nữa.')
        setLeft(0)
        return
      }
      const summary = list ? summarize(list) : null
      setSent(summary)
      onAnswered?.(summary)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không gửi được câu trả lời. Bạn thử lại giúp mình nhé.'))
    } finally {
      setBusy(false)
    }
  }

  const update = (index: number, next: Draft) => setDrafts(prev => prev.map((d, i) => (i === index ? next : d)))

  const pick = (index: number, q: AskQuestion, value: string) => {
    const d = drafts[index] ?? EMPTY
    if (q.multiSelect) {
      const picked = d.picked.includes(value) ? d.picked.filter(v => v !== value) : [...d.picked, value]
      update(index, { ...d, picked })
      return
    }
    // Một câu, chọn một, chưa gõ gì: bấm là gửi luôn — giữ nhịp nhanh như một nút bấm.
    if (single && !d.text.trim()) {
      void send([{ picked: [value], text: '' }])
      return
    }
    update(index, { ...d, picked: d.picked[0] === value ? [] : [value] })
  }

  const anyAnswered = drafts.some(d => d.picked.length > 0 || d.text.trim().length > 0)

  if (done) {
    const summary = sent !== undefined ? sent : answered
    return (
      <div className="mt-2 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] p-3 text-sm">
        {single && (
          <p className="text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">{questions[0]?.question}</p>
        )}
        <div className="mt-1 flex items-start gap-1.5 font-medium text-[var(--color-foreground)]">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" />
          {summary
            ? <span className="whitespace-pre-line">{single ? `Bạn đã trả lời: ${summary}` : summary}</span>
            : <span>Bạn đã bỏ qua câu hỏi này.</span>}
        </div>
      </div>
    )
  }

  return (
    <div className="mt-2 w-full rounded-control border border-[var(--color-ai-line)] bg-[var(--color-ai-soft)] p-3">
      <div className="flex flex-col gap-4">
        {questions.map((q, index) => {
          const d = drafts[index] ?? EMPTY
          return (
            <div key={index}>
              <div className="mb-2 flex items-start gap-1.5 text-sm font-medium">
                <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-ai)]" />
                <span className="text-[var(--color-foreground)]">
                  {q.question}
                  {q.multiSelect && (
                    <span className="ml-1.5 text-xs font-normal text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">
                      (chọn được nhiều)
                    </span>
                  )}
                </span>
              </div>

              {q.options.length > 0 && (
                <div className="mb-1.5 flex flex-col gap-1.5" role={q.multiSelect ? 'group' : 'radiogroup'}>
                  {q.options.map(option => {
                    const on = d.picked.includes(option.value)
                    return (
                      <button
                        key={option.value + option.label}
                        type="button"
                        disabled={disabled}
                        aria-pressed={on}
                        onClick={() => pick(index, q, option.value)}
                        className={cn(
                          'flex items-start gap-2 rounded-control border px-3 py-2 text-left text-sm transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]',
                          'disabled:cursor-not-allowed disabled:opacity-40',
                          on
                            ? 'border-[var(--color-ai)] bg-[var(--color-card)]'
                            : 'border-[var(--color-ai-line)] bg-[var(--color-card)] hover:bg-[var(--color-ai-soft)]',
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border',
                            q.multiSelect ? 'rounded-[4px]' : 'rounded-full',
                            on
                              ? 'border-[var(--color-ai-solid)] bg-[var(--color-ai-solid)] text-white'
                              : 'border-[var(--color-border)]',
                          )}
                        >
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0">
                          <span className="font-medium text-[var(--color-foreground)]">{option.label}</span>
                          {option.description && (
                            <span className="block text-xs text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">
                              {option.description}
                            </span>
                          )}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              <Input
                className="no-edit-hint"
                size="sm"
                placeholder={q.options.length ? 'Hoặc tự nhập…' : 'Câu trả lời của bạn…'}
                value={d.text}
                disabled={disabled}
                onChange={e => update(index, { ...d, text: e.target.value })}
                onKeyDown={e => {
                  if (e.key === 'Enter' && single && anyAnswered) {
                    e.preventDefault()
                    void send(drafts)
                  }
                }}
                suffix={single ? (
                  <button
                    type="button"
                    title="Gửi câu trả lời"
                    disabled={disabled || !anyAnswered}
                    onClick={() => send(drafts)}
                    className="text-[var(--color-ai)] disabled:opacity-30"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                  </button>
                ) : undefined}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {/* Chọn nhiều hoặc nhiều câu thì cần một nút Gửi rõ ràng; một câu chọn-một đã gửi ngay khi bấm. */}
          {(!single || questions[0]?.multiSelect || (questions[0]?.options.length ?? 0) === 0) && (
            <Button type="button" size="sm" disabled={disabled || !anyAnswered} onClick={() => send(drafts)}>
              Gửi
            </Button>
          )}
          <button
            type="button"
            disabled={disabled}
            onClick={() => send(null)}
            className="text-xs text-[var(--color-muted-foreground)] underline-offset-2 hover:underline disabled:opacity-40 dark:text-[var(--color-subtle-foreground)]"
          >
            Bỏ qua
          </button>
        </div>
        <span className="text-xs text-[var(--color-muted-foreground)] dark:text-[var(--color-subtle-foreground)]">
          {expired ? 'Đã hết thời gian chờ' : `Còn ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}
        </span>
      </div>
    </div>
  )
}
