import { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface TabDef<K extends string> {
  key: K
  label: string
  icon: LucideIcon
  /** Ẩn tab khi tổ chức tắt tính năng hoặc người dùng thiếu quyền. Mặc định hiện. */
  visible?: boolean
  /** Số việc đang chờ, hiện ngay trên tab. Bỏ qua khi bằng 0 hoặc không truyền. */
  badge?: number
}

/**
 * Tab của trang lưu trong query string, nhờ đó tab bookmark được, reload không mất
 * và sidebar có thể trỏ thẳng vào một tab.
 *
 * URL là nguồn sự thật duy nhất — không giữ bản sao trong state, tránh lệch khi
 * người dùng bấm back/forward. Ghi bằng functional update để không xoá các query
 * param khác của trang (ví dụ ?unitId= hay ?periodId=), và `replace` để mỗi lần
 * đổi tab không đẩy thêm một mục vào lịch sử trình duyệt.
 */
export function useTabParam<K extends string>(
  tabs: TabDef<K>[],
  options: { param?: string; fallback?: K } = {}
) {
  const { param = 'tab', fallback } = options
  const [searchParams, setSearchParams] = useSearchParams()

  const visibleTabs = useMemo(() => tabs.filter(t => t.visible !== false), [tabs])
  const fromUrl = searchParams.get(param) as K | null
  const isValid = fromUrl != null && visibleTabs.some(t => t.key === fromUrl)
  const activeTab = (isValid ? fromUrl : (fallback ?? visibleTabs[0]?.key)) as K

  const setActiveTab = (key: K) => {
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.set(param, key)
      return p
    }, { replace: true })
  }

  // Tab trong URL không hợp lệ (link cũ, hoặc tab vừa bị tắt bởi cờ tính năng) thì
  // ghi lại URL cho khớp tab đang thực sự hiển thị.
  useEffect(() => {
    if (fromUrl != null && !isValid && visibleTabs.length > 0) {
      setSearchParams(prev => {
        const p = new URLSearchParams(prev)
        p.set(param, activeTab)
        return p
      }, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromUrl, isValid, activeTab, visibleTabs.length])

  return { activeTab, setActiveTab, visibleTabs }
}
