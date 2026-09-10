import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { ReviewSubmissionRequest } from '@/types/submission'

export function useReviewSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewSubmissionRequest }) => submissionApi.review(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Đã xử lý bài nộp') },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Xử lý bài nộp thất bại')),
  })
}
