import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  conductApi,
  type ConductConfig,
  type ConductScoreInput,
  type ConductSetInput,
  type ConductTarget,
} from '../api/conductApi'

/** Đợt/kỳ đã chọn đủ để gọi API chưa — chưa chọn thì mọi query nằm im. */
export const isTargetReady = (t: ConductTarget) =>
  t.scope === 'PERIOD' ? !!t.periodId : !!t.cycleId

const targetKey = (t: ConductTarget) => [t.scope, t.periodId ?? null, t.cycleId ?? null]

export function useConductConfig(organizationId?: string) {
  return useQuery({
    queryKey: ['conduct', 'config', organizationId],
    queryFn: () => conductApi.getConfig(organizationId!),
    enabled: !!organizationId,
  })
}

/**
 * Sửa các BỘ tiêu chí. Mỗi lời gọi trả về toàn bộ cấu hình nên ghi thẳng vào cache thay
 * vì invalidate rồi tải lại — nếu không, thẻ vừa sửa sẽ nháy về số cũ một nhịp.
 */
export function useConductSets(organizationId?: string) {
  const qc = useQueryClient()
  const key = ['conduct', 'config', organizationId]

  const onDone = (message: string) => (data: ConductConfig) => {
    qc.setQueryData(key, data)
    qc.invalidateQueries({ queryKey: ['conduct', 'sheet'] })
    qc.invalidateQueries({ queryKey: ['conduct', 'summary'] })
    qc.invalidateQueries({ queryKey: ['organization'] })
    toast.success(message)
  }
  const onFail = (fallback: string) => (e: unknown) => {
    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
    toast.error(msg || fallback)
  }

  const create = useMutation({
    mutationFn: (data: ConductSetInput) => conductApi.createSet(organizationId!, data),
    onSuccess: onDone('Đã tạo bộ tiêu chí'),
    onError: onFail('Không thể tạo bộ tiêu chí'),
  })

  const update = useMutation({
    mutationFn: ({ setId, data }: { setId: string; data: ConductSetInput }) =>
      conductApi.updateSet(organizationId!, setId, data),
    onSuccess: onDone('Đã lưu bộ tiêu chí hạnh kiểm'),
    onError: onFail('Không thể lưu bộ tiêu chí hạnh kiểm'),
  })

  const remove = useMutation({
    mutationFn: (setId: string) => conductApi.deleteSet(organizationId!, setId),
    onSuccess: onDone('Đã xoá bộ tiêu chí'),
    onError: onFail('Không thể xoá bộ tiêu chí'),
  })

  const markDefault = useMutation({
    mutationFn: (setId: string) => conductApi.markDefaultSet(organizationId!, setId),
    onSuccess: onDone('Đã đặt bộ mặc định'),
    onError: onFail('Không thể đặt bộ mặc định'),
  })

  const reset = useMutation({
    mutationFn: (setId?: string) => conductApi.resetSet(organizationId!, setId),
    onSuccess: onDone('Đã đặt lại bộ tiêu chí mặc định'),
    onError: onFail('Không thể đặt lại bộ tiêu chí'),
  })

  return {
    createSet: create.mutate,
    isCreating: create.isPending,
    updateSet: update.mutate,
    isUpdating: update.isPending,
    deleteSet: remove.mutate,
    isDeleting: remove.isPending,
    markDefaultSet: markDefault.mutate,
    isMarkingDefault: markDefault.isPending,
    resetSet: reset.mutate,
    isResetting: reset.isPending,
  }
}

/**
 * Phiếu chấm của một người. Bỏ trống `userId` = phiếu của chính mình.
 *
 * Hai mutation tách đôi đúng như hai phía của phiếu giấy: cột tự đánh giá do chính chủ
 * nhập, cột CBQLTT do quản lý nhập — server cũng chặn theo đúng ranh giới đó.
 */
export function useConductSheet(target: ConductTarget, userId?: string) {
  const qc = useQueryClient()
  const enabled = isTargetReady(target)
  const key = ['conduct', 'sheet', ...targetKey(target), userId ?? 'me']

  const query = useQuery({
    queryKey: key,
    queryFn: () => conductApi.getSheet(target, userId),
    enabled,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['conduct'] })
    // Điểm hạnh kiểm lấp trục ma trận nên xếp loại của đợt/kỳ đổi theo. Phiếu nằm ngay
    // trong modal chấm đợt nên score-preview phải làm mới cùng lúc — nếu không, ô "Hành vi"
    // ngay bên cạnh vẫn hiện số cũ dù vừa lưu.
    qc.invalidateQueries({ queryKey: ['evaluations'] })
    qc.invalidateQueries({ queryKey: ['cycleEvaluation'] })
    qc.invalidateQueries({ queryKey: ['score-preview'] })
  }

  const saveSelf = useMutation({
    mutationFn: (items: ConductScoreInput[]) => conductApi.saveSelf(target, items),
    onSuccess: () => {
      invalidate()
      toast.success('Đã lưu phần tự đánh giá')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Không thể lưu phần tự đánh giá'),
  })

  const saveManager = useMutation({
    mutationFn: ({ items, comment }: { items: ConductScoreInput[]; comment?: string | null }) =>
      conductApi.saveManager(target, userId!, items, comment),
    onSuccess: () => {
      invalidate()
      toast.success('Đã lưu điểm hạnh kiểm')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Không thể lưu điểm hạnh kiểm'),
  })

  return {
    ...query,
    saveSelf: saveSelf.mutate,
    isSavingSelf: saveSelf.isPending,
    saveManager: saveManager.mutate,
    isSavingManager: saveManager.isPending,
  }
}

export function useConductSummary(target: ConductTarget, orgUnitId?: string) {
  return useQuery({
    queryKey: ['conduct', 'summary', ...targetKey(target), orgUnitId],
    queryFn: () => conductApi.getSummary(target, orgUnitId!),
    enabled: isTargetReady(target) && !!orgUnitId,
  })
}
