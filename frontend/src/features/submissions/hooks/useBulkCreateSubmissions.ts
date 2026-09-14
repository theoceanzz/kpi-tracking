import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { submissionApi } from '../api/submissionApi'
import type { CreateSubmissionRequest } from '@/types/submission'

export interface BulkSubmitResult {
  ok: number
  failed: { kpiCriteriaId: string; message: string }[]
}

/** Thông điệp backend trả về, nếu đọc được. Lỗi mạng thì rơi về câu mặc định. */
function apiErrorMessage(err: unknown): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return typeof message === 'string' && message ? message : 'Nộp thất bại'
}

/**
 * Nộp nhiều báo cáo trong một thao tác của người dùng.
 *
 * Backend KHÔNG có endpoint nộp hàng loạt (`/submissions` chỉ nhận một bản; `bulk-review` là để
 * DUYỆT, không phải nộp), nên phải gọi lần lượt ở client.
 *
 * Dùng `allSettled` chứ không phải `all`: một chỉ tiêu hỏng — quá hạn đợt, hoặc vừa bị người khác
 * nộp hộ — không được phép nuốt mất những bản đã nộp thành công. Kết quả trả về nói rõ cái nào
 * trượt để màn hình giữ lại đúng những dòng đó cho người dùng sửa.
 *
 * Chạy tuần tự chứ không song song: mỗi bản nộp đều đụng vào cùng một đợt và cùng một người, bắn
 * song song thì các phép đếm `submissionCount` phía server chạy đua với nhau.
 */
export function useBulkCreateSubmissions() {
  const qc = useQueryClient()

  return useMutation<BulkSubmitResult, Error, CreateSubmissionRequest[]>({
    mutationFn: async payloads => {
      const failed: BulkSubmitResult['failed'] = []
      let ok = 0

      for (const payload of payloads) {
        try {
          await submissionApi.create(payload)
          ok += 1
        } catch (err) {
          failed.push({ kpiCriteriaId: payload.kpiCriteriaId, message: apiErrorMessage(err) })
        }
      }

      return { ok, failed }
    },
    onSuccess: result => {
      // Làm mới cả ba: danh sách bản nộp, chỉ tiêu (đếm `submissionCount` nằm trong đó), và thống kê.
      qc.invalidateQueries({ queryKey: ['submissions'] })
      qc.invalidateQueries({ queryKey: ['kpi-criteria'] })
      qc.invalidateQueries({ queryKey: ['stats'] })

      if (result.ok > 0 && result.failed.length === 0) {
        toast.success(`Đã nộp ${result.ok} báo cáo`)
      } else if (result.ok > 0) {
        toast.warning(`Nộp được ${result.ok}, còn ${result.failed.length} chỉ tiêu lỗi`)
      } else {
        toast.error(result.failed[0]?.message ?? 'Nộp thất bại')
      }
    },
    onError: () => toast.error('Nộp báo cáo thất bại'),
  })
}
