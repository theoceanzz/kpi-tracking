import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bscApi } from '../api/bscApi'
import { PerspectiveRequest, ScorecardRequest, BscScoringMode } from '../types'
import { toast } from 'sonner'

export function useBscPerspectives(organizationId?: string) {
  return useQuery({
    queryKey: ['bsc-perspectives', organizationId],
    queryFn: () => bscApi.getPerspectives(organizationId!),
    enabled: !!organizationId,
  })
}

export function useBscMutations() {
  const queryClient = useQueryClient()

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bsc-perspectives'] })

  const createPerspective = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: PerspectiveRequest }) =>
      bscApi.createPerspective(organizationId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Tạo viễn cảnh thành công')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Tạo viễn cảnh thất bại')
    },
  })

  const updatePerspective = useMutation({
    mutationFn: ({ perspectiveId, data }: { perspectiveId: string; data: PerspectiveRequest }) =>
      bscApi.updatePerspective(perspectiveId, data),
    onSuccess: () => {
      invalidate()
      toast.success('Cập nhật viễn cảnh thành công')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Cập nhật viễn cảnh thất bại')
    },
  })

  const deletePerspective = useMutation({
    mutationFn: (perspectiveId: string) => bscApi.deletePerspective(perspectiveId),
    onSuccess: () => {
      invalidate()
      toast.success('Xóa viễn cảnh thành công')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Xóa viễn cảnh thất bại')
    },
  })

  const importPerspectives = useMutation({
    mutationFn: ({ organizationId, file }: { organizationId: string; file: File }) =>
      bscApi.importPerspectives(organizationId, file),
    onSuccess: (data) => {
      invalidate()
      toast.success(`Import thành công ${data.successfulImports}/${data.totalRows} viễn cảnh`)
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

export function useBscDashboard(scorecardId?: string) {
  return useQuery({
    queryKey: ['bsc-dashboard', scorecardId],
    queryFn: () => bscApi.getDashboard(scorecardId!),
    enabled: !!scorecardId,
  })
}

export function useScorecardMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['bsc-scorecards'] })
    queryClient.invalidateQueries({ queryKey: ['bsc-dashboard'] })
  }

  const createScorecard = useMutation({
    mutationFn: ({ organizationId, data }: { organizationId: string; data: ScorecardRequest }) =>
      bscApi.createScorecard(organizationId, data),
    onSuccess: () => { invalidate(); toast.success('Tạo thẻ điểm thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Tạo thẻ điểm thất bại'),
  })

  const updateScorecard = useMutation({
    mutationFn: ({ scorecardId, data }: { scorecardId: string; data: ScorecardRequest }) =>
      bscApi.updateScorecard(scorecardId, data),
    onSuccess: () => { invalidate(); toast.success('Cập nhật thẻ điểm thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Cập nhật thẻ điểm thất bại'),
  })

  const deleteScorecard = useMutation({
    mutationFn: (scorecardId: string) => bscApi.deleteScorecard(scorecardId),
    onSuccess: () => { invalidate(); toast.success('Xóa thẻ điểm thành công') },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Xóa thẻ điểm thất bại'),
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
      toast.success(`Import thành công ${data.successfulImports} thẻ điểm`)
      if (data.errors && data.errors.length > 0) {
        toast.error(`${data.errors.length} lỗi: ${data.errors.slice(0, 3).join('; ')}`)
      }
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Import thất bại'),
  })

  return { createScorecard, updateScorecard, deleteScorecard, updateScoringMode, importScorecards }
}
