import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { ReviewSubmissionRequest } from '@/types/submission'
import { useTranslation } from 'react-i18next'

export function useReviewSubmission() {
  const { t } = useTranslation('submissions')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReviewSubmissionRequest }) => submissionApi.review(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success(t('useReviewSubmission.submissionProcessed')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useReviewSubmission.failedToProcessTheSubmission'))),
  })
}
