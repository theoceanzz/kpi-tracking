import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { kpiApprovalApi } from '../api/kpiApprovalApi'
import { useTranslation } from 'react-i18next'

export const kpiApprovalKeys = {
  chain: (kpiId: string) => ['kpi-approval-chain', kpiId] as const,
  // Nằm DƯỚI tiền tố 'kpi-criteria': hộp chờ là một danh sách KPI, nên mọi chỗ đã làm mới
  // ['kpi-criteria'] sau khi sửa/xoá/gửi KPI cũng làm mới luôn hộp chờ — trước đây trưởng đơn vị
  // sửa KPI đang chờ mình duyệt phải tải lại trang mới thấy.
  inbox: (params: object) => ['kpi-criteria', 'approval-inbox', params] as const,
  inboxCount: ['kpi-approval-inbox-count'] as const,
}

/** Stepper + lịch sử duyệt của một KPI. */
export function useKpiApprovalChain(kpiId: string | undefined) {
  return useQuery({
    queryKey: kpiApprovalKeys.chain(kpiId ?? ''),
    queryFn: () => kpiApprovalApi.chain(kpiId!),
    enabled: !!kpiId,
  })
}

/** Chỉ tiêu đang chờ ĐÚNG người đang đăng nhập. */
export function useKpiApprovalInbox(params: { kpiPeriodId?: string; orgUnitId?: string }, enabled = true) {
  return useQuery({
    queryKey: kpiApprovalKeys.inbox(params),
    queryFn: () => kpiApprovalApi.inbox(params),
    enabled,
  })
}

/** Sau mọi thao tác trên chuỗi: làm mới danh sách KPI, hộp chờ và stepper. */
export function invalidateApprovalQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['kpi-criteria'] }) // gồm cả hộp chờ (kpiApprovalKeys.inbox)
  qc.invalidateQueries({ queryKey: kpiApprovalKeys.inboxCount })
  qc.invalidateQueries({ queryKey: ['kpi-approval-chain'] })
  qc.invalidateQueries({ queryKey: ['kpi-adjustments'] })
}

export function useReassignApprovalStep() {
  const { t } = useTranslation('kpi')
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { stepId: string; approverId: string; reason: string }) =>
      kpiApprovalApi.reassign(v.stepId, v.approverId, v.reason),
    onSuccess: () => {
      invalidateApprovalQueries(qc)
      toast.success(t('useKpiApprovalChain.approverReassigned'))
    },
    onError: (error) => toast.error(getApiErrorMessage(error, t('useKpiApprovalChain.failedToReassignApprover'))),
  })
}
