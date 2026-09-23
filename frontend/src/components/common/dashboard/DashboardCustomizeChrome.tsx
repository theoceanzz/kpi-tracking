import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Responsive } from 'react-grid-layout/legacy'
import {
  RotateCcw, Plus, X, GripVertical, Trash2, ArrowUp, ArrowDown, MoveHorizontal,
  Search, LayoutGrid, Sparkles, Check, MoreVertical, SlidersHorizontal, Copy, Pin, PinOff,
  Loader2, CloudOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCopyImage } from '@/components/common/CopyButton'
import ChartTypePreview, { type ChartShape } from '@/components/charts/ChartTypePreview'
import type { DashboardWidget } from './ChartWrapper'
import type { WidgetSettings } from './widgetSettings'
import type { AutosaveStatus } from './useAutosave'
import { CHART_CATEGORY_ORDER } from './chartCategories'
import { WidgetErrorBoundary } from './StableGridLayout'

/** Bề rộng bảng cấu hình và khe giữa nó với lưới (`gap-4` ở JSX). */
const PANEL_W = 320
const PANEL_GAP = 16
/** Cột trái của trang (cây đơn vị). Bảng cấu hình thế chỗ nó nên phải cùng bề rộng để lưới đứng yên. */
const SIDEBAR_W = 300

/*
  Từ 700px trở lên lưới giữ đúng 12 cột người dùng đã xếp; dưới đó xếp chồng. Chỉ có bấy nhiêu
  mốc: thêm mốc 996 (md/sm) như trước là mở bảng cấu hình ở màn 1366–1440 làm cả lưới sập về một
  cột rồi bung lại lúc đóng. 700 chứ không phải 768 để màn 1366 (sidebar mở, có cây đơn vị) vẫn
  còn lưới 12 cột. Object khai báo một lần ở module để react-grid-layout không thấy "props đổi"
  mỗi render.
*/
const GRID_MIN_W = 700
const GRID_BREAKPOINTS = { lg: GRID_MIN_W, xs: 480, xxs: 0 }
const GRID_COLS = { lg: 12, xs: 6, xxs: 4 }
const GRID_MARGIN: [number, number] = [16, 16]
const RESIZE_HANDLES: ('n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw')[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/**
 * Chỉ dựng ruột ô khi ô đã tới gần khung nhìn. Một tab Thống kê có 6–8 ô mà màn 1000px chỉ thấy
 * 3; dựng cả 8 (mỗi ô một cây Recharts) ngay lúc mở trang là phần lớn cái giật khi tải, và mỗi lần
 * lưới đổi cỡ thì 8 biểu đồ cùng vẽ lại. Đã hiện một lần thì giữ nguyên, không gỡ khi cuộn qua.
 */
function LazyMount({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    if (shown) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) setShown(true)
    }, { rootMargin: '600px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  return (
    <div ref={ref} className="h-full w-full">
      {shown ? children : <div className="h-full w-full rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] animate-pulse" aria-hidden="true" />}
    </div>
  )
}

/** Hình học một ô trên lưới, đúng phần react-grid-layout trả về khi kéo-thả. */
export interface GridLayoutItem { i: string; x: number; y: number; w: number; h: number }

/**
 * Bề mặt tối thiểu mà lưới cần. Khai báo theo cấu trúc (thay vì `ReturnType<typeof ...>`)
 * để dùng chung được cho mọi hook lưu bố cục.
 */
export interface CustomizationApi {
  widgets: DashboardWidget[]
  isAddModalOpen: boolean
  setIsAddModalOpen: (v: boolean) => void
  gridLayouts: Record<string, GridLayoutItem[]>
  saveConfig: () => void | Promise<unknown>
  addWidget: (t: DashboardWidget) => void
  deleteWidget: (i: string) => void
  resetLayout: () => void | Promise<void>
  handleLayoutChange: (layout: GridLayoutItem[]) => void
  /** Sắp xếp không cần chuột (WCAG 2.2 — kéo-thả không được là cách duy nhất). */
  moveWidget?: (i: string, direction: 'up' | 'down') => void
  cycleWidth?: (i: string) => void
  applyPreset?: (widgets: DashboardWidget[]) => void | Promise<void>
  /** Người dùng vừa thả tay sau khi kéo/dãn — mốc duy nhất đáng ghi xuống server. */
  commitLayout?: () => void
  updateWidgetSettings?: (i: string, patch: Partial<WidgetSettings>) => void
  saveStatus?: AutosaveStatus
  retrySave?: () => void
}

export interface WidgetCatalogEntry {
  template: DashboardWidget
  icon: React.ReactNode
  /** Mô tả 1 dòng hiện trong thư viện widget. */
  description?: string
  /** Nhãn nhóm để gom mục trong thư viện; thiếu thì dồn vào "Khác". */
  groupLabel?: string
  /** Hình minh hoạ loại biểu đồ. Có thì thay cho `icon`. */
  preview?: ChartShape
}

export interface LayoutPreset {
  key: string
  label: string
  description: string
  widgets: DashboardWidget[]
}

/** Trạng thái tự lưu — một dòng chữ mảnh, cố ý không dùng toast. */
function SaveStatusLabel({ status, onRetry }: { status?: AutosaveStatus; onRetry?: () => void }) {
  if (!status || status === 'idle') return null
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-destructive)]" role="status">
        <CloudOff size={14} aria-hidden="true" /> Chưa lưu được
        {onRetry && (
          <button onClick={onRetry} className="underline underline-offset-2 hover:opacity-80 cursor-pointer">Thử lại</button>
        )}
      </span>
    )
  }
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium transition-opacity',
        status === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
      )}
      aria-live="polite"
    >
      {status === 'saving'
        ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> Đang lưu…</>
        : <><Check size={13} aria-hidden="true" /> Đã lưu</>}
    </span>
  )
}

/**
 * Thanh công cụ của lưới — nay chỉ còn nút "Thêm biểu đồ" và trạng thái tự lưu.
 *
 * <p>Nút "Tuỳ chỉnh" đã bỏ cùng với chế độ chỉnh sửa: lưới đặt `draggableHandle` nên chỉ cụm chấm
 * mới khởi động kéo, bật kéo vĩnh viễn không cướp cú bấm nào của biểu đồ. Không còn chế độ thì
 * cũng không còn nút "Lưu" — thả tay ra là lưu.
 */
export function DashboardEditToolbar({ api }: { api: CustomizationApi }) {
  const { setIsAddModalOpen, saveStatus, retrySave } = api
  return (
    <div className="flex items-center gap-3">
      <SaveStatusLabel status={saveStatus} onRetry={retrySave} />
      {/* Hai bộ chọn cấp trang đã vào bảng cấu hình từng ô, đây là nút duy nhất còn lại trên đầu
          trang — vẽ như hành động chính (nền đậm) cho người dùng nhận ra ngay. */}
      <button
        onClick={() => setIsAddModalOpen(true)}
        className="h-10 px-4 rounded-lg bg-[var(--color-primary)] text-white text-sm font-semibold flex items-center gap-2 shadow-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors cursor-pointer"
      >
        <Plus size={18} aria-hidden="true" /> Thêm biểu đồ
      </button>
    </div>
  )
}

interface Props {
  api: CustomizationApi
  /** Vẽ ruột một ô. `ctx.openConfig` để widget tự mở bảng cấu hình (vd bấm vào dòng tóm tắt). */
  renderWidget: (w: DashboardWidget, ctx: { openConfig: () => void }) => React.ReactNode
  /** Danh mục widget để "Thêm biểu đồ". */
  catalog: WidgetCatalogEntry[]
  /** Gate hiển thị lưới (vd chờ dữ liệu chính). Mặc định true. */
  ready?: boolean
  /**
   * Bố cục gợi ý trong thư viện. Trang chủ đưa các bộ theo chủ đề, tab Thống kê đưa bộ theo vị
   * trí (`positionPresets`). Phần tử đầu là bộ hợp người xem nhất — lưới trống mời áp đúng bộ đó.
   */
  presets?: LayoutPreset[]
  /**
   * Ô hợp với vị trí của người xem. Có thì thư viện thêm chip lọc "Tất cả | <recommendedLabel>"
   * và gắn huy hiệu "Gợi ý cho bạn" lên thẻ — người mới không phải đọc hết 8 ô để đoán ô nào
   * dành cho mình.
   */
  recommendedIds?: ReadonlySet<string>
  /** Nhãn chip lọc, vd "Gợi ý cho Trưởng đơn vị". Bắt buộc khi có `recommendedIds`. */
  recommendedLabel?: string
  /** Nội dung bảng cấu hình của một ô. Không truyền thì menu không có mục "Cấu hình". */
  renderConfig?: (w: DashboardWidget, update: (patch: Partial<WidgetSettings>) => void) => React.ReactNode
  /** Ghim ô vào trang tổng quan. Không truyền thì menu không có mục "Ghim". */
  onTogglePin?: (w: DashboardWidget) => void
  /** Ô này đang được ghim chưa — quyết định nhãn của mục ghim trong menu. */
  isPinned?: (w: DashboardWidget) => boolean
  /**
   * Cột điều hướng của trang đặt cạnh trái lưới (vd cây đơn vị ở tab So sánh). Đặt TRONG lưới
   * để khi mở bảng cấu hình, cột này tạm ẩn và bảng cấu hình chiếm đúng bề rộng đó: lưới không
   * đổi cỡ, không biểu đồ nào vẽ lại — và tab có cột trái vẫn có bảng đẩy như mọi tab khác thay
   * vì rơi xuống lớp phủ vì thiếu chỗ.
   */
  sidebar?: React.ReactNode
}

/**
 * Vùng lưới widget: kéo-thả bằng cụm chấm, dãn từ cả bốn góc, mỗi ô một menu hành động, và bảng
 * cấu hình ĐẨY lưới sang trái thay vì phủ mờ lên trên.
 */
export default function DashboardCustomizeChrome({
  api, renderWidget, catalog, ready = true, presets, renderConfig, onTogglePin, isPinned, sidebar,
  recommendedIds, recommendedLabel,
}: Props) {
  const {
    widgets, isAddModalOpen, setIsAddModalOpen,
    gridLayouts, addWidget, deleteWidget, handleLayoutChange,
    moveWidget, cycleWidth, applyPreset, commitLayout, updateWidgetSettings, resetLayout,
  } = api

  const [search, setSearch] = useState('')
  const [onlyRecommended, setOnlyRecommended] = useState(false)
  const [pendingPreset, setPendingPreset] = useState<LayoutPreset | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [configFor, setConfigFor] = useState<string | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const nodeRefs = useRef(new Map<string, HTMLDivElement>())
  const { copy } = useCopyImage()

  const configWidget = widgets.find(w => w.i === configFor) ?? null

  /*
    TỰ ĐO vật chứa NGOÀI thay vì dùng `WidthProvider` của react-grid-layout.

    `WidthProvider` đo bằng ResizeObserver → requestAnimationFrame → setState, tức là lưới chỉ
    biết bề rộng mới ở commit SAU commit gắn drawer. Giữa hai commit đó, các ô vẫn giữ toạ độ pixel
    cũ và tràn xuống dưới drawer — đo được 5–11 khung hình tràn rồi mới nhảy. Đo vật chứa ngoài
    (thứ không đổi khi mở drawer) và tự trừ bề rộng bảng thì drawer, `transform` và `width` của mọi
    ô rơi vào CÙNG một commit. Tiện thể hết luôn cú trượt từ 1280px (giá trị khởi tạo của
    WidthProvider) về bề rộng thật mỗi lần mở trang.
  */
  const outerRef = useRef<HTMLDivElement>(null)
  const [outerWidth, setOuterWidth] = useState(0)
  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setOuterWidth(prev => (prev === w ? prev : w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /*
    Chỉ ĐẨY khi lưới sau khi co vẫn còn 12 cột (trên `GRID_MIN_W`). Đo bằng bề rộng LƯỚI chứ không
    phải viewport: sidebar 256px + lề 48px + thanh cuộn khiến viewport 1440 chỉ còn ~1136 cho
    lưới, đẩy thêm 336 mà tụt qua ngưỡng là toàn bộ ô xếp chồng full-width, người dùng tưởng vừa
    làm hỏng bố cục. Không đủ chỗ thì phủ lên như drawer thường.
  */
  // Có cột trái thì bảng cấu hình lấy đúng bề rộng cột đó và thế chỗ nó: lưới không đổi cỡ.
  const panelW = sidebar ? SIDEBAR_W : PANEL_W
  const wantPush = !!(configWidget && renderConfig)
  const canPush = outerWidth > 0 && outerWidth - (panelW + PANEL_GAP) > GRID_MIN_W
  const pushing = wantPush && canPush
  const sideTaken = pushing || sidebar ? panelW + PANEL_GAP : 0
  const gridWidth = outerWidth > 0 ? outerWidth - sideTaken : 0

  /*
    Trong đúng nhịp lưới đổi cỡ vì drawer, TẮT transition của ô. CSS chỉ transition `transform`
    chứ không transition `width` (cố ý — transition width là ResizeObserver bắn mỗi khung hình),
    nên nếu để nguyên thì ô đổi rộng tức thì rồi trượt ngang 200ms: khe giữa hai ô cạnh nhau mở
    ra 140px rồi khép lại — chính là cái giật nhìn thấy. Gắn lớp thẳng lên DOM, không qua state,
    để không đẻ thêm lượt render nào.
  */
  const gridWrapRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = gridWrapRef.current
    if (!el) return
    el.classList.add('rgl-settling')
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => el.classList.remove('rgl-settling')) })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); el.classList.remove('rgl-settling') }
  }, [pushing])
  const visibleCount = widgets.filter(w => w.visible).length
  const onLayoutChange = useCallback(
    (current: readonly GridLayoutItem[], all: Partial<Record<string, readonly GridLayoutItem[]>>) =>
      handleLayoutChange([...(all.lg ?? current)]),
    [handleLayoutChange],
  )

  /** Gom thư viện theo nhóm và lọc theo từ khoá / gợi ý; nhóm biểu đồ đi theo thứ tự đã định. */
  const groupedCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = catalog.filter(c =>
      (!onlyRecommended || !recommendedIds || recommendedIds.has(c.template.i)) &&
      (!q || c.template.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q)))

    const groups = new Map<string, WidgetCatalogEntry[]>()
    matched.forEach(entry => {
      const key = entry.groupLabel ?? 'Khác'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(entry)
    })

    const order = new Map<string, number>(CHART_CATEGORY_ORDER.map((g, idx) => [g, idx]))
    return [...groups.entries()].sort(
      (a, b) => (order.get(a[0]) ?? 900) - (order.get(b[0]) ?? 900) || a[0].localeCompare(b[0])
    )
  }, [catalog, search, onlyRecommended, recommendedIds])

  const closeConfig = useCallback(() => setConfigFor(null), [])

  /*
    Phần tử của mỗi ô được CACHE theo đúng những gì ô đó phụ thuộc. `GridItem` của react-grid-layout
    bỏ qua render khi `children` giữ nguyên định danh, nên mở menu của ô này, mở bảng cấu hình,
    đo lại bề rộng… không kéo 7 ô còn lại (mỗi ô một cây Recharts) vẽ lại theo. Trước đây mỗi cú
    bấm bất kỳ trên lưới là toàn bộ biểu đồ render lại — đo được ~0.9s chặn luồng chính.

    Mọi hàm hành động đi qua `latest` ref để phần tử cache không phải phụ thuộc định danh hàm.
  */
  const latest = useRef({ deleteWidget, moveWidget, cycleWidth, onTogglePin, copy, configFor })
  useLayoutEffect(() => {
    latest.current = { deleteWidget, moveWidget, cycleWidth, onTogglePin, copy, configFor }
  })
  const registerNode = useCallback((i: string, el: HTMLDivElement | null) => {
    if (el) nodeRefs.current.set(i, el)
    else nodeRefs.current.delete(i)
  }, [])
  const actions = useMemo<CellActions>(() => ({
    openConfig: (i: string) => { setMenuFor(null); setConfigFor(i) },
    menu: (i: string, open: boolean) => setMenuFor(open ? i : null),
    copy: (i: string) => { setMenuFor(null); void latest.current.copy(nodeRefs.current.get(i) ?? null) },
    pin: (w: DashboardWidget) => { setMenuFor(null); latest.current.onTogglePin?.(w) },
    move: (i: string, d: 'up' | 'down') => latest.current.moveWidget?.(i, d),
    cycle: (i: string) => latest.current.cycleWidth?.(i),
    remove: (i: string) => {
      setMenuFor(null)
      if (latest.current.configFor === i) setConfigFor(null)
      latest.current.deleteWidget(i)
    },
  }), [])
  // Giữ trong state (không bao giờ set lại) thay vì ref: đọc ref lúc render là điều React cấm.
  const [cellCache] = useState(() => new Map<string, { deps: unknown[]; el: React.ReactElement }>())
  const visibleBlocks = widgets.filter(b => b.visible)
  const cells = visibleBlocks.map(block => {
    const pinned = isPinned ? isPinned(block) : !!block.isPinned
    const deps = [
      block, configFor === block.i, menuFor === block.i, renderWidget, pinned,
      !!renderConfig, !!onTogglePin, !!moveWidget, !!cycleWidth,
    ]
    const hit = cellCache.get(block.i)
    if (hit && hit.deps.length === deps.length && hit.deps.every((d, k) => d === deps[k])) return hit.el
    const el = (
      <GridCell
        key={block.i}
        block={block}
        active={configFor === block.i}
        menuOpen={menuFor === block.i}
        pinned={pinned}
        hasConfig={!!renderConfig}
        hasPin={!!onTogglePin}
        hasMove={!!moveWidget}
        hasCycle={!!cycleWidth}
        renderWidget={renderWidget}
        actions={actions}
        registerNode={registerNode}
      />
    )
    cellCache.set(block.i, { deps, el })
    return el
  })
  // Ô đã gỡ thì thả khỏi cache để không giữ cây phần tử vô chủ.
  if (cellCache.size > visibleBlocks.length) {
    const alive = new Set(visibleBlocks.map(b => b.i))
    for (const k of [...cellCache.keys()]) if (!alive.has(k)) cellCache.delete(k)
  }

  const configPanel = configWidget && renderConfig && (
    <div className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg overflow-hidden flex flex-col max-h-[calc(100vh-8rem)]" style={{ width: pushing ? undefined : PANEL_W }}>
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cấu hình biểu đồ</p>
          <p className="font-semibold text-sm truncate text-[var(--color-foreground)]">{configWidget.title}</p>
        </div>
        <button onClick={closeConfig} aria-label="Đóng cấu hình" className="p-2 rounded-lg hover:bg-[var(--color-accent)] cursor-pointer shrink-0">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
        {renderConfig(configWidget, patch => updateWidgetSettings?.(configWidget.i, patch))}
      </div>
    </div>
  )

  return (
    <>
      {/* `items-start` là bắt buộc: mặc định `stretch` kéo bảng cao bằng lưới, lúc đó `sticky`
          không còn gì để bám trong khung nhìn. */}
      <div ref={outerRef} className="flex items-start gap-4">
        {sidebar && !pushing && (
          <aside className="shrink-0 self-start sticky top-4" style={{ width: SIDEBAR_W }}>
            {sidebar}
          </aside>
        )}
        <div className="flex-1 min-w-0">
          {/* ── Lưới widget ───────────────────────────────────────────────── */}
          {ready && gridWidth > 0 && (
            <div ref={gridWrapRef} className="relative min-h-[400px]">
              {/* Không còn widget nào hiện: nói rõ phải làm gì thay vì để trang trắng */}
              {visibleCount === 0 && (
                <div className="flex flex-col items-center justify-center text-center gap-4 py-20 px-6">
                  <div className="w-16 h-16 rounded-2xl bg-[var(--color-muted)] flex items-center justify-center text-slate-400">
                    <LayoutGrid size={30} aria-hidden="true" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="font-semibold text-lg text-[var(--color-foreground)]">Chưa có biểu đồ nào</p>
                    <p className="mt-1 text-sm text-[var(--color-muted-foreground)] max-w-sm">
                      Thêm nội dung bạn cần theo dõi, hoặc dùng một bố cục gợi ý để bắt đầu nhanh.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <button onClick={() => setIsAddModalOpen(true)} className="min-h-[44px] px-5 rounded-lg bg-[var(--color-primary)] text-white font-semibold text-sm hover:brightness-110 flex items-center gap-2 cursor-pointer">
                      <Plus size={16} aria-hidden="true" /> Thêm biểu đồ
                    </button>
                    {presets?.length ? (
                      <button onClick={() => setPendingPreset(presets[0] ?? null)} className="min-h-[44px] px-5 rounded-lg bg-[var(--color-muted)] font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer">
                        <Sparkles size={16} aria-hidden="true" /> Dùng bố cục gợi ý
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              <Responsive
                className="layout"
                width={gridWidth}
                layouts={gridLayouts}
                breakpoints={GRID_BREAKPOINTS}
                cols={GRID_COLS}
                rowHeight={32}
                compactType="vertical"
                draggableHandle=".drag-handle"
                // Luôn bật: chỉ cụm chấm mới khởi động kéo, nên không giành thao tác của biểu đồ.
                isDraggable
                isResizable
                resizeHandles={RESIZE_HANDLES}
                onLayoutChange={onLayoutChange}
                // Chỉ ghi xuống server khi người dùng THẢ TAY. `onLayoutChange` còn bắn cả lúc
                // mount và lúc đổi breakpoint — bám vào nó là mở trang thôi đã tốn một request.
                onDragStop={commitLayout}
                onResizeStop={commitLayout}
                margin={GRID_MARGIN}
              >
                {cells}
              </Responsive>
            </div>
          )}
        </div>

        {/*
          Bảng cấu hình ĐẨY lưới sang trái. Bề rộng đổi tức thì chứ không transition: mỗi bước
          animate là một lần ResizeObserver của lưới bắn, kéo theo mọi ResponsiveContainer của
          Recharts vẽ lại — 12 widget thì giật thấy rõ. Bảng trượt vào bằng `transform`, thứ
          không làm đổi kích thước gì cả.
        */}
        {pushing && configPanel && (
          <aside className="shrink-0 self-start sticky top-4" style={{ width: panelW }}>
            {configPanel}
          </aside>
        )}
      </div>

      {/* Màn hẹp: không đẩy được nữa thì phủ lên, dùng đúng công thức trượt của các drawer khác. */}
      {wantPush && !canPush && configPanel && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40" onClick={closeConfig}>
          <div className="h-full p-3 flex items-stretch" onClick={e => e.stopPropagation()}>
            {configPanel}
          </div>
        </div>
      )}

      {/* ── Thư viện biểu đồ ──────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40" onClick={() => setIsAddModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Thư viện biểu đồ" className="w-full max-w-4xl max-h-[90vh] flex flex-col bg-[var(--color-card)] rounded-2xl shadow-lg p-5 sm:p-7" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <h3 className="font-semibold text-xl">Thêm biểu đồ</h3>
                <p className="text-xs font-medium text-slate-400 mt-1">Chọn theo nhóm số liệu bạn muốn trả lời</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} aria-label="Đóng" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"><X size={24} aria-hidden="true" /></button>
            </div>

            <div className={cn('relative', recommendedIds && recommendedLabel ? 'mb-3' : 'mb-5')}>
              <Search size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm biểu đồ theo tên hoặc mô tả…"
                aria-label="Tìm biểu đồ"
                className="w-full min-h-[44px] pl-11 pr-4 rounded-lg bg-[var(--color-muted)] border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              />
            </div>

            {/* Lọc theo vị trí: mặc định vẫn là "Tất cả" để không giấu ô nào, chỉ là có lối tắt. */}
            {recommendedIds && recommendedLabel && (
              <div className="flex flex-wrap items-center gap-2 mb-5" role="group" aria-label="Lọc theo vị trí">
                <ChoiceChip selected={!onlyRecommended} onClick={() => setOnlyRecommended(false)}>Tất cả</ChoiceChip>
                <ChoiceChip selected={onlyRecommended} onClick={() => setOnlyRecommended(true)}>
                  <Sparkles aria-hidden="true" /> {recommendedLabel}
                  <span className="tabular-nums opacity-70">{catalog.filter(c => recommendedIds.has(c.template.i)).length}</span>
                </ChoiceChip>
              </div>
            )}

            {/* Bố cục gợi ý — lối tắt cho người không muốn tự dựng từng ô */}
            {presets?.length ? (
              <div className="mb-6">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Bố cục gợi ý</p>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPendingPreset(p)}
                      title={p.description}
                      className="min-h-[44px] px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-[var(--color-card)] text-sm font-semibold hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles size={14} aria-hidden="true" /> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-h-0 flex gap-5">
              {/* Rãnh nhảy nhanh: 40 mục chia 8 nhóm thì cuộn mù, không biết còn gì phía dưới. */}
              {groupedCatalog.length > 2 && (
                <nav className="hidden md:block w-44 shrink-0 overflow-y-auto custom-scrollbar pr-1" aria-label="Nhóm biểu đồ">
                  <ul className="space-y-0.5 sticky top-0">
                    {groupedCatalog.map(([label, entries]) => (
                      <li key={label}>
                        <a
                          href={`#chart-group-${slug(label)}`}
                          onClick={e => {
                            e.preventDefault()
                            document.getElementById(`chart-group-${slug(label)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                          }}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[var(--color-primary)] cursor-pointer"
                        >
                          <span className="truncate">{label}</span>
                          <span className="tabular-nums text-slate-300 dark:text-slate-600">{entries.length}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              )}

              <div className="flex-1 min-w-0 overflow-auto pr-1 custom-scrollbar space-y-7">
                {groupedCatalog.length === 0 && (
                  <p className="text-center text-sm text-slate-400 py-12">
                    {search.trim()
                      ? <>Không tìm thấy biểu đồ nào khớp “{search}”.</>
                      : 'Không có ô nào trong bộ gợi ý này.'}
                  </p>
                )}
                {groupedCatalog.map(([groupLabel, entries]) => (
                  <section key={groupLabel} id={`chart-group-${slug(groupLabel)}`} className="scroll-mt-2">
                    <h4 className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">{groupLabel}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {entries.map(({ template, icon, description, preview }) => {
                        // "Đã thêm" phải tính cả trạng thái hiện/ẩn: widget mặc định ẩn vẫn nằm
                        // trong danh sách, coi nó là đã thêm thì bấm vào không có gì xảy ra.
                        const isAdded = widgets.some(w => w.i === template.i && w.visible)
                        const isRecommended = recommendedIds?.has(template.i) ?? false
                        return (
                          <button
                            key={template.i}
                            type="button"
                            // Thẻ là một công tắc: bấm để thêm, bấm lại để gỡ.
                            onClick={() => (isAdded ? deleteWidget(template.i) : addWidget(template))}
                            aria-pressed={isAdded}
                            className={cn(
                              'flex items-start gap-4 p-4 rounded-2xl border text-left transition-all group cursor-pointer',
                              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
                              isAdded
                                ? 'bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-700'
                                : 'bg-[var(--color-card)] border-[var(--color-border)] hover:border-[var(--color-primary)]'
                            )}
                          >
                            <div className={cn(
                              'shrink-0 rounded-lg flex items-center justify-center',
                              preview ? 'w-16 h-12' : 'w-11 h-11',
                              isAdded ? 'bg-[var(--color-primary)] text-white' : 'bg-indigo-50 dark:bg-indigo-900/20 text-[var(--color-primary)]'
                            )}>
                              {isAdded
                                ? <Check size={20} aria-hidden="true" />
                                : preview ? <ChartTypePreview shape={preview} /> : icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-[var(--color-foreground)] flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span>{template.title}</span>
                                {isRecommended && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-primary)]">
                                    <Sparkles size={11} aria-hidden="true" /> Gợi ý cho bạn
                                  </span>
                                )}
                              </p>
                              {description && <p className="text-xs text-[var(--color-muted-foreground)] mt-0.5 leading-relaxed">{description}</p>}
                              {/* Nói rõ bấm lần nữa sẽ gỡ, để trạng thái "đã chọn" không thành ngõ cụt */}
                              <p className={cn(
                                'text-xs font-medium mt-1.5',
                                isAdded ? 'text-[var(--color-primary)] dark:text-indigo-400' : 'text-transparent'
                              )}>
                                {isAdded ? 'Đã thêm · bấm để gỡ' : ' '}
                              </p>
                            </div>
                            {isAdded
                              ? <X size={16} aria-hidden="true" className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                              : <Plus size={16} aria-hidden="true" className="text-slate-300 group-hover:text-[var(--color-primary)] transition-colors shrink-0 mt-1" />}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <button
                onClick={() => setConfirmReset(true)}
                className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <RotateCcw size={14} aria-hidden="true" /> Đặt lại bố cục mặc định
              </button>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="min-h-[44px] px-8 rounded-lg bg-[var(--color-primary)] text-white font-semibold text-sm hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmReset}
        title="Đặt lại bố cục mặc định?"
        description="Bố cục bạn đang dùng sẽ bị thay thế hoàn toàn bằng bố cục mặc định. Sau khi đặt lại bạn vẫn có thể bấm Hoàn tác trong thông báo hiện ra."
        confirmLabel="Đặt lại"
        onClose={() => setConfirmReset(false)}
        onConfirm={() => { setConfirmReset(false); resetLayout() }}
      />

      {/* Áp preset là ghi đè toàn bộ — cùng chuẩn xác nhận với Đặt lại */}
      <ConfirmDialog
        open={!!pendingPreset}
        title={`Áp dụng bố cục "${pendingPreset?.label}"?`}
        description={`${pendingPreset?.description ?? ''} Bố cục hiện tại của bạn sẽ bị thay thế hoàn toàn. Sau khi áp dụng bạn vẫn có thể bấm Hoàn tác trong thông báo hiện ra.`}
        confirmLabel="Áp dụng"
        onClose={() => setPendingPreset(null)}
        onConfirm={() => {
          const preset = pendingPreset
          setPendingPreset(null)
          setIsAddModalOpen(false)
          if (preset && applyPreset) applyPreset(preset.widgets)
        }}
      />
    </>
  )
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')

interface CellActions {
  openConfig: (i: string) => void
  menu: (i: string, open: boolean) => void
  copy: (i: string) => void
  pin: (w: DashboardWidget) => void
  move: (i: string, d: 'up' | 'down') => void
  cycle: (i: string) => void
  remove: (i: string) => void
}

interface GridCellProps {
  block: DashboardWidget
  active: boolean
  menuOpen: boolean
  pinned: boolean
  hasConfig: boolean
  hasPin: boolean
  hasMove: boolean
  hasCycle: boolean
  renderWidget: Props['renderWidget']
  actions: CellActions
  registerNode: (i: string, el: HTMLDivElement | null) => void
  // Do react-grid-layout gắn vào khi clone phần tử con
  style?: React.CSSProperties
  className?: string
  onMouseDown?: React.MouseEventHandler
  onMouseUp?: React.MouseEventHandler
  onTouchEnd?: React.TouchEventHandler
  onTouchStart?: React.TouchEventHandler
  children?: React.ReactNode
}

/**
 * Một ô lưới: khung, cụm điều khiển (kéo + menu) và ruột widget. react-grid-layout clone phần tử
 * con để gắn `style`/`className`/sự kiện chuột, nên component này phải chuyển hết các prop đó
 * xuống `div` gốc và nhận `ref` — thiếu một thứ là ô không kéo được hoặc không có toạ độ.
 */
const GridCell = React.forwardRef<HTMLDivElement, GridCellProps>(function GridCell({
  block, active, menuOpen, pinned, hasConfig, hasPin, hasMove, hasCycle, renderWidget, actions, registerNode,
  style, className, onMouseDown, onMouseUp, onTouchEnd, onTouchStart, children,
}, ref) {
  const ctx = useMemo(() => ({ openConfig: () => actions.openConfig(block.i) }), [actions, block.i])
  const setRefs = useCallback((el: HTMLDivElement | null) => {
    registerNode(block.i, el)
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }, [ref, registerNode, block.i])
  return (
    <div
      ref={setRefs}
      style={style}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onTouchEnd={onTouchEnd}
      onTouchStart={onTouchStart}
      // Móc cho công cụ chụp ảnh tài liệu (scripts/capture_charts.py) tìm ô theo id thay vì theo
      // tiêu đề hiển thị — tiêu đề đổi theo bộ lọc ("Xu hướng KPI đơn vị: …") nên bám vào nó dễ gãy.
      data-widget-id={block.i}
      className={cn(
        className,
        // overflow-hidden là hàng rào bắt buộc: widget nào render cao hơn ô lưới (vd danh sách
        // cảnh báo tự giãn theo nội dung) sẽ tràn ra và ĐÈ lên hàng dưới. Clip ở đây chặn được mọi
        // trường hợp, không phụ thuộc widget tự lo.
        'relative group h-full overflow-hidden rounded-widget',
        active && 'ring-2 ring-[var(--color-primary)]',
      )}
    >
      {/*
        Cụm điều khiển nằm TRONG biên ô (overflow-hidden sẽ cắt nếu đặt ra ngoài) và mờ đi lúc
        nghỉ để không làm rối một trang đầy biểu đồ. `data-copy-exclude` để nó không lọt vào ảnh chụp.
      */}
      <div
        data-copy-exclude
        className="absolute top-3 right-3 z-[60] flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
      >
        <span
          className="drag-handle hidden md:flex cursor-move items-center justify-center w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 hover:text-[var(--color-primary)]"
          title="Kéo để di chuyển"
          aria-hidden="true"
        >
          <GripVertical size={15} />
        </span>

        <Popover open={menuOpen} onOpenChange={o => actions.menu(block.i, o)}>
          <PopoverTrigger asChild>
            <button
              aria-label={`Hành động cho "${block.title}"`}
              title="Hành động"
              className="w-8 h-8 flex items-center justify-center rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-slate-500 hover:text-[var(--color-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] cursor-pointer"
            >
              <MoreVertical size={16} aria-hidden="true" />
            </button>
          </PopoverTrigger>
          {/* Popover của Radix render qua portal nên không bị `overflow-hidden` của ô cắt cụt. */}
          <PopoverContent align="end" className="w-56 p-1.5" role="menu">
            {hasConfig && (
              <MenuItem icon={<SlidersHorizontal size={15} />} onClick={() => actions.openConfig(block.i)}>
                Cấu hình
              </MenuItem>
            )}
            <MenuItem icon={<Copy size={15} />} onClick={() => actions.copy(block.i)}>
              Sao chép ảnh
            </MenuItem>
            {hasPin && (
              <MenuItem icon={pinned ? <PinOff size={15} /> : <Pin size={15} />} onClick={() => actions.pin(block)}>
                {pinned ? 'Bỏ ghim tổng quan' : 'Ghim tổng quan'}
              </MenuItem>
            )}

            {/*
              Ba mục dưới đây KHÔNG phải tính năng thêm cho vui: WCAG 2.2 cấm kéo-thả là cách duy
              nhất để sắp xếp, và trên màn cảm ứng thì cụm chấm bị ẩn nên đây là đường đi duy nhất.
            */}
            {(hasMove || hasCycle) && <MenuSeparator />}
            {hasMove && (
              <>
                <MenuItem icon={<ArrowUp size={15} />} onClick={() => actions.move(block.i, 'up')}>Đưa lên trên</MenuItem>
                <MenuItem icon={<ArrowDown size={15} />} onClick={() => actions.move(block.i, 'down')}>Đưa xuống dưới</MenuItem>
              </>
            )}
            {hasCycle && (
              <MenuItem icon={<MoveHorizontal size={15} />} onClick={() => actions.cycle(block.i)}>Đổi bề rộng</MenuItem>
            )}

            <MenuSeparator />
            <MenuItem icon={<Trash2 size={15} />} danger onClick={() => actions.remove(block.i)}>
              Xoá khỏi trang
            </MenuItem>
          </PopoverContent>
        </Popover>
      </div>

      {/*
        Lớp cuộn riêng: widget cao hơn ô thì cuộn TRONG ô thay vì bị cắt cụt. Không còn
        `pointer-events-none`: kéo đã bám cụm chấm nên biểu đồ giữ được hover/tooltip/bấm như thường.
      */}
      <div className="h-full w-full overflow-y-auto custom-scrollbar">
        {/* Hàng rào lỗi từng ô: một biểu đồ ném lỗi khi vẽ chỉ làm ô đó hiện "không vẽ được" — không
            để React Router thay cả trang bằng màn lỗi (trắng trang chủ 15/09). */}
        <WidgetErrorBoundary title={block.title}>
          <LazyMount>{renderWidget(block, ctx)}</LazyMount>
        </WidgetErrorBoundary>
      </div>
      {/* Tay nắm dãn do react-grid-layout chèn qua `children` */}
      {children}
    </div>
  )
})

function MenuSeparator() {
  return <div className="my-1 h-px bg-[var(--color-muted)]" role="separator" />
}

/** Một dòng trong menu của widget — đủ 36px chiều cao chạm và có icon dẫn hướng. */
function MenuItem({ icon, children, onClick, danger }: {
  icon: React.ReactNode; children: React.ReactNode; onClick: () => void; danger?: boolean
}) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 min-h-[36px] rounded-lg text-[13px] font-semibold text-left transition-colors cursor-pointer',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]',
        danger
          ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'
          : 'text-[var(--color-foreground)] hover:bg-slate-100 dark:hover:bg-slate-800'
      )}
    >
      <span className="shrink-0 opacity-70" aria-hidden="true">{icon}</span>
      {children}
    </button>
  )
}
