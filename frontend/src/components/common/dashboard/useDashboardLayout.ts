import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { dashboardLayoutApi, type DashboardLayoutItem, type LayoutScope } from '@/features/dashboard/api/dashboardLayoutApi'
import type { DashboardWidget } from './ChartWrapper'
import type { WidgetSettings } from './widgetSettings'
import { useAutosave } from './useAutosave'

interface Options {
  /** Khu vực lưới — quyết định bố cục nào được đọc/ghi ở backend. */
  scope: LayoutScope
  /** Preset mặc định khi người dùng chưa tuỳ chỉnh bao giờ. */
  defaultWidgets: DashboardWidget[]
  /**
   * Toàn bộ widget hợp lệ của khu vực này (đã lọc theo cờ tổ chức/quyền).
   * Dùng để dựng lại `type/title` và loại bỏ id lạ khi hydrate.
   */
  availableWidgets: DashboardWidget[]
  /**
   * Đọc bố cục từ kho CŨ, chỉ gọi khi kho mới chưa có gì.
   *
   * <p>Các tab Thống kê từng giấu bố cục trong một "report" đặt tên đặc biệt. Không có bước này
   * thì lần deploy đầu tiên sẽ ném hết bố cục người dùng đã dựng và trả họ về mặc định.
   */
  legacyLoad?: () => Promise<DashboardLayoutItem[] | null>
}

/**
 * Giữ lại đúng phần cần lưu — hình học, trạng thái hiện/ẩn và cấu hình riêng của ô. Không ghi
 * `title`/`type` vì hai thứ đó suy được từ catalog, mà catalog thì đổi theo bản deploy.
 */
const toLayoutItems = (widgets: DashboardWidget[], removedIds: string[]): DashboardLayoutItem[] => [
  ...widgets.map(w => ({
    i: w.i, x: w.x, y: w.y, w: w.w, h: w.h, visible: w.visible,
    ...(w.s && Object.keys(w.s).length > 0 ? { s: w.s } : {}),
  })),
  ...removedIds.map(i => ({ i, x: 0, y: 0, w: 0, h: 0, visible: false, removed: true })),
]

/**
 * State + logic cho lưới widget — dùng cho cả trang chủ lẫn các tab Thống kê.
 *
 * <p>Không còn "chế độ chỉnh sửa": kéo/dãn xong là lưu. Được như vậy vì lưới đặt
 * `draggableHandle`, nên chỉ cụm chấm mới khởi động kéo — bật kéo vĩnh viễn không cướp cú bấm nào
 * của biểu đồ. Nút "Lưu" biến mất theo, nên `saveConfig` chỉ còn là lệnh xả hàng đợi thủ công.
 */
export function useDashboardLayout({ scope, defaultWidgets, availableWidgets, legacyLoad }: Options) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultWidgets)
  /** Widget người dùng đã gỡ. Không hiện trên lưới nhưng vẫn phải lưu, xem `toLayoutItems`. */
  const [removedIds, setRemovedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  /** Ảnh chụp trước thao tác phá dữ liệu (Đặt lại / Áp preset) để bấm Hoàn tác lấy lại. */
  const undoSnapshot = useRef<{ widgets: DashboardWidget[]; removedIds: string[] } | null>(null)

  const persist = useCallback(async (next: DashboardWidget[], removed: string[]) => {
    await dashboardLayoutApi.save(scope, toLayoutItems(next, removed))
  }, [scope])

  const autosave = useAutosave<DashboardLayoutItem[]>({
    save: useCallback((items: DashboardLayoutItem[]) => dashboardLayoutApi.save(scope, items), [scope]),
  })

  /*
    Tự lưu bắt theo một BỘ ĐẾM thay đổi, không bắt trực tiếp `widgets`.

    react-grid-layout gọi `onLayoutChange` cả lúc mount và lúc đổi breakpoint; bám thẳng vào
    `widgets` thì chỉ mở trang thôi đã bắn một lần ghi. Mọi thao tác THẬT của người dùng gọi
    `markDirty()`, còn `handleLayoutChange` thì không — lưới tự gọi `commitLayout()` khi thả tay.
  */
  const widgetsRef = useRef(widgets)
  const removedRef = useRef(removedIds)
  widgetsRef.current = widgets
  removedRef.current = removedIds
  const [rev, setRev] = useState(0)
  const immediateRef = useRef(false)

  const markDirty = useCallback((immediate = false) => {
    immediateRef.current = immediate
    setRev(r => r + 1)
  }, [])

  useEffect(() => {
    if (rev === 0) return
    autosave.schedule(toLayoutItems(widgetsRef.current, removedRef.current), { immediate: immediateRef.current })
    // `autosave.schedule` ổn định theo `scope`; thêm nó vào deps sẽ bắn lại mỗi lần render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev])

  /**
   * Ghép bố cục đã lưu với catalog hiện tại:
   * - bỏ `i` không còn trong catalog (widget bị gỡ ở bản deploy mới, hoặc cờ tổ chức vừa tắt)
   * - chèn widget mặc định CHƯA TỪNG xuất hiện trong bố cục, để người dùng cũ vẫn nhận tính năng mới
   *
   * <p>Mấu chốt là "chưa từng xuất hiện", không phải "hiện không có mặt": widget người dùng
   * đã chủ động gỡ vẫn nằm trong bố cục lưu dưới dạng `removed`, nên không bị chèn lại.
   * Mảng rỗng cũng là một lựa chọn hợp lệ — người dùng có quyền dọn sạch trang chủ.
   */
  const hydrate = useCallback((saved: DashboardLayoutItem[]) => {
    const byId = new Map(availableWidgets.map(w => [w.i, w]))
    let merged: DashboardWidget[] = []

    saved.forEach(item => {
      if (item.removed) return
      const def = byId.get(item.i)
      if (!def) return
      merged.push({
        ...def,
        x: item.x, y: item.y, w: item.w, h: item.h,
        visible: item.visible !== false,
        ...(item.s ? { s: item.s } : {}),
      })
    })

    /*
      Widget mặc định MỚI được chèn đúng chỗ mà bố cục mặc định dành cho nó (`def.y`), đẩy các
      ô nằm từ đó trở xuống thấp hơn — KHÔNG thả xuống đáy lưới. Người dùng cũ có bố cục dài
      (biểu đồ xu hướng + bảng chi tiết cao hàng chục dòng) mà nhận tính năng mới ở tận cuối
      trang thì coi như không nhận: họ chẳng bao giờ cuộn tới đó.

      "Đã biết" = mọi id từng có mặt trong bố cục lưu, kể cả bản ghi đánh dấu đã gỡ.
    */
    const known = new Set(saved.map(item => item.i))
    defaultWidgets
      .filter(def => !known.has(def.i))
      .sort((a, b) => a.y - b.y)
      .forEach(def => {
        merged = merged.map(w => (w.y >= def.y ? { ...w, y: w.y + def.h } : w))
        merged.push({ ...def })
      })

    const removed = saved
      .filter(item => item.removed && byId.has(item.i))
      .map(item => item.i)

    return { widgets: merged, removedIds: removed }
  }, [availableWidgets, defaultWidgets])

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    const apply = (items: DashboardLayoutItem[]) => {
      try {
        const next = hydrate(items)
        setWidgets(next.widgets)
        setRemovedIds(next.removedIds)
      } catch {
        // Bố cục hỏng không được phép làm trắng trang
        console.error('Bố cục không đọc được, dùng mặc định')
        setWidgets(defaultWidgets)
      }
    }

    dashboardLayoutApi.get(scope)
      .then(async res => {
        if (cancelled) return
        // layout null = CHƯA TỪNG tuỳ chỉnh. Khác hẳn mảng rỗng, vốn là "đã dọn sạch có chủ đích".
        if (res?.layout) { apply(JSON.parse(res.layout) as DashboardLayoutItem[]); return }

        // Chưa có gì ở kho mới: thử vớt bố cục cũ đúng MỘT lần rồi ghi sang kho mới.
        if (legacyLoad) {
          try {
            const legacy = await legacyLoad()
            if (cancelled) return
            if (legacy && legacy.length > 0) {
              apply(legacy)
              // Ghi ngay để lần sau không phải hỏi lại kho cũ. Hỏng thì kệ — lần mở sau vớt lại.
              dashboardLayoutApi.save(scope, legacy).catch(() => undefined)
              return
            }
          } catch {
            // Không đọc được kho cũ (thiếu quyền chẳng hạn) thì rơi về mặc định, không văng.
          }
        }
        setWidgets(defaultWidgets)
        setRemovedIds([])
      })
      .catch(err => { if (!cancelled) { console.error('Không tải được bố cục', err); setWidgets(defaultWidgets) } })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
    // hydrate/defaultWidgets đổi theo catalog; chỉ nạp lại khi đổi khu vực lưới
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope])

  /** Xả hàng đợi tự lưu ngay. Giữ tên cũ vì `CustomizationApi` còn khai nó. */
  const saveConfig = async (): Promise<DashboardWidget[]> => {
    await autosave.flush()
    return widgets
  }

  /** Cập nhật cấu hình riêng của một ô; `patch` được trộn vào phần đang có. */
  const updateWidgetSettings = (i: string, patch: Partial<WidgetSettings>) => {
    setWidgets(prev => prev.map(w => (w.i === i ? { ...w, s: { ...w.s, ...patch } } : w)))
    markDirty()
  }

  const handleLayoutChange = (newLayout: { i: string; x: number; y: number; w: number; h: number }[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }

  /** Người dùng vừa thả tay sau khi kéo hoặc dãn — giờ mới đáng lưu. */
  const commitLayout = () => markDirty()

  const deleteWidget = (i: string) => {
    setWidgets(prev => prev.filter(w => w.i !== i))
    // Ghi nhận là đã gỡ để lần nạp sau không tự chèn lại
    setRemovedIds(prev => (prev.includes(i) ? prev : [...prev, i]))
    markDirty(true)
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
      // Widget ĐÃ có trong bố cục nhưng đang ẩn (nhiều widget mặc định ẩn) thì bật lại, chứ
      // không bỏ qua: bỏ qua thì bấm thẻ trong thư viện không có phản ứng gì.
      if (prev.some(w => w.i === template.i)) {
        return prev.map(w => (w.i === template.i ? { ...w, visible: true } : w))
      }
      const maxY = prev.length > 0 ? Math.max(...prev.map(w => w.y + w.h)) : 0
      return [...prev, { ...template, y: maxY, visible: true }]
    })
    setRemovedIds(prev => prev.filter(id => id !== template.i))
    markDirty(true)
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
            .catch((err) => toast.error(getApiErrorMessage(err, 'Không thể khôi phục bố cục')))
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
      toast.error(getApiErrorMessage(err, 'Không thể đặt lại bố cục'))
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
      toast.error(getApiErrorMessage(err, 'Không thể áp dụng bố cục'))
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
    markDirty()
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
    markDirty()
  }

  // Bố cục theo breakpoint: lg/md giữ vị trí tuỳ chỉnh; sm/xs/xxs xếp chồng full-width.
  const visibleWidgets = widgets.filter(b => b.visible)
  const orderedVisible = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x)
  const stackFull = (cols: number) => orderedVisible.map((w, i) => ({ i: w.i, x: 0, y: i, w: cols, h: w.h }))
  // Chỉ đưa HÌNH HỌC vào lưới. Đưa cả object widget (kèm `s`, `title`…) thì mỗi lần sửa cài đặt
  // trong bảng cấu hình, `deepEqual` của react-grid-layout thấy khác → đồng bộ lại toàn lưới dù
  // không ô nào đổi chỗ — phí CPU đúng lúc đang cần khung hình mượt.
  const geometry = visibleWidgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h }))
  const gridLayouts = {
    lg: geometry, md: geometry,
    sm: stackFull(12), xs: stackFull(6), xxs: stackFull(4),
  }

  return {
    widgets, setWidgets, isLoading,
    isAddModalOpen, setIsAddModalOpen,
    gridLayouts,
    saveConfig, addWidget, deleteWidget, resetLayout, handleLayoutChange,
    applyPreset, moveWidget, cycleWidth,
    commitLayout, updateWidgetSettings, saveStatus: autosave.status, retrySave: autosave.retry,
  }
}
