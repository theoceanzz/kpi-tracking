import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiSelfCheckApi, type AiSelfCheck, type AiSelfCheckDraft } from '../api/aiReviewApi'

const AVAILABILITY_KEY = ['ai-self-check', 'availability'] as const

/** Lượt đang chạy nền: poll nhẹ tới khi xong (cùng nhịp với AI đánh giá của quản lý). */
const POLL_MS = 3000

const latestKey = (kpiCriteriaId?: string) => ['ai-self-check', 'latest', kpiCriteriaId] as const

function isRunning(c?: AiSelfCheck | null) {
  return c?.status === 'QUEUED' || c?.status === 'RUNNING'
}

/** Mình có tự soi bài được không (tổ chức / đơn vị đã bật, còn token). */
export function useAiSelfCheckAvailability(enabled = true) {
  return useQuery({
    queryKey: AVAILABILITY_KEY,
    queryFn: aiSelfCheckApi.availability,
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * Lần soi mới nhất của mình cho một chỉ tiêu — mở lại trang nộp bài vẫn thấy. Đang chạy thì tự poll 3 giây một
 * lần, xong thì dừng.
 */
export function useLatestAiSelfCheck(kpiCriteriaId?: string, enabled = true) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: latestKey(kpiCriteriaId),
    queryFn: () => aiSelfCheckApi.latest(kpiCriteriaId!),
    enabled: enabled && !!kpiCriteriaId,
    refetchInterval: q => (isRunning(q.state.data) ? POLL_MS : false),
    retry: false,
  })
  // Token chỉ bị trừ khi lượt chạy XONG (lúc bấm chưa tốn gì) — làm mới số token còn lại đúng lúc đó.
  const { id, status } = query.data ?? {}
  useEffect(() => {
    if (status === 'DONE' || status === 'FAILED') qc.invalidateQueries({ queryKey: AVAILABILITY_KEY })
  }, [id, status, qc])
  return query
}

/** Bấm "Nhờ AI soi bài". Lỗi (hết token, chưa có nội dung…) để component tự hiện — câu lỗi của máy chủ đã dịch. */
export function useStartAiSelfCheck() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (draft: AiSelfCheckDraft) => aiSelfCheckApi.start(draft),
    onSuccess: (check, draft) => {
      qc.setQueryData(latestKey(draft.kpiCriteriaId), check)
    },
  })
}
