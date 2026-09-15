import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bscApi } from '../api/bscApi'
import { PerspectiveRequest, ScorecardRequest, BscScoringMode, FixedPerspectiveUpdateRequest } from '../types'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'

/**
 * Làm mới MỌI truy vấn của màn BSC sau một thao tác ghi.
 *
 * <p>Màn BSC giờ chỉ còn một khung nhìn duy nhất là CÂY, mà cây đọc từ `bsc-scorecard-tree` — khác
 * hẳn key `bsc-scorecards` mà các mutation ở file này vẫn dọn. Hệ quả: tạo/sửa/xoá bộ tiêu chí
 * xong màn hình đứng im cho tới khi tải lại trang. Bốn key này luôn phải đi cùng nhau vì một thao
 * tác chạm vào bộ tiêu chí là chạm luôn vào cây, độ phủ và kết quả đợt của nó.
 *
 * <p>Khoá phải khớp CHÍNH XÁC khoá mà hook đọc dữ liệu đang dùng — React Query so khớp theo tiền
 * tố mảng, gõ nhầm một chữ là lệnh dọn im lặng không làm gì.
 */
export function useBscInvalidator() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['bsc-scorecards'] })
    queryClient.invalidateQueries({ queryKey: ['bsc-scorecard-tree'] })
    queryClient.invalidateQueries({ queryKey: ['bsc-coverage'] })
    queryClient.invalidateQueries({ queryKey: ['bsc-unit-result'] })
    queryClient.invalidateQueries({ queryKey: ['bsc-perspectives'] })
  }
}

export function useBscPerspectives(organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-perspectives', organizationId],
    queryFn: () => bscApi.getPerspectives(organizationId!),
    enabled: !!organizationId,
  })
}

/**
 * Kế hoạch chia MỘT chỉ tiêu BSC thành KPI theo từng đợt.
 *
 * <p>`staleTime: 0` là có chủ ý: vừa tạo KPI xong là phần "đã chia / còn lại" đổi ngay, đọc lại
 * số cũ sẽ khiến người dùng chia thừa.
 */
export function useBscKpiPlan(scorecardPerspectiveId?: string) {
  return useQuery({
    queryKey: ['bsc-kpi-plan', scorecardPerspectiveId],
    queryFn: () => bscApi.getKpiPlan(scorecardPerspectiveId!),
    enabled: !!scorecardPerspectiveId,
    staleTime: 0,
  })
}

export function useFixedPerspectives(organizationId?: string) {
  const { user } = useAuthStore()
  const orgId = organizationId ?? user?.memberships?.[0]?.organizationId
  return useQuery({
    queryKey: ['bsc-fixed-perspectives', orgId],
    queryFn: () => bscApi.getFixedPerspectives(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  })
}

/** Sửa hiển thị (tên/màu/thứ tự) 1 lĩnh vực cố định theo org. */
export function useFixedPerspectiveMutations() {
  const queryClient = useQueryClient()
  const updateFixedPerspective = useMutation({
    mutationFn: ({ organizationId, code, data }: { organizationId: string; code: string; data: FixedPerspectiveUpdateRequest }) =>
      bscApi.updateFixedPerspective(organizationId, code, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bsc-fixed-perspectives'] })
      toast.success('Cập nhật lĩnh vực thành công')
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Cập nhật lĩnh vực thất bại'))
    },
  })
  return { updateFixedPerspective }
}

export function useBscMutations() {
  const invalidate = useBscInvalidator()

  const createPerspective = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: PerspectiveRequest }) =>
      bscApi.createPerspective(organizationId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Tạo hạng mục thành công')
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Tạo hạng mục thất bại'))
    },
  })

  const updatePerspective = useMutation({
    mutationFn: ({ perspectiveId, data }: { perspectiveId: string; data: PerspectiveRequest }) =>
      bscApi.updatePerspective(perspectiveId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Cập nhật hạng mục thành công')
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Cập nhật hạng mục thất bại'))
    },
  })

  const deletePerspective = useMutation({
    mutationFn: (perspectiveId: string) => bscApi.deletePerspective(perspectiveId),
    onSuccess: () => {
      invalidate()
      toast.success('Xóa hạng mục thành công')
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Xóa hạng mục thất bại'))
    },
  })

  return { createPerspective, updatePerspective, deletePerspective }
}

// ── Scorecards ──────────────────────────────────────────────

export function useScorecards(organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-scorecards', organizationId],
    queryFn: () => bscApi.getScorecards(organizationId!),
    enabled: !!organizationId,
  })
}

export function useScorecardMutations() {
  const invalidate = useBscInvalidator()

  const createScorecard = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: ScorecardRequest }) =>
      bscApi.createScorecard(organizationId, data),
    onSuccess: () => { invalidate(); toast.success('Tạo bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Tạo bộ tiêu chí thất bại')),
  })

  const updateScorecard = useMutation({
    mutationFn: ({ scorecardId, data }: { scorecardId: string; data: ScorecardRequest }) =>
      bscApi.updateScorecard(scorecardId, data),
    onSuccess: () => { invalidate(); toast.success('Cập nhật bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Cập nhật bộ tiêu chí thất bại')),
  })

  const deleteScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.deleteScorecard(scorecardId),
    onSuccess: () => { invalidate(); toast.success('Xóa bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Xóa bộ tiêu chí thất bại')),
  })

  const updateScoringMode = useMutation({
    mutationFn: ({ scorecardId, mode }: { scorecardId: string; mode: BscScoringMode }) =>
      bscApi.updateScoringMode(scorecardId, mode),
    onSuccess: () => { invalidate(); toast.success('Đã cập nhật chế độ chấm điểm') },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Cập nhật thất bại')),
  })

  const importScorecards = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string; file: File }) =>
      bscApi.importScorecards(organizationId, file),
    onSuccess: (data) => {
      invalidate()
      toast.success(`Import thành công ${data.successfulImports} bộ tiêu chí`)
      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} lỗi: ${data.errors.slice(0, 3).join('; ')}`)
      }
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, 'Import thất bại')),
  })

  return { createScorecard, updateScorecard, deleteScorecard, updateScoringMode, importScorecards }
}
