import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { getApiErrorMessage } from '@/lib/apiError'
import { discussionApi } from '../api/discussionApi'

/**
 * Đích của thông báo bình luận (`/discussions/c/:commentId`): tra bình luận nằm ở KPI hay công việc rồi chuyển tới
 * đúng chỗ, mở tab Thảo luận và cuộn tới bình luận.
 */
export default function DiscussionLinkPage() {
  const { t } = useTranslation('discussion')
  const { commentId } = useParams<{ commentId: string }>()
  const navigate = useNavigate()
  const { data, error } = useQuery({
    queryKey: ['discussion-locate', commentId],
    queryFn: () => discussionApi.locate(commentId!),
    enabled: !!commentId,
    retry: false,
  })

  useEffect(() => {
    if (!data) return
    const comment = encodeURIComponent(data.commentId)
    navigate(
      data.targetType === 'KPI'
        ? `/kpi/${data.targetId}?tab=discussion&comment=${comment}`
        : `/tasks?task=${data.targetId}&comment=${comment}`,
      { replace: true },
    )
  }, [data, navigate])

  return (
    <div className="flex justify-center py-24 text-sm">
      {error ? <span className="text-[var(--color-error)]">{getApiErrorMessage(error, t('link.notFound'))}</span> : <Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" />}
    </div>
  )
}
