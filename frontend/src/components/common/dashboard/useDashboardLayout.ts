import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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

/** Khoá cache của bố cục một khu vực. Dùng chung để `setQueryData` sau khi ghi. */
export const layoutQueryKey = (scope: LayoutScope) => ['dashboard-layout', scope] as const

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
 *
 * <p>Mọi hàm trả ra đều GIỮ ĐỊNH DANH qua các lần render (đọc state qua ref hoặc hàm cập nhật).
 * Lưới cache phần tử của từng ô theo định danh các hàm này; hàm đổi mỗi render là mọi ô vẽ lại
 * mỗi lần bấm một nút bất kỳ.
 */
export function useDashboardLayout({ scope, defaultWidgets, availableWidgets, legacyLoad }: Options) {
  const queryClient = useQueryClient()
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)

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

  /*
    Bố cục đi qua React Query thay vì `useEffect` + gọi API tay.

    Ba cái lợi đo được: (1) StrictMode của bản dev gắn effect hai lần → trước đây mỗi lần mở tab
    là hai request `dashboard/layout`; (2) quay lại tab trong 5 phút thì lấy từ cache, lưới hiện
    đúng bố cục đã lưu ngay khung hình đầu — không còn cảnh vẽ mặc định rồi nhảy sang bố cục lưu;
    (3) `isLoading` không còn tự quản.

    `null` = chưa từng tuỳ chỉnh (kể cả kho cũ) → dùng preset mặc định.
  */
  const layoutQuery = useQuery({
    queryKey: layoutQueryKey(scope),
    queryFn: async (): Promise<DashboardLayoutItem[] | null> => {
      const res = await dashboardLayoutApi.get(scope)
      // layout null = CHƯA TỪNG tuỳ chỉnh. Khác hẳn mảng rỗng, vốn là "đã dọn sạch có chủ đích".
      if (res?.layout) return JSON.parse(res.layout) as DashboardLayoutItem[]

      // Chưa có gì ở kho mới: thử vớt bố cục cũ đúng MỘT lần rồi ghi sang kho mới.
      if (legacyLoad) {
        try {
          const legacy = await legacyLoad()
          if (legacy && legacy.length > 0) {
            // Ghi ngay để lần sau không phải hỏi lại kho cũ. Hỏng thì kệ — lần mở sau vớt lại.
            dashboardLayoutApi.save(scope, legacy).catch(() => undefined)
            return legacy
          }
        } catch {
          // Không đọc được kho cũ (thiếu quyền chẳng hạn) thì rơi về mặc định, không văng.
        }
      }
      return null
    },
    staleTime: 5 * 60 * 1000,
  })

  const applySaved = useCallback((saved: DashboardLayoutItem[] | null | undefined) => {
    if (saved == null) return { widgets: defaultWidgets, removedIds: [] as string[] }
    try {
      return hydrate(saved)
    } catch {
      // Bố cục hỏng không được phép làm trắng trang
      console.error('Bố cục không đọc được, dùng mặc định')
      return { widgets: defaultWidgets, removedIds: [] as string[] }
    }
  }, [defaultWidgets, hydrate])

  // Có sẵn trong cache (quay lại tab) thì dựng đúng bố cục ngay từ render đầu.
  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => applySaved(layoutQuery.data).widgets)
  /** Widget người dùng đã gỡ. Không hiện trên lưới nhưng vẫn phải lưu, xem `toLayoutItems`. */
  const [removedIds, setRemovedIds] = useState<string[]>(() => applySaved(layoutQuery.data).removedIds)

  // Dữ liệu về sau render đầu (lần đầu mở tab, hoặc đổi khu vực lưới): áp trước khi vẽ, để
  // không có khung hình nào hiện bố cục mặc định rồi mới nhảy.
  const appliedFor = useRef<{ scope: LayoutScope; data: unknown } | null>(
    layoutQuery.data !== undefined ? { scope, data: layoutQuery.data } : null,
  )
  useLayoutEffect(() => {
    if (layoutQuery.data === undefined) return
    if (appliedFor.current?.scope === scope && appliedFor.current.data === layoutQuery.data) return
    appliedFor.current = { scope, data: layoutQuery.data }
    const next = applySaved(layoutQuery.data)
    setWidgets(next.widgets)
    setRemovedIds(next.removedIds)
    // `applySaved` đổi theo catalog; chỉ áp lại khi dữ liệu hoặc khu vực đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, layoutQuery.data])

  useEffect(() => {
    if (layoutQuery.error) console.error('Không tải được bố cục', layoutQuery.error)
  }, [layoutQuery.error])

  const isLoading = layoutQuery.isPending

  /** Ảnh chụp trước thao tác phá dữ liệu (Đặt lại / Áp preset) để bấm Hoàn tác lấy lại. */
  const undoSnapshot = useRef<{ widgets: DashboardWidget[]; removedIds: string[] } | null>(null)

  /*
    Sau khi ghi, cache phải theo kịp bản đã ghi (quay lại tab trong 5 phút là đọc cache), nhưng
    KHÔNG được nạp ngược vào state: người dùng có thể đã kéo tiếp trong lúc request bay. Đánh dấu
    `appliedFor` để effect áp bố cục ở trên bỏ qua đúng bản này.
  */
  const rememberSaved = useCallback((items: DashboardLayoutItem[] | null) => {
    appliedFor.current = { scope, data: items }
    queryClient.setQueryData(layoutQueryKey(scope), items)
  }, [scope, queryClient])

  const persist = useCallback(async (next: DashboardWidget[], removed: string[]) => {
    const items = toLayoutItems(next, removed)
    await dashboardLayoutApi.save(scope, items)
    rememberSaved(items)
  }, [scope, rememberSaved])

  const autosave = useAutosave<DashboardLayoutItem[]>({
    save: useCallback(async (items: DashboardLayoutItem[]) => {
      await dashboardLayoutApi.save(scope, items)
      rememberSaved(items)
    }, [scope, rememberSaved]),
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

  /** Xả hàng đợi tự lưu ngay. Giữ tên cũ vì `CustomizationApi` còn khai nó. */
  const flush = autosave.flush
  const saveConfig = useCallback(async (): Promise<DashboardWidget[]> => {
    await flush()
    return widgetsRef.current
  }, [flush])

  /** Cập nhật cấu hình riêng của một ô; `patch` được trộn vào phần đang có. */
  const updateWidgetSettings = useCallback((i: string, patch: Partial<WidgetSettings>) => {
    setWidgets(prev => prev.map(w => (w.i === i ? { ...w, s: { ...w.s, ...patch } } : w)))
    markDirty()
  }, [markDirty])

  /*
    Lưới báo bố cục mới cả lúc mount và lúc đổi bề rộng dù không ô nào đổi chỗ. Trả về ĐÚNG mảng
    cũ khi hình học không đổi, và giữ nguyên object của ô không đổi — mỗi object mới là một ô
    vẽ lại toàn bộ biểu đồ bên trong.
  */
  const handleLayoutChange = useCallback((newLayout: { i: string; x: number; y: number; w: number; h: number }[]) => {
    setWidgets(prev => {
      let changed = false
      const next = prev.map(item => {
        const u = newLayout.find(l => l.i === item.i)
        if (!u || (u.x === item.x && u.y === item.y && u.w === item.w && u.h === item.h)) return item
        changed = true
        return { ...item, x: u.x, y: u.y, w: u.w, h: u.h }
      })
      return changed ? next : prev
    })
  }, [])

  /** Người dùng vừa thả tay sau khi kéo hoặc dãn — giờ mới đáng lưu. */
  const commitLayout = useCallback(() => markDirty(), [markDirty])

  const deleteWidget = useCallback((i: string) => {
    setWidgets(prev => prev.filter(w => w.i !== i))
    // Ghi nhận là đã gỡ để lần nạp sau không tự chèn lại
    setRemovedIds(prev => (prev.includes(i) ? prev : [...prev, i]))
    markDirty(true)
  }, [markDirty])

  /**
   * Thêm một widget vào cuối lưới. KHÔNG đóng thư viện: người dùng thường chọn vài cái một
   * lượt, đóng sau mỗi lần thêm bắt họ mở lại từ đầu.
   *
   * <p>Chặn trùng và tính `y` đều làm bên trong hàm cập nhật state, không đọc `widgets` từ
   * closure — bấm nhanh nhiều thẻ liên tiếp sẽ gộp chung một lần render, đọc closure thì mọi
   * widget nhận cùng một `y` và chồng lên nhau.
   */
  const addWidget = useCallback((template: DashboardWidget) => {
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
  }, [markDirty])

  /** Toast kèm nút Hoàn tác — cứu thao tác lỡ tay mà không cần lưu lịch sử ở server. */
  const offerUndo = useCallback((message: string, snapshot: { widgets: DashboardWidget[]; removedIds: string[] }) => {
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
  }, [persist])

  /** Xoá hẳn bố cục đã lưu ở server rồi rơi về preset. Nút xác nhận do Chrome hiển thị. */
  const resetLayout = useCallback(async () => {
    const snapshot = { widgets: widgetsRef.current, removedIds: removedRef.current }
    setWidgets(defaultWidgets)
    // Đặt lại nghĩa là quay về đúng mặc định, nên xoá luôn mọi dấu "đã gỡ"
    setRemovedIds([])
    try {
      await dashboardLayoutApi.reset(scope)
      rememberSaved(null)
      offerUndo('Đã đặt lại bố cục mặc định', snapshot)
    } catch (err) {
      console.error(err)
      setWidgets(snapshot.widgets)
      setRemovedIds(snapshot.removedIds)
      toast.error(getApiErrorMessage(err, 'Không thể đặt lại bố cục'))
    }
  }, [defaultWidgets, offerUndo, rememberSaved, scope])

  /** Áp một bố cục gợi ý, ghi đè bố cục hiện tại. Nút xác nhận do Chrome hiển thị. */
  const applyPreset = useCallback(async (preset: DashboardWidget[]) => {
    const snapshot = { widgets: widgetsRef.current, removedIds: removedRef.current }
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
  }, [defaultWidgets, offerUndo, persist])

  /** Sắp xếp bằng bàn phím/chạm — bắt buộc theo WCAG 2.2 vì kéo-thả không được là cách duy nhất. */
  const moveWidget = useCallback((i: string, direction: 'up' | 'down') => {
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
  }, [markDirty])

  /** Đổi bề rộng theo vòng 4 → 6 → 8 → 12 → 4, thay cho việc phải kéo cạnh widget. */
  const cycleWidth = useCallback((i: string) => {
    const steps = [4, 6, 8, 12] as const
    setWidgets(prev => prev.map(w => {
      if (w.i !== i) return w
      const currentIdx = steps.findIndex(s => s >= w.w)
      const next = steps[(currentIdx + 1) % steps.length] ?? 4
      return { ...w, w: next, x: Math.min(w.x, 12 - next) }
    }))
    markDirty()
  }, [markDirty])

  /*
    Bố cục theo breakpoint: từ 700px trở lên (mốc `lg` của lưới) giữ đúng vị trí người dùng xếp, dưới đó xếp
    chồng full-width. Trước đây 768–996 cũng xếp chồng, nên mở bảng cấu hình ở màn 1366–1440 là
    cả lưới sập về một cột rồi bung lại lúc đóng — người dùng tưởng vừa làm hỏng bố cục.

    Chỉ đưa HÌNH HỌC vào lưới, và memo theo `widgets`: đưa cả object widget (kèm `s`, `title`…)
    thì mỗi lần sửa cài đặt trong bảng cấu hình, `deepEqual` của react-grid-layout thấy khác →
    đồng bộ lại toàn lưới dù không ô nào đổi chỗ.
  */
  const gridLayouts = useMemo(() => {
    const visibleWidgets = widgets.filter(b => b.visible)
    const orderedVisible = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x)
    const stackFull = (cols: number) => orderedVisible.map((w, i) => ({ i: w.i, x: 0, y: i, w: cols, h: w.h }))
    const geometry = visibleWidgets.map(w => ({ i: w.i, x: w.x, y: w.y, w: w.w, h: w.h }))
    return { lg: geometry, xs: stackFull(6), xxs: stackFull(4) }
  }, [widgets])

  return {
    widgets, setWidgets, isLoading,
    isAddModalOpen, setIsAddModalOpen,
    gridLayouts,
    saveConfig, addWidget, deleteWidget, resetLayout, handleLayoutChange,
    applyPreset, moveWidget, cycleWidth,
    commitLayout, updateWidgetSettings, saveStatus: autosave.status, retrySave: autosave.retry,
  }
}
