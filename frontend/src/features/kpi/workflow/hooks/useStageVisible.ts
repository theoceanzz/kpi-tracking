import { useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useWorkflowPrefsStore } from '@/store/workflowPrefsStore'
import { useKpiWorkflow } from './useKpiWorkflow'

/**
 * Một mục điều hướng có được hiện không, xét theo cấu hình luồng KPI.
 *
 * <p>Cùng một cấu hình điều khiển cả nghiệp vụ lẫn điều hướng, nên không xảy ra cảnh menu vẫn
 * dẫn tới một trang mà backend đã từ chối phục vụ. Đường dẫn không thuộc luồng KPI thì không bị
 * ảnh hưởng, và khi cấu hình chưa tải xong thì mặc định là BẬT để menu không chớp mất lúc đầu.
 *
 * <p>Nhận NHIỀU đường dẫn vì sau khi các trang gộp lại, mỗi mục trong trang không còn route
 * riêng — nó mang route cũ của mình trong `legacyKeys`. Đó chính là thứ khớp với route mà
 * `StageRegistry` đăng ký cho từng bước.
 */
export function useStageVisible() {
  const { user } = useAuthStore()
  const { stageForPath, isEnabled } = useKpiWorkflow()
  const isHiddenByMe = useWorkflowPrefsStore(s => s.isHidden)

  return useCallback(
    (paths?: (string | undefined)[]) => {
      const known = (paths ?? []).filter(Boolean) as string[]
      if (known.length === 0) return true
      // Chỉ ẩn khi MỌI đường dẫn của mục đều thuộc một bước đang tắt. Mục không khớp bước nào
      // thì `stageForPath` trả undefined và mục đó giữ nguyên.
      return known.some(p => {
        const stage = stageForPath(p)
        if (!stage) return true
        // Hai tầng lọc khác hẳn nhau: tổ chức TẮT bước (luật nghiệp vụ, backend cưỡng chế) hoặc
        // chính người dùng ẨN bước khỏi màn hình của họ (thuần hiển thị, sửa ở mục Thiết lập luồng xử lí).
        return isEnabled(stage.code) && !isHiddenByMe(user?.id, stage.code)
      })
    },
    [stageForPath, isEnabled, isHiddenByMe, user?.id],
  )
}

export default useStageVisible
