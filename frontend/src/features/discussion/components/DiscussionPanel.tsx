import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
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
  /**
   * Chế độ "chảy liền" (bảng chi tiết công việc kiểu Lark): danh sách KHÔNG tự cuộn mà cuộn chung với vùng cha này;
   * không tự cuộn xuống cuối lúc mở; bình luận cũ hơn tải bằng nút "Xem bình luận cũ hơn".
   */
  scrollParent?: RefObject<HTMLElement | null>
  /** Đưa ô viết bình luận ra chỗ này (ghim ở đáy bảng chi tiết). */
  composerSlot?: HTMLElement | null
  /** Dòng xen theo thời gian giữa các bình luận (vd. lịch sử thay đổi của công việc) — dòng thời gian chung kiểu Lark. */
  extras?: { id: string; at: string; node: ReactNode }[]
  /** `lark`: khối "Bình luận" của bảng chi tiết công việc — không thanh ẩn/hiện dòng hệ thống, lề theo bảng, trống thì không vẽ gì. */
  variant?: 'default' | 'lark'
}

/**
 * Khung "Thảo luận" dùng chung cho KPI và công việc, kiểu bình luận mạng xã hội nội bộ: cũ ở trên, mới ở dưới,
 * ô nhập luôn ở cuối; cuộn lên đầu để tải bình luận cũ hơn; bình luận của người khác hiện ra ngay (WebSocket).
 */
export default function DiscussionPanel({ targetType, targetId, focusCommentId, className, scrollParent, composerSlot, extras, variant = 'default' }: Props) {
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
  const flow = !!scrollParent
  /** Phần tử đang cuộn: vùng cha (chế độ chảy liền) hoặc khung riêng. */
  const root = () => (scrollParent ? scrollParent.current : scrollRef.current)

  const visible = hideSystem ? d.comments.filter((c) => c.kind !== 'SYSTEM' || c.replyCount > 0) : d.comments
  // Xen dòng phụ theo thời gian. Còn bình luận cũ chưa tải thì bỏ dòng phụ cũ hơn bình luận cũ nhất đang có (khỏi lệch thứ tự).
  const oldest = d.query.hasNextPage && visible.length ? visible.reduce((m, c) => (c.createdAt < m ? c.createdAt : m), visible[0]!.createdAt) : null
  const shownExtras = (extras ?? []).filter((x) => !oldest || x.at >= oldest)
  const timeline: ({ kind: 'c'; at: string; c: (typeof visible)[number] } | { kind: 'x'; at: string; id: string; node: ReactNode })[] = [
    ...visible.map((c) => ({ kind: 'c' as const, at: c.createdAt, c })),
    ...shownExtras.map((x) => ({ kind: 'x' as const, at: x.at, id: x.id, node: x.node })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))

  // Lần đầu: cuộn xuống cuối, hoặc tới bình luận đích.
  useLayoutEffect(() => {
    const el = root()
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
    // Chảy liền: mở bảng chi tiết thì đọc từ trên xuống, không nhảy xuống bình luận.
    if (flow) { nearBottom.current = false; return }
    el.scrollTop = el.scrollHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.query.isSuccess, focusCommentId])

  // Tải trang cũ hơn: giữ nguyên vị trí đang đọc (bù chiều cao phần vừa chèn lên trên).
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || flow) return
    if (prevHeight.current && !d.query.isFetchingNextPage && el.scrollTop < 40) {
      el.scrollTop += el.scrollHeight - prevHeight.current
    }
    prevHeight.current = 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.comments.length, d.query.isFetchingNextPage])

  // Bình luận mới về khi đang ở cuối ⇒ bám theo; đang cuộn ở trên ⇒ hiện nút "Có bình luận mới".
  useEffect(() => {
    const el = root()
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
    const box = scrollRef.current
    if (!el || !box || flow) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && d.query.hasNextPage && !d.query.isFetchingNextPage && initialScrollDone.current) {
        prevHeight.current = box.scrollHeight
        void d.query.fetchNextPage()
      }
    }, { root: box, rootMargin: '80px 0px 0px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [d.query, flow])

  const onScroll = () => {
    const el = root()
    if (!el) return
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (nearBottom.current && d.incoming) d.clearIncoming()
  }

  // Chảy liền: nghe cuộn của vùng cha.
  useEffect(() => {
    const el = scrollParent?.current
    if (!el) return
    el.addEventListener('scroll', onScroll)
    return () => el.removeEventListener('scroll', onScroll)
  })

  const scrollToBottom = () => {
    const el = root()
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

  const composerBox = (
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
  )

  if (d.query.isError) {
    return (
      <div className={cn('flex flex-1 items-center justify-center p-6 text-sm text-[var(--color-error)]', className)}>
        {getApiErrorMessage(d.query.error)}
      </div>
    )
  }

  return (
    <div className={cn('relative flex min-h-0 flex-1 flex-col', className)}>
      {variant !== 'lark' && <div className="flex items-center justify-end gap-2 border-b border-[var(--color-border)] px-4 py-1.5">
        <button
          type="button"
          onClick={() => setHideSystem((v) => !v)}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-subtle-foreground)] hover:text-[var(--color-foreground)]"
        >
          {hideSystem ? <Eye size={13} /> : <EyeOff size={13} />}
          {hideSystem ? t('panel.showSystem') : t('panel.hideSystem')}
        </button>
      </div>}

      <div ref={scrollRef} onScroll={flow ? undefined : onScroll} className={cn(variant === 'lark' ? 'px-6 py-2' : 'px-4 py-3', !flow && 'min-h-0 flex-1 overflow-y-auto')}>
        <div ref={topRef} />
        {flow && d.query.hasNextPage && (
          <button type="button" disabled={d.query.isFetchingNextPage} onClick={() => void d.query.fetchNextPage()}
            className="mb-2 w-full rounded-md py-1.5 text-xs text-[var(--color-primary)] hover:bg-[var(--color-muted)]">
            {t('panel.older')}
          </button>
        )}
        {d.query.isFetchingNextPage && (
          <div className="flex justify-center py-2"><Loader2 size={16} className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
        )}
        {d.query.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
        ) : timeline.length === 0 ? (variant === 'lark' ? null : (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-[var(--color-subtle-foreground)]">
            <MessagesSquare size={28} />
            {t('panel.empty')}
          </div>
        )) : (
          <div className="space-y-1">
            {timeline.map((item) => item.kind === 'x' ? <Fragment key={`x:${item.id}`}>{item.node}</Fragment> : (() => { const c = item.c; return (
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
            ) })())}
          </div>
        )}
      </div>

      {d.incoming > 0 && !nearBottom.current && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn('inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1 text-xs text-[var(--color-primary-foreground)] shadow-md',
            flow ? 'sticky bottom-3 mx-auto mb-2 w-fit self-center' : 'absolute bottom-24 left-1/2 -translate-x-1/2')}
        >
          <ArrowDown size={12} /> {t('panel.newComments')}
        </button>
      )}

      {flow ? (composerSlot ? createPortal(composerBox, composerSlot) : null) : composerBox}
    </div>
  )
}
