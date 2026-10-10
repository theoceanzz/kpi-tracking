import { useQuery } from '@tanstack/react-query'
import { submissionApi } from '../api/submissionApi'
import { SubmissionStatus } from '@/types/submission'

/**
 * Nguồn bài nộp cho một phiếu đánh giá: phiếu của CHÍNH MÌNH đọc `/submissions/my` (ai cũng gọi được);
 * xem phiếu người khác mới cần `/submissions` (SUBMISSION:REVIEW). Nhân viên mở phiếu tự đánh giá mà gọi
 * `/submissions` là 403.
 */
export function submissionSourceFor(evaluationUserId: string | null | undefined, myUserId: string | null | undefined): 'my' | 'all' | null {
  if (!evaluationUserId || !myUserId) return null
  return evaluationUserId === myUserId ? 'my' : 'all'
}

/** Bài nộp của một người trong một đợt, theo đúng quyền của người đang xem. */
export function useEvaluationSubmissions(args: {
  evaluationUserId?: string | null
  myUserId?: string | null
  kpiPeriodId?: string | null
  enabled: boolean
}) {
  const source = submissionSourceFor(args.evaluationUserId, args.myUserId)
  return useQuery({
    queryKey: ['submissions', source, args.evaluationUserId, args.kpiPeriodId],
    queryFn: () => source === 'my'
      ? submissionApi.getMy({ page: 0, size: 500, kpiPeriodId: args.kpiPeriodId ?? undefined })
      : submissionApi.getAll({ page: 0, size: 500, submittedById: args.evaluationUserId ?? undefined, kpiPeriodId: args.kpiPeriodId ?? undefined }),
    enabled: args.enabled && source != null,
  })
}

export function useSubmissions(params: { 
  page?: number; 
  size?: number; 
  status?: SubmissionStatus; 
  kpiCriteriaId?: string;
  submittedById?: string;
  orgUnitId?: string;
  kpiPeriodId?: string;
  organizationId?: string;
  sortBy?: string;
  sortDir?: string;
} = {}) {
  return useQuery({
    queryKey: ['submissions', 'all', params],
    queryFn: () => submissionApi.getAll(params),
  })
}
