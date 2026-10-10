import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowDown, EyeOff, Eye, Loader2, MessagesSquare } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { useDiscussion } from '../hooks/useDiscussion'
import type { DiscussionComment, DiscussionTargetType } from '../types'
import CommentComposer from './CommentComposer'
import { CommentThread } from './CommentItem'

interface Props {
  targetType: DiscussionTargetType
  targetId: string
  /** Mở từ thông báo: nạp đúng đoạn chứa bình luận này rồi cuộn tới và tô sáng. */
  focusCommentId?: string | null
  className?: string
}

/**
 * Khung "Thảo luận" dùng chung cho KPI và công việc, kiểu bình luận mạng xã hội nội bộ: cũ ở trên, mới ở dưới,
 * ô nhập luôn ở cuối; cuộn lên đầu để tải bình luận cũ hơn; bình luận của người khác hiện ra ngay (WebSocket).
 */
export default function DiscussionPanel({ targetType, targetId, focusCommentId, className }: Props) {
  const { t } = useTranslation('discussion')
  const d = useDiscussion(targetType, targetId, focusCommentId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [highlighted, setHighlighted] = useState<string | null>(focusCommentId ?? null)
  const [hideSystem, setHideSystem] = useState(false)
  const nearBottom = useRef(true)
  const prevHeight = useRef(0)
  const initialScrollDone = useRef(false)

  const visible = hideSystem ? d.comments.filter((c) => c.kind !== 'SYSTEM' || c.replyCount > 0) : d.comments

  // Lần đầu: cuộn xuống cuối, hoặc tới bình luận đích.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || initialScrollDone.current || !d.query.isSuccess) return
    initialScrollDone.current = true
    if (focusCommentId) {
      const target = document.getElementById(`comment-${focusCommentId}`)
      if (target) {
        target.scrollIntoView({ block: 'center' })
        const h = setTimeout(() => setHighlighted(null), 2500)
        return () => clearTimeout(h)
      }
    }
    el.scrollTop = el.scrollHeight
  }, [d.query.isSuccess, focusCommentId])

  // Tải trang cũ hơn: giữ nguyên vị trí đang đọc (bù chiều cao phần vừa chèn lên trên).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (prevHeight.current && !d.query.isFetchingNextPage && el.scrollTop < 40) {
      el.scrollTop += el.scrollHeight - prevHeight.current
    }
    prevHeight.current = 0
  }, [d.comments.length, d.query.isFetchingNextPage])

  // Bình luận mới về khi đang ở cuối ⇒ bám theo; đang cuộn ở trên ⇒ hiện nút "Có bình luận mới".
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !initialScrollDone.current) return
    if (nearBottom.current) {
      el.scrollTop = el.scrollHeight
      d.clearIncoming()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.comments.length])

  // Chạm đầu danh sách ⇒ tải trang cũ hơn.
  useEffect(() => {
    const el = topRef.current
    const root = scrollRef.current
    if (!el || !root) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && d.query.hasNextPage && !d.query.isFetchingNextPage && initialScrollDone.current) {
        prevHeight.current = root.scrollHeight
        void d.query.fetchNextPage()
      }
    }, { root, rootMargin: '80px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [d.query])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom.current && d.incoming) d.clearIncoming()
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    d.clearIncoming()
  }

  const handlers = {
    onReply: (c: DiscussionComment) => setReplyingTo(c.id),
    onEdit: (c: DiscussionComment, v: { body: string; mentionIds: string[] }) =>
      d.update.mutateAsync({ commentId: c.id, body: v.body, mentionIds: v.mentionIds }),
    onDelete: (c: DiscussionComment) =>
      d.remove.mutate(c.id, { onError: (e) => toast.error(getApiErrorMessage(e)) }),
    onReact: (c: DiscussionComment, reaction: DiscussionComment['reactions'][number]['type']) =>
      d.react.mutate({ commentId: c.id, reaction }, { onError: (e) => toast.error(getApiErrorMessage(e)) }),
  }

  if (d.query.isError) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-error)]', className)}>
        {getApiErrorMessage(d.query.error)}
      </div>
    )
  }

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      <div className="flex items-center justify-end gap-2 border-b border-[var(--color-border)] px-4 py-1.5">
        <button
          type="button"
          onClick={() => setHideSystem((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]"
        >
          {hideSystem ? <Eye size={13} /> : <EyeOff size={13} />}
          {hideSystem ? t('panel.showSystem') : t('panel.hideSystem')}
        </button>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <div ref={topRef} />
        {d.query.isFetchingNextPage && (
          <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
        )}
        {d.query.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-[var(--color-subtle-foreground)]">
            <MessagesSquare size={28} />
            {t('panel.empty')}
          </div>
        ) : (
          <div className="space-y-1">
            {visible.map((c) => (
              <CommentThread
                key={c.id}
                comment={c}
                highlighted={highlighted}
                canComment={d.canComment}
                replyingTo={replyingTo}
                setReplyingTo={setReplyingTo}
                submitting={d.create.isPending}
                onReplySubmit={async (parent, v) => {
                  await d.create.mutateAsync({ ...v, parentId: parent.id })
                  setReplyingTo(null)
                }}
                {...handlers}
              />
            ))}
          </div>
        )}
      </div>

      {d.incoming > 0 && !nearBottom.current && (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-24 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary-foreground)] shadow-md"
        >
          <ArrowDown size={12} /> {t('panel.newComments')}
        </button>
      )}

      <div className="border-t border-[var(--color-border)] p-3">
        {d.canComment ? (
          <CommentComposer
            targetType={targetType}
            targetId={targetId}
            draftKey={`${targetType}:${targetId}`}
            submitting={d.create.isPending}
            onSubmit={async (v) => {
              await d.create.mutateAsync(v)
              nearBottom.current = true
            }}
          />
        ) : (
          d.query.isSuccess && <p className="text-center text-xs text-[var(--color-subtle-foreground)]">{t('panel.readOnly')}</p>
        )}
      </div>
    </div>
  )
}
