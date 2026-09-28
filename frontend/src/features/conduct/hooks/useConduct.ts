import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import {
  conductApi,
  type ConductConfig,
  type ConductScoreInput,
  type ConductSetInput,
  type ConductTarget,
} from '../api/conductApi'
import { useTranslation } from 'react-i18next'

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
  const { t } = useTranslation('conduct')
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
    toast.error(getApiErrorMessage(e, fallback))
  }

  const create = useMutation({
    mutationFn: (data: ConductSetInput) => conductApi.createSet(organizationId!, data),
    onSuccess: onDone(t('useConduct.criteriaSetCreated')),
    onError: onFail(t('useConduct.couldNotCreateTheCriteriaSet')),
  })

  const update = useMutation({
    mutationFn: ({ setId, data }: { setId: string; data: ConductSetInput }) =>
      conductApi.updateSet(organizationId!, setId, data),
    onSuccess: onDone(t('useConduct.conductCriteriaSetSaved')),
    onError: onFail(t('useConduct.couldNotSaveTheConductCriteria')),
  })

  const remove = useMutation({
    mutationFn: (setId: string) => conductApi.deleteSet(organizationId!, setId),
    onSuccess: onDone(t('useConduct.criteriaSetDeleted')),
    onError: onFail(t('useConduct.couldNotDeleteTheCriteriaSet')),
  })

  const markDefault = useMutation({
    mutationFn: (setId: string) => conductApi.markDefaultSet(organizationId!, setId),
    onSuccess: onDone(t('useConduct.defaultSetUpdated')),
    onError: onFail(t('useConduct.couldNotSetTheDefaultSet')),
  })

  const reset = useMutation({
    mutationFn: (setId?: string) => conductApi.resetSet(organizationId!, setId),
    onSuccess: onDone(t('useConduct.resetTheDefaultCriteriaSet')),
    onError: onFail(t('useConduct.couldNotResetTheCriteriaSet')),
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
  const { t } = useTranslation('conduct')
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
      toast.success(t('useConduct.selfAssessmentSaved'))
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, t('useConduct.couldNotSaveTheSelfAssessment'))),
  })

  const saveManager = useMutation({
    mutationFn: ({ items, comment }: { items: ConductScoreInput[]; comment?: string | null }) =>
      conductApi.saveManager(target, userId!, items, comment),
    onSuccess: () => {
      invalidate()
      toast.success(t('useConduct.conductScoreSaved'))
    },
    onError: (e: any) => toast.error(getApiErrorMessage(e, t('useConduct.couldNotSaveTheConductScore'))),
  })

  return {
    ...query,
    saveSelf: saveSelf.mutate,
    isSavingSelf: saveSelf.isPending,
    saveManager: saveManager.mutate,
    isSavingManager: saveManager.isPending,
    // Bản async dành cho form CHỦ nó lưu hộ (modal tự đánh giá lưu luôn phiếu hạnh kiểm
    // khi bấm "Gửi đánh giá"): form phải đợi lưu xong rồi mới gửi tiếp, và phải bắt được
    // lỗi để dừng lại thay vì gửi đánh giá với điểm hành vi chưa kịp lưu.
    saveSelfAsync: saveSelf.mutateAsync,
    saveManagerAsync: saveManager.mutateAsync,
  }
}

export function useConductSummary(target: ConductTarget, orgUnitId?: string) {
  return useQuery({
    queryKey: ['conduct', 'summary', ...targetKey(target), orgUnitId],
    queryFn: () => conductApi.getSummary(target, orgUnitId!),
    enabled: isTargetReady(target) && !!orgUnitId,
  })
}
