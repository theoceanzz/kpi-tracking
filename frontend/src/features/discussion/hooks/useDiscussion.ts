import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscribeTopic } from '@/lib/realtime'
import { useAuthStore } from '@/store/authStore'
import { discussionApi } from '../api/discussionApi'
import type { DiscussionChange, DiscussionComment, DiscussionReactionType, DiscussionTargetType } from '../types'

export const discussionKey = (type: DiscussionTargetType, id: string) => ['discussion', type, id] as const

/** Danh sách mang số chưa đọc / tiến độ việc cần tải lại khi khung thảo luận thay đổi. */
function invalidateCounters(qc: ReturnType<typeof useQueryClient>, type: DiscussionTargetType) {
  qc.invalidateQueries({ queryKey: type === 'KPI' ? ['kpi-criteria'] : ['kpi-tasks'] })
}

/**
 * Khung thảo luận của một KPI / công việc:
 * - tải trang MỚI NHẤT trước (hoặc đoạn chứa `focusCommentId` khi mở từ thông báo), cuộn lên tải trang cũ hơn;
 * - nghe `/topic/discussion.{TYPE}.{id}` — có thay đổi của người khác thì tải lại, không cần F5;
 * - đánh dấu đã đọc khi mở và mỗi lần có bình luận mới trong lúc đang mở.
 */
export function useDiscussion(type: DiscussionTargetType, id: string | undefined, focusCommentId?: string | null) {
  const qc = useQueryClient()
  const myId = useAuthStore((s) => s.user?.id)
  const key = useMemo(() => discussionKey(type, id ?? ''), [type, id])
  /** Có bình luận mới của NGƯỜI KHÁC vừa về (để hiện nút "Có bình luận mới ↓" khi đang cuộn ở trên). */
  const [incoming, setIncoming] = useState(0)

  const query = useInfiniteQuery({
    queryKey: [...key, focusCommentId ?? null],
    enabled: !!id,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      pageParam == null && focusCommentId ? discussionApi.around(focusCommentId) : discussionApi.page(type, id!, pageParam),
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor : undefined),
    staleTime: 15_000,
  })

  // Thứ tự hiển thị: cũ ở trên, mới ở dưới. Mỗi trang API là mới-nhất-trước, các trang sau là cũ hơn.
  const comments = useMemo<DiscussionComment[]>(() => {
    const pages = query.data?.pages ?? []
    const seen = new Set<string>()
    const out: DiscussionComment[] = []
    for (const page of [...pages].reverse()) {
      for (const c of [...page.content].reverse()) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        out.push(c)
      }
    }
    return out
  }, [query.data])
  const first = query.data?.pages[0]

  const markRead = useCallback(() => {
    if (!id) return
    discussionApi.markRead(type, id).then(() => invalidateCounters(qc, type)).catch(() => {})
  }, [id, type, qc])

  // Mở khung = đã đọc tới hiện tại.
  const markedFor = useRef<string | null>(null)
  useEffect(() => {
    if (!id || !query.isSuccess || markedFor.current === id) return
    markedFor.current = id
    markRead()
  }, [id, query.isSuccess, markRead])

  // Thời gian thực.
  useEffect(() => {
    if (!id) return
    return subscribeTopic(`/topic/discussion.${type}.${id}`, (raw) => {
      const change = raw as DiscussionChange
      qc.invalidateQueries({ queryKey: key })
      if (change.action === 'CREATED') {
        setIncoming((n) => n + 1)
        markRead()
      }
    })
  }, [id, type, key, qc, markRead])

  const refresh = () => qc.invalidateQueries({ queryKey: key })

  const create = useMutation({
    mutationFn: (input: { body: string; parentId?: string | null; mentionIds: string[]; files: File[] }) =>
      discussionApi.create(type, id!, input),
    onSuccess: () => {
      refresh()
      invalidateCounters(qc, type)
    },
  })
  const update = useMutation({
    mutationFn: (v: { commentId: string; body: string; mentionIds: string[] }) =>
      discussionApi.update(v.commentId, { body: v.body, mentionIds: v.mentionIds }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (commentId: string) => discussionApi.remove(commentId),
    onSuccess: () => {
      refresh()
      invalidateCounters(qc, type)
    },
  })
  const react = useMutation({
    mutationFn: (v: { commentId: string; reaction: DiscussionReactionType }) => discussionApi.react(v.commentId, v.reaction),
    onSuccess: refresh,
  })

  return {
    comments,
    query,
    canComment: first?.canComment ?? false,
    canModerate: first?.canModerate ?? false,
    myId,
    incoming,
    clearIncoming: () => setIncoming(0),
    create,
    update,
    remove,
    react,
  }
}
