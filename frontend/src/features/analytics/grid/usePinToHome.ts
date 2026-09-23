import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { dashboardLayoutApi, type DashboardLayoutItem } from '@/features/dashboard/api/dashboardLayoutApi'
import { useHomeDashboardScope } from '@/features/dashboard/hooks/useHomeDashboardScope'
import { ANALYTICS_WIDGET_IDS } from '@/features/dashboard/widgets/analyticsCatalog'
import type { DashboardWidget } from '@/components/common/dashboard/ChartWrapper'

/** Id ô ở tab và ở danh mục trang chủ trùng nhau; hàm này chỉ còn là chỗ để ánh xạ nếu sau này lệch. */
const homeIdOf = (i: string) => i

const parseLayout = (raw?: string | null): DashboardLayoutItem[] => {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed as DashboardLayoutItem[] : []
  } catch {
    return []
  }
}

/**
 * "Ghim tổng quan" = đưa biểu đồ vào lưới trang chủ của chính người dùng.
 *
 * <p>Trước đây việc ghim ghi vào `report_widgets.is_pinned`, nhưng bố cục các tab Thống kê không
 * còn lưu dưới dạng report nữa nên cũng không còn dòng widget nào để đánh dấu. Ghim thẳng vào
 * lưới trang chủ vừa đúng nghĩa người dùng mong đợi, vừa bỏ được một hệ thống song song.
 */
export function usePinToHome() {
  const scope = useHomeDashboardScope()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['dashboard-layout', scope],
    queryFn: () => dashboardLayoutApi.get(scope!),
    enabled: !!scope,
    staleTime: 30_000,
  })

  // Memo hoá vì cả hai callback bên dưới nhận chúng làm phụ thuộc; không memo thì mỗi lần render
  // sinh mảng/Set mới và callback đổi định danh theo.
  const items = useMemo(() => parseLayout(data?.layout), [data?.layout])
  const pinnedIds = useMemo(
    () => new Set(items.filter(it => !it.removed && it.visible !== false).map(it => it.i)),
    [items]
  )

  const mutation = useMutation({
    mutationFn: async (next: DashboardLayoutItem[]) => dashboardLayoutApi.save(scope!, next),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ['dashboard-layout', scope] }) },
  })

  const isPinned = useCallback((w: DashboardWidget) => pinnedIds.has(homeIdOf(w.i)), [pinnedIds])

  const toggle = useCallback(async (w: DashboardWidget) => {
    if (!scope) return
    const id = homeIdOf(w.i)
    if (!ANALYTICS_WIDGET_IDS.has(id)) {
      // Nói thẳng thay vì ghim rồi để nó biến mất im lặng ở trang chủ.
      toast.error('Biểu đồ này chưa có bản dùng được ở trang tổng quan.')
      return
    }

    const already = pinnedIds.has(id)
    const rest = items.filter(it => it.i !== id)
    const next: DashboardLayoutItem[] = already
      // Gỡ ghim = đánh dấu đã gỡ, không phải xoá khỏi mảng: mất dấu vết thì lần nạp sau
      // trang chủ lại tự chèn nó về nếu nó nằm trong bố cục mặc định.
      ? [...rest, { i: id, x: 0, y: 0, w: 0, h: 0, visible: false, removed: true }]
      : [...rest, { i: id, x: 0, y: maxY(items), w: w.w, h: w.h, visible: true }]

    try {
      await mutation.mutateAsync(next)
      toast.success(already ? 'Đã bỏ ghim khỏi trang tổng quan' : 'Đã ghim vào trang tổng quan')
    } catch {
      toast.error('Không thể cập nhật trang tổng quan')
    }
  }, [scope, items, pinnedIds, mutation])

  return { enabled: !!scope, isPinned, toggle }
}

/** Ghim thì thả xuống cuối lưới — chèn vào giữa là xê dịch thứ tự người dùng đã tự sắp. */
const maxY = (items: DashboardLayoutItem[]) =>
  items.filter(it => !it.removed).reduce((m, it) => Math.max(m, it.y + it.h), 0)
