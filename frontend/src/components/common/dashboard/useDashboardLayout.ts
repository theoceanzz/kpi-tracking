import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { dashboardLayoutApi, type DashboardLayoutItem, type DashboardScope } from '@/features/dashboard/api/dashboardLayoutApi'
import type { DashboardWidget } from './ChartWrapper'

interface Options {
  /** Vai trò — quyết định bố cục nào được đọc/ghi ở backend. */
  scope: DashboardScope
  /** Preset mặc định khi người dùng chưa tuỳ chỉnh bao giờ. */
  defaultWidgets: DashboardWidget[]
  /**
   * Toàn bộ widget hợp lệ của vai trò này (đã lọc theo cờ tổ chức/quyền).
   * Dùng để dựng lại `type/title` và loại bỏ id lạ khi hydrate.
   */
  availableWidgets: DashboardWidget[]
}

/**
 * Giữ lại đúng phần hình học cần lưu — tránh ghi cả title/type vốn suy được từ catalog.
 * Kèm theo dấu vết những widget đã bị gỡ, để lần nạp sau không chèn chúng trở lại.
 */
const toLayoutItems = (widgets: DashboardWidget[], removedIds: string[]): DashboardLayoutItem[] => [
  ...widgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, visible: w.visible })),
  ...removedIds.map(i => ({ i, x: 0, y: 0, w: 0, h: 0, visible: false, removed: true })),
]

/**
 * State + logic cho lưới widget của TRANG CHỦ. Giữ nguyên bề mặt API của
 * `useDashboardCustomization` để dùng lại `DashboardCustomizeChrome` không phải sửa chữ ký,
 * nhưng lưu vào bảng `user_dashboard_layouts` thay vì "config report" ẩn.
 */
export function useDashboardLayout({ scope, defaultWidgets, availableWidgets }: Options) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultWidgets)
  /** Widget người dùng đã gỡ. Không hiện trên lưới nhưng vẫn phải lưu, xem `toLayoutItems`. */
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** Ảnh chụp trước thao tác phá dữ liệu (Đặt lại / Áp preset) để bấm Hoàn tác lấy lại. */
  const undoSnapshot = useRef<{ widgets: DashboardWidget[]; removedIds: string[] } | null>(null)

  /**
   * Ghép bố cục đã lưu với catalog hiện tại:
   * - bỏ `i` không còn trong catalog (widget bị gỡ ở bản deploy mới, hoặc cờ tổ chức vừa tắt)
   * - nối widget mặc định CHƯA TỪNG xuất hiện trong bố cục, để người dùng cũ vẫn nhận tính năng mới
   *
   * <p>Mấu chốt là "chưa từng xuất hiện", không phải "hiện không có mặt": widget người dùng
   * đã chủ động gỡ vẫn nằm trong bố cục lưu dưới dạng `removed`, nên không bị chèn lại.
   * Mảng rỗng cũng là một lựa chọn hợp lệ — người dùng có quyền dọn sạch trang chủ.
   */
  const hydrate = useCallback((saved: DashboardLayoutItem[]) => {
    const byId = new Map(availableWidgets.map(w => [w.i, w]))
    const merged: DashboardWidget[] = []

    saved.forEach(item => {
      if (item.removed) return
      const def = byId.get(item.i)
      if (!def) return
      merged.push({ ...def, x: item.x, y: item.y, w: item.w, h: item.h, visible: item.visible !== false })
    })

    // Đã biết = mọi id từng có mặt trong bố cục lưu, kể cả bản ghi đánh dấu đã gỡ
    const known = new Set(saved.map(item => item.i))
    defaultWidgets.forEach(def => {
      if (known.has(def.i)) return
      const maxY = merged.length ? Math.max(...merged.map(w => w.y + w.h)) : 0
      merged.push({ ...def, y: maxY })
    })

    const removed = saved
      .filter(item => item.removed && byId.has(item.i))
      .map(item => item.i)

    return { widgets: merged, removedIds: removed }
  }, [availableWidgets, defaultWidgets])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    dashboardLayoutApi.get(scope)
      .then(res => {
        if (cancelled) return
        // layout null = CHƯA TỪNG tuỳ chỉnh. Khác hẳn mảng rỗng, vốn là "đã dọn sạch có chủ đích".
        if (!res?.layout) { setWidgets(defaultWidgets); setRemovedIds([]); return }
        try {
          const next = hydrate(JSON.parse(res.layout) as DashboardLayoutItem[])
          setWidgets(next.widgets)
          setRemovedIds(next.removedIds)
        } catch {
          // Bố cục hỏng không được phép làm trắng trang chủ
          console.error('Bố cục trang chủ không đọc được, dùng mặc định')
          setWidgets(defaultWidgets)
        }
      })
      .catch(err => { if (!cancelled) { console.error('Không tải được bố cục trang chủ', err); setWidgets(defaultWidgets) } })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
    // hydrate/defaultWidgets đổi theo catalog; chỉ nạp lại khi đổi vai trò
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  const persist = useCallback(async (next: DashboardWidget[], removed: string[]) => {
    await dashboardLayoutApi.save(scope, toLayoutItems(next, removed))
  }, [scope])

  const saveConfig = async (): Promise<DashboardWidget[]> => {
    try {
      await persist(widgets, removedIds)
      setIsEditMode(false)
      toast.success('Đã lưu bố cục trang chủ')
      return widgets
    } catch (err) {
      console.error(err)
      toast.error('Không thể lưu bố cục')
      throw err
    }
  }

  const toggleVisibility = (id: string) =>
    setWidgets(prev => prev.map(b => (b.i === id ? { ...b, visible: !b.visible } : b)))

  const handleLayoutChange = (newLayout: { i: string; x: number; y: number; w: number; h: number }[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }

  const deleteWidget = (i: string) => {
    setWidgets(prev => prev.filter(w => w.i !== i))
    // Ghi nhận là đã gỡ để lần nạp sau không tự chèn lại
    setRemovedIds(prev => (prev.includes(i) ? prev : [...prev, i]))
  }

  /**
   * Thêm một widget vào cuối lưới. KHÔNG đóng thư viện: người dùng thường chọn vài cái một
   * lượt, đóng sau mỗi lần thêm bắt họ mở lại từ đầu.
   *
   * <p>Chặn trùng và tính `y` đều làm bên trong hàm cập nhật state, không đọc `widgets` từ
   * closure — bấm nhanh nhiều thẻ liên tiếp sẽ gộp chung một lần render, đọc closure thì mọi
   * widget nhận cùng một `y` và chồng lên nhau.
   */
  const addWidget = (template: DashboardWidget) => {
    setWidgets(prev => {
      if (prev.some(w => w.i === template.i)) return prev
      const maxY = prev.length > 0 ? Math.max(...prev.map(w => w.y + w.h)) : 0
      return [...prev, { ...template, y: maxY, visible: true }]
    })
    setRemovedIds(prev => prev.filter(id => id !== template.i))
  }

  /** Toast kèm nút Hoàn tác — cứu thao tác lỡ tay mà không cần lưu lịch sử ở server. */
  const offerUndo = (message: string, snapshot: { widgets: DashboardWidget[]; removedIds: string[] }) => {
    undoSnapshot.current = snapshot
    toast.success(message, {
      duration: 10000,
      action: {
        label: 'Hoàn tác',
        onClick: () => {
          const restore = undoSnapshot.current
          if (!restore) return
          setWidgets(restore.widgets)
          setRemovedIds(restore.removedIds)
          persist(restore.widgets, restore.removedIds)
            .then(() => toast.success('Đã khôi phục bố cục trước đó'))
            .catch(() => toast.error('Không thể khôi phục bố cục'))
          undoSnapshot.current = null
        },
      },
    })
  }

  /** Xoá hẳn bố cục đã lưu ở server rồi rơi về preset. Nút xác nhận do Chrome hiển thị. */
  const resetLayout = async () => {
    const snapshot = { widgets, removedIds }
    setWidgets(defaultWidgets)
    // Đặt lại nghĩa là quay về đúng mặc định, nên xoá luôn mọi dấu "đã gỡ"
    setRemovedIds([])
    try {
      await dashboardLayoutApi.reset(scope)
      offerUndo('Đã đặt lại bố cục mặc định', snapshot)
    } catch (err) {
      console.error(err)
      setWidgets(snapshot.widgets)
      setRemovedIds(snapshot.removedIds)
      toast.error('Không thể đặt lại bố cục')
    }
  }

  /** Áp một bố cục gợi ý, ghi đè bố cục hiện tại. Nút xác nhận do Chrome hiển thị. */
  const applyPreset = async (preset: DashboardWidget[]) => {
    const snapshot = { widgets, removedIds }
    /*
      Preset là "chỉ những cái này": widget mặc định không nằm trong preset phải được đánh dấu
      đã gỡ, nếu không lần nạp sau `hydrate` sẽ chèn chúng trở lại và preset coi như vô tác dụng.
    */
    const presetIds = new Set(preset.map(w => w.i))
    const nextRemoved = defaultWidgets.filter(d => !presetIds.has(d.i)).map(d => d.i)

    setWidgets(preset)
    setRemovedIds(nextRemoved)
    try {
      await persist(preset, nextRemoved)
      offerUndo('Đã áp dụng bố cục gợi ý', snapshot)
    } catch (err) {
      console.error(err)
      setWidgets(snapshot.widgets)
      setRemovedIds(snapshot.removedIds)
      toast.error('Không thể áp dụng bố cục')
    }
  }

  /** Sắp xếp bằng bàn phím/chạm — bắt buộc theo WCAG 2.2 vì kéo-thả không được là cách duy nhất. */
  const moveWidget = (i: string, direction: 'up' | 'down') => {
    setWidgets(prev => {
      const visible = prev.filter(w => w.visible).sort((a, b) => a.y - b.y || a.x - b.x)
      const idx = visible.findIndex(w => w.i === i)
      const swapWith = direction === 'up' ? idx - 1 : idx + 1
      if (idx === -1 || swapWith < 0 || swapWith >= visible.length) return prev

      const a = visible[idx]
      const b = visible[swapWith]
      if (!a || !b) return prev
      return prev.map(w => {
        if (w.i === a.i) return { ...w, x: b.x, y: b.y }
        if (w.i === b.i) return { ...w, x: a.x, y: a.y }
        return w
      })
    })
  }

  /** Đổi bề rộng theo vòng 4 → 6 → 8 → 12 → 4, thay cho việc phải kéo cạnh widget. */
  const cycleWidth = (i: string) => {
    const steps = [4, 6, 8, 12] as const
    setWidgets(prev => prev.map(w => {
      if (w.i !== i) return w
      const currentIdx = steps.findIndex(s => s >= w.w)
      const next = steps[(currentIdx + 1) % steps.length] ?? 4
      return { ...w, w: next, x: Math.min(w.x, 12 - next) }
    }))
  }

  // Bố cục theo breakpoint: lg/md giữ vị trí tuỳ chỉnh; sm/xs/xxs xếp chồng full-width.
  const visibleWidgets = widgets.filter(b => b.visible)
  const orderedVisible = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x)
  const stackFull = (cols: number) => orderedVisible.map((w, i) => ({ i: w.i, x: 0, y: i, w: cols, h: w.h }))
  const gridLayouts = {
    lg: visibleWidgets, md: visibleWidgets,
    sm: stackFull(12), xs: stackFull(6), xxs: stackFull(4),
  }

  return {
    widgets, setWidgets, isLoading,
    isEditMode, setIsEditMode,
    isConfigOpen, setIsConfigOpen,
    isAddModalOpen, setIsAddModalOpen,
    gridLayouts,
    saveConfig, addWidget, deleteWidget, toggleVisibility, resetLayout, handleLayoutChange,
    applyPreset, moveWidget, cycleWidth,
  }
}
