import { useCallback } from 'react'
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
  const { stageForPath, isEnabled } = useKpiWorkflow()

  return useCallback(
    (paths?: (string | undefined)[]) => {
      const known = (paths ?? []).filter(Boolean) as string[]
      if (known.length === 0) return true
      // Chỉ ẩn khi MỌI đường dẫn của mục đều thuộc một bước đang tắt. Mục không khớp bước nào
      // thì `stageForPath` trả undefined và mục đó giữ nguyên.
      return known.some(p => {
        const stage = stageForPath(p)
        if (!stage) return true
        return isEnabled(stage.code)
      })
    },
    [stageForPath, isEnabled],
  )
}

export default useStageVisible
