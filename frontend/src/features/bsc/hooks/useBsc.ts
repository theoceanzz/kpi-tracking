import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bscApi } from '../api/bscApi'
import { PerspectiveRequest, ScorecardRequest, BscScoringMode, FixedPerspectiveUpdateRequest } from '../types'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

export function useBscPerspectives(organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-perspectives', organizationId],
    queryFn: () => bscApi.getPerspectives(organizationId!),
    enabled: !!organizationId,
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
      toast.error(error.response?.data?.message || 'Cập nhật lĩnh vực thất bại')
    },
  })
  return { updateFixedPerspective }
}

export function useBscMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bsc-perspectives'] })

  const createPerspective = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: PerspectiveRequest }) =>
      bscApi.createPerspective(organizationId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Tạo hạng mục thành công')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Tạo hạng mục thất bại')
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
      toast.error(error.response?.data?.message || 'Cập nhật hạng mục thất bại')
    },
  })

  const deletePerspective = useMutation({
    mutationFn: (perspectiveId: string) => bscApi.deletePerspective(perspectiveId),
    onSuccess: () => {
      invalidate()
      toast.success('Xóa hạng mục thành công')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Xóa hạng mục thất bại')
    },
  })

  const importPerspectives = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string; file: File }) =>
      bscApi.importPerspectives(organizationId, file),
    onSuccess: (data) => {
      invalidate()
      toast.success(`Import thành công ${data.successfulImports}/${data.totalRows} hạng mục`)
      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} dòng lỗi: ${data.errors.slice(0, 3).join('; ')}`)
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Import thất bại')
    },
  })

  return { createPerspective, updatePerspective, deletePerspective, importPerspectives }
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
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bsc-scorecards'] })

  const createScorecard = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: ScorecardRequest }) =>
      bscApi.createScorecard(organizationId, data),
    onSuccess: () => { invalidate(); toast.success('Tạo bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Tạo bộ tiêu chí thất bại'),
  })

  const updateScorecard = useMutation({
    mutationFn: ({ scorecardId, data }: { scorecardId: string; data: ScorecardRequest }) =>
      bscApi.updateScorecard(scorecardId, data),
    onSuccess: () => { invalidate(); toast.success('Cập nhật bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cập nhật bộ tiêu chí thất bại'),
  })

  const deleteScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.deleteScorecard(scorecardId),
    onSuccess: () => { invalidate(); toast.success('Xóa bộ tiêu chí thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Xóa bộ tiêu chí thất bại'),
  })

  const updateScoringMode = useMutation({
    mutationFn: ({ scorecardId, mode }: { scorecardId: string; mode: BscScoringMode }) =>
      bscApi.updateScoringMode(scorecardId, mode),
    onSuccess: () => { invalidate(); toast.success('Đã cập nhật chế độ chấm điểm') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cập nhật thất bại'),
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
    onError: (e: any) => toast.error(e.response?.data?.message || 'Import thất bại'),
  })

  return { createScorecard, updateScorecard, deleteScorecard, updateScoringMode, importScorecards }
}
