import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { toast } from 'sonner'
import type { CreateSubmissionRequest } from '@/types/submission'

export function useCreateSubmission() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSubmissionRequest) => submissionApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['submissions'] }); toast.success('Nộp bài thành công') },
    onError: () => toast.error('Nộp bài thất bại'),
  })
}
