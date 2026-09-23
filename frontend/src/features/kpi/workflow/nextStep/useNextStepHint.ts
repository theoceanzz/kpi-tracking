import { createElement, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useHasPermission } from '@/components/auth/PermissionGate'
import { useKpiWorkflow } from '../hooks/useKpiWorkflow'
import { useWorkflowNavigator } from '../hooks/useWorkflowNavigator'
import NextStepToast from './NextStepToast'
import { resolveNextStepHint, type NextStepEvent } from './nextStepHints'

/**
 * Một hộp duy nhất cho cả app: thao tác liên tiếp (tạo ba chỉ tiêu liền tay) chỉ LÀM MỚI hộp
 * đang có chứ không xếp chồng ba hộp.
 */
const TOAST_ID = 'workflow-next-step'
const DURATION_MS = 8000

/**
 * `suggestNextStep(event)` — gợi ý bước tiếp theo sau một thao tác, nếu có việc cho chính người này.
 *
 * Gom đủ bối cảnh (người đang đăng nhập, quyền, cấu hình luồng, cách dựng URL) rồi giao cho
 * `resolveNextStepHint` quyết định. Trả về `null` thì im lặng — đó là kết quả bình thường với
 * nhân viên vừa tạo bản nháp hay sếp vừa giao chỉ tiêu cho người khác, không phải lỗi.
 *
 * Trang gọi tới quyết định CÓ gợi ý hay không, không phải form: `KpiFormModal` chỉ phát
 * `onCreated`, còn wizard cố ý không nối vì bước tiếp theo đã nằm ngay trong wizard.
 */
export function useNextStepHint() {
  const navigate = useNavigate()
  const userId = useAuthStore(s => s.user?.id)
  const { hasPermission } = useHasPermission()
  const { isEnabled, byCode } = useKpiWorkflow()
  const { buildUrl } = useWorkflowNavigator()

  return useCallback(
    (event: NextStepEvent) => {
      const hint = resolveNextStepHint(event, { userId, hasPermission, isEnabled, byCode, buildUrl })
      if (!hint) return

      toast.custom(
        id =>
          createElement(NextStepToast, {
            hint,
            durationMs: DURATION_MS,
            onDismiss: () => toast.dismiss(id),
            onGo: () => {
              toast.dismiss(id)
              navigate(hint.to)
            },
          }),
        {
          id: TOAST_ID,
          duration: DURATION_MS,
          // Góc dưới-phải riêng cho hộp này; thông báo thường của app vẫn ở giữa trên.
          position: 'bottom-right',
          // Sonner tự vẽ nút đóng ở góc; hộp đã có nút riêng đúng phong cách của mình.
          closeButton: false,
        },
      )
    },
    [userId, hasPermission, isEnabled, byCode, buildUrl, navigate],
  )
}
