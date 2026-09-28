import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import type { CreateSubmissionRequest } from '@/types/submission'
import { useTranslation } from 'react-i18next'

export function useCreateSubmission() {
  const { t } = useTranslation('submissions')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSubmissionRequest) => submissionApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success(t('useCreateSubmission.submittedSuccessfully')) },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useCreateSubmission.submissionFailed'))),
  })
}
