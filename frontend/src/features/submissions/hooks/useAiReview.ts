import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import i18n from 'i18next'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  aiCriteriaSetApi, aiReviewApi, type AiCriteriaSetItem, type AiCriteriaSetMeta, type AiReview, type AiReviewSettings,
} from '../api/aiReviewApi'

const key = (periodId?: string, userId?: string) => ['ai-review', periodId, userId] as const

/** Lượt đang chạy nền: poll nhẹ tới khi xong. Đóng màn chấm rồi mở lại vẫn lấy đúng lượt đó. */
const POLL_MS = 3000

function isRunning(r?: AiReview | null) {
  return r?.status === 'QUEUED' || r?.status === 'RUNNING'
}

/**
 * Kết quả AI đọc bài nộp mới nhất của một nhân viên trong một đợt. React Query giữ trạng thái máy chủ;
 * đang chạy thì tự poll 3 giây một lần, xong thì dừng.
 */
export function useAiReview(periodId?: string, userId?: string, enabled = true) {
  return useQuery({
    queryKey: key(periodId, userId),
    queryFn: () => aiReviewApi.latest(periodId!, userId!),
    enabled: enabled && !!periodId && !!userId,
    refetchInterval: q => (isRunning(q.state.data) ? POLL_MS : false),
    // 403 (tắt tính năng / ngoài phạm vi) không đáng thử lại.
    retry: false,
  })
}

/** Bấm "Nhờ AI xem trước" hoặc "Chạy lại". */
export function useRequestAiReview(periodId?: string, userId?: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rerunId }: { rerunId?: string }) =>
      rerunId ? aiReviewApi.rerun(rerunId) : aiReviewApi.request(periodId!, userId!),
    onSuccess: review => {
      qc.setQueryData(key(periodId, userId), review)
      if (review.status === 'DONE') toast.info('Bài nộp không đổi từ lần AI đọc trước — hiện lại kết quả cũ.')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không nhờ AI đọc được lúc này.')),
  })
}

export function useAiReviewSettings(enabled = true) {
  return useQuery({
    queryKey: ['ai-review-settings'],
    queryFn: aiReviewApi.getSettings,
    enabled,
    retry: false,
  })
}

export function useUpdateAiReviewSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: AiReviewSettings) => aiReviewApi.updateSettings(body),
    onSuccess: data => {
      qc.setQueryData(['ai-review-settings'], data)
      // Cờ nằm cả trên thông tin tổ chức — làm mới để màn chấm hiện/ẩn nút ngay.
      qc.invalidateQueries({ queryKey: ['organization'] })
      toast.success(i18n.t('submissions:AiReviewSettings.saved'))
    },
    onError: err => toast.error(getApiErrorMessage(err, i18n.t('submissions:AiReviewSettings.saveFailed'))),
  })
}

/** "Nhờ AI xem trước cả đơn vị": xếp hàng chạy nền, kết quả từng người hiện dần trong màn chấm. */
export function useAiReviewBatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ periodId, orgUnitId }: { periodId: string; orgUnitId: string }) =>
      aiReviewApi.batch(periodId, orgUnitId),
    onSuccess: r => {
      qc.invalidateQueries({ queryKey: ['ai-review'] })
      if (r.queued === 0 && r.reused === 0) {
        toast.info('Không có ai để AI đọc (chưa có chỉ tiêu, ngoài phạm vi hoặc đơn vị đã tắt tính năng).')
      } else {
        toast.success(`AI đang đọc bài của ${r.queued} người`
          + (r.reused ? `, ${r.reused} người đã có kết quả mới` : '')
          + (r.skipped ? `, bỏ qua ${r.skipped}` : '') + '. Mở màn chấm từng người để xem.')
      }
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không chạy được theo lô lúc này.')),
  })
}

export function useAiReviewReport(periodId?: string, orgUnitId?: string) {
  return useQuery({
    queryKey: ['ai-review-report', periodId, orgUnitId],
    queryFn: () => aiReviewApi.report(periodId!, orgUnitId),
    enabled: !!periodId,
    retry: false,
  })
}

export function useAiReviewUnitSettings(enabled = true) {
  return useQuery({ queryKey: ['ai-review-unit-settings'], queryFn: aiReviewApi.unitSettings, enabled, retry: false })
}

export function useSaveAiReviewUnitSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ orgUnitId, body }: { orgUnitId: string; body: AiReviewSettings }) =>
      aiReviewApi.saveUnitSetting(orgUnitId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-review-unit-settings'] })
      toast.success(i18n.t('submissions:AiUnitWeights.saved'))
    },
    onError: err => toast.error(getApiErrorMessage(err, i18n.t('submissions:AiUnitWeights.saveFailed'))),
  })
}

export function useDeleteAiReviewUnitSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orgUnitId: string) => aiReviewApi.deleteUnitSetting(orgUnitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-review-unit-settings'] })
      toast.success(i18n.t('submissions:AiUnitWeights.removed'))
    },
    onError: err => toast.error(getApiErrorMessage(err, i18n.t('submissions:AiUnitWeights.removeFailed'))),
  })
}

// ── bộ tiêu chí ─────────────────────────────────────────────────────────

const SETS_KEY = ['ai-criteria-sets'] as const

export function useAiCriteriaSets(enabled = true) {
  return useQuery({ queryKey: SETS_KEY, queryFn: aiCriteriaSetApi.list, enabled, retry: false })
}

export function useAiCriteriaSet(id?: string | null) {
  return useQuery({
    queryKey: [...SETS_KEY, id],
    queryFn: () => aiCriteriaSetApi.get(id!),
    enabled: !!id,
    retry: false,
  })
}

export function useUploadAiCriteriaSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ file, orgUnitId, title }: { file: File; orgUnitId?: string | null; title?: string }) =>
      aiCriteriaSetApi.upload(file, orgUnitId, title),
    onSuccess: set => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      qc.setQueryData([...SETS_KEY, set.id], set)
      toast.success('AI đã bóc xong bản nháp — đối chiếu từng dòng với tài liệu rồi xác nhận.')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không bóc được bộ tiêu chí.')),
  })
}

export function useUpdateAiCriteriaItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items: AiCriteriaSetItem[] }) => aiCriteriaSetApi.updateItems(id, items),
    onSuccess: set => {
      qc.setQueryData([...SETS_KEY, set.id], set)
      toast.success('Đã lưu bản nháp.')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không lưu được bản nháp.')),
  })
}

export function useConfirmAiCriteriaSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiCriteriaSetApi.confirm(id),
    onSuccess: set => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      toast.success(`Đã áp dụng cho ${set.orgUnitName ?? 'cả tổ chức'} — AI dùng tài liệu này khi chấm từ bây giờ.`)
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không xác nhận được.')),
  })
}

export function useUpdateAiCriteriaSetInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, meta }: { id: string; meta: AiCriteriaSetMeta }) => aiCriteriaSetApi.updateInfo(id, meta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      toast.success('Đã lưu thông tin bộ tiêu chí.')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không lưu được thông tin.')),
  })
}

export function useCloneAiCriteriaSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, meta }: { id: string; meta: AiCriteriaSetMeta }) => aiCriteriaSetApi.clone(id, meta),
    onSuccess: set => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      toast.success(set.status === 'CONFIRMED'
        ? `Đã nhân bản — “${set.title}” dùng ngay cho ${set.orgUnitName ?? 'cả tổ chức'}.`
        : `Đã nhân bản thành bản nháp “${set.title}”.`)
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không nhân bản được.')),
  })
}

const REQUESTS_KEY = ['ai-criteria-requests'] as const

/** Đơn vị người dùng áp được quy chế — cho ô chọn đơn vị. */
export function useAiCriteriaScope(enabled = true) {
  return useQuery({ queryKey: ['ai-criteria-scope'], queryFn: aiCriteriaSetApi.scope, enabled, staleTime: 5 * 60_000, retry: false })
}

/** Đề nghị đổi quy chế người dùng quyết được. */
export function usePendingAiCriteriaRequests(enabled = true) {
  return useQuery({ queryKey: REQUESTS_KEY, queryFn: aiCriteriaSetApi.pendingRequests, enabled, retry: false, refetchInterval: 60_000 })
}

function useSetMutation<V>(fn: (v: V) => Promise<unknown>, ok: string, fail: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      qc.invalidateQueries({ queryKey: REQUESTS_KEY })
      toast.success(ok)
    },
    onError: err => toast.error(getApiErrorMessage(err, fail)),
  })
}

export const useStopAiCriteriaSet = () =>
  useSetMutation((id: string) => aiCriteriaSetApi.stop(id), 'Đã ngừng áp dụng.', 'Không ngừng áp dụng được.')

export const useReapplyAiCriteriaSet = () =>
  useSetMutation(({ id, orgUnitId }: { id: string; orgUnitId: string | null }) => aiCriteriaSetApi.reapply(id, orgUnitId),
    'Đã áp dụng cho đơn vị.', 'Không áp dụng được.')

export const useRequestAiCriteriaChange = () =>
  useSetMutation(({ id, meta }: { id: string; meta: AiCriteriaSetMeta }) => aiCriteriaSetApi.requestChange(id, meta),
    'Đã gửi đề nghị — người đã áp tài liệu hiện tại sẽ nhận thông báo.', 'Không gửi được đề nghị.')

export const useCloneAndRequestAiCriteria = () =>
  useSetMutation(({ id, meta }: { id: string; meta: AiCriteriaSetMeta }) => aiCriteriaSetApi.cloneAndRequest(id, meta),
    'Đã nhân bản và gửi đề nghị — người đã áp tài liệu hiện tại sẽ nhận thông báo.', 'Không gửi được đề nghị.')

export const useApproveAiCriteriaRequest = () =>
  useSetMutation(({ id, note }: { id: string; note?: string }) => aiCriteriaSetApi.approveRequest(id, note),
    'Đã đồng ý — đơn vị chuyển sang tài liệu được đề nghị.', 'Không duyệt được đề nghị.')

export const useRejectAiCriteriaRequest = () =>
  useSetMutation(({ id, note }: { id: string; note?: string }) => aiCriteriaSetApi.rejectRequest(id, note),
    'Đã từ chối đề nghị.', 'Không từ chối được đề nghị.')

export const useCancelAiCriteriaRequest = () =>
  useSetMutation((id: string) => aiCriteriaSetApi.cancelRequest(id), 'Đã rút đề nghị.', 'Không rút được đề nghị.')

export function useDeleteAiCriteriaSet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiCriteriaSetApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SETS_KEY })
      toast.success('Đã xoá bộ tiêu chí.')
    },
    onError: err => toast.error(getApiErrorMessage(err, 'Không xoá được bộ tiêu chí.')),
  })
}
