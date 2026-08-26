import { useCallback, useState } from 'react'

/** Bỏ giá trị rỗng và trùng, để danh sách khoá mở mặc định luôn sạch. */
const toKeySet = (defaultOpen?: string | null | (string | null | undefined)[]) => {
  const list = Array.isArray(defaultOpen) ? defaultOpen : [defaultOpen]
  return new Set<string>(list.filter((k): k is string => !!k))
}

/**
 * Trạng thái sổ/đóng của các nhóm (đơn vị hoặc người) trong danh sách lấy con người làm trung tâm.
 *
 * <p>Lưu tập các nhóm ĐANG MỞ (chứ không phải đang đóng) vì mặc định mọi nhóm đều đóng,
 * chỉ nhóm của chính người đang đăng nhập mở sẵn — cách này giữ đúng mặc định đó ngay cả
 * khi danh sách nhóm thay đổi lúc đổi bộ lọc.
 *
 * <p>Nhận được nhiều khoá mặc định vì nhóm người được đánh khoá kèm đơn vị khi hiển thị
 * ba cấp, nhưng chỉ bằng id người khi rơi về hai cấp.
 */
export function usePersonGroupCollapse(defaultOpen?: string | null | (string | null | undefined)[]) {
  const [expanded, setExpanded] = useState<Set<string>>(() => toKeySet(defaultOpen))

  const isExpanded = useCallback((id: string) => expanded.has(id), [expanded])

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const expandAll = useCallback((ids: string[]) => setExpanded(new Set(ids)), [])
  const collapseAll = useCallback(() => setExpanded(new Set<string>()), [])
  /** Gọi khi đổi đợt / tab để quay về mặc định "chỉ mở nhóm của mình". */
  const reset = useCallback(() => setExpanded(toKeySet(defaultOpen)), [defaultOpen])

  return { expanded, isExpanded, toggle, expandAll, collapseAll, reset }
}
