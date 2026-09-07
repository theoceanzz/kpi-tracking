import React, { useMemo, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import {
  Settings2, Save, RotateCcw, Plus, Layout, X, Eye, EyeOff, GripVertical, Trash2,
  ArrowUp, ArrowDown, MoveHorizontal, Search, LayoutGrid, Sparkles, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import type { DashboardWidget } from './ChartWrapper'

const ResponsiveGridLayout = WidthProvider(Responsive)

/** Hình học một ô trên lưới, đúng phần react-grid-layout trả về khi kéo-thả. */
export interface GridLayoutItem { i: string; x: number; y: number; w: number; h: number }

/**
 * Bề mặt tối thiểu mà lưới cần. Khai báo theo cấu trúc (thay vì `ReturnType<typeof ...>`)
 * để dùng chung được cho cả `useDashboardCustomization` (tab thống kê) và
 * `useDashboardLayout` (trang chủ). Phần mở rộng của trang chủ là optional.
 */
export interface CustomizationApi {
  widgets: DashboardWidget[]
  isEditMode: boolean
  setIsEditMode: (v: boolean) => void
  isConfigOpen: boolean
  setIsConfigOpen: (v: boolean) => void
  isAddModalOpen: boolean
  setIsAddModalOpen: (v: boolean) => void
  gridLayouts: Record<string, GridLayoutItem[]>
  saveConfig: () => void | Promise<unknown>
  addWidget: (t: DashboardWidget) => void
  deleteWidget: (i: string) => void
  toggleVisibility: (i: string) => void
  resetLayout: () => void | Promise<void>
  handleLayoutChange: (layout: GridLayoutItem[]) => void
  /** Trang chủ: sắp xếp không cần chuột (WCAG 2.2 — kéo-thả không được là cách duy nhất). */
  moveWidget?: (i: string, direction: 'up' | 'down') => void
  cycleWidth?: (i: string) => void
  applyPreset?: (widgets: DashboardWidget[]) => void | Promise<void>
}

export interface WidgetCatalogEntry {
  template: DashboardWidget
  icon: React.ReactNode
  /** Mô tả 1 dòng hiện trong thư viện widget. */
  description?: string
  /** Nhãn nhóm để gom mục trong thư viện; thiếu thì dồn vào "Khác". */
  groupLabel?: string
}

export interface LayoutPreset {
  key: string
  label: string
  description: string
  widgets: DashboardWidget[]
}

/** Cụm nút "Tuỳ chỉnh / Lưu / Ẩn-Hiện / Thêm / Đặt lại" — đặt tuỳ ý trong header của tab. */
export function DashboardEditToolbar({ api }: { api: CustomizationApi }) {
  const { isEditMode, setIsEditMode, setIsConfigOpen, setIsAddModalOpen, saveConfig, resetLayout } = api
  const [confirmReset, setConfirmReset] = useState(false)

  if (isEditMode) {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-1 rounded-xl border border-indigo-100 dark:border-indigo-800">
          <button onClick={() => setConfirmReset(true)} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 cursor-pointer" title="Đặt lại mặc định" aria-label="Đặt lại bố cục mặc định"><RotateCcw size={18} aria-hidden="true" /></button>
          <button onClick={() => setIsConfigOpen(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2 cursor-pointer"><Layout size={14} aria-hidden="true" /> Ẩn/Hiện</button>
          <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg flex items-center gap-2 cursor-pointer"><Plus size={14} aria-hidden="true" /> Thêm biểu đồ</button>
          <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
          <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer">Huỷ</button>
          <button onClick={saveConfig} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2 cursor-pointer"><Save size={14} aria-hidden="true" /> Lưu</button>
        </div>

        <ConfirmDialog
          open={confirmReset}
          title="Đặt lại bố cục mặc định?"
          description="Bố cục bạn đang dùng sẽ bị thay thế hoàn toàn bằng bố cục mặc định. Sau khi đặt lại bạn vẫn có thể bấm Hoàn tác trong thông báo hiện ra."
          confirmLabel="Đặt lại"
          onClose={() => setConfirmReset(false)}
          onConfirm={() => { setConfirmReset(false); resetLayout() }}
        />
      </>
    )
  }
  return (
    <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all cursor-pointer">
      <Settings2 size={16} aria-hidden="true" /> Tuỳ chỉnh
    </button>
  )
}

interface Props {
  api: CustomizationApi
  renderWidget: (w: DashboardWidget) => React.ReactNode
  /** Danh mục widget để "Thêm biểu đồ". */
  catalog: WidgetCatalogEntry[]
  /** Gate hiển thị lưới (vd chờ dữ liệu chính). Mặc định true. */
  ready?: boolean
  /** Bố cục gợi ý — chỉ trang chủ dùng. */
  presets?: LayoutPreset[]
}

/**
 * Vùng lưới widget tuỳ chỉnh: lưới react-grid-layout (kéo-thả/dãn) + nút sắp xếp không cần chuột
 * + drawer Ẩn/Hiện + thư viện widget có nhóm/tìm kiếm.
 * Thanh công cụ tách riêng ở {@link DashboardEditToolbar} để tab tự đặt vào header.
 */
export default function DashboardCustomizeChrome({ api, renderWidget, catalog, ready = true, presets }: Props) {
  const {
    widgets, isEditMode, setIsConfigOpen, isConfigOpen, isAddModalOpen, setIsAddModalOpen,
    gridLayouts, addWidget, deleteWidget, toggleVisibility, handleLayoutChange,
    moveWidget, cycleWidth, applyPreset,
  } = api

  const [search, setSearch] = useState('')
  const [pendingPreset, setPendingPreset] = useState<LayoutPreset | null>(null)

  const visibleCount = widgets.filter(w => w.visible).length

  /** Gom thư viện theo nhóm và lọc theo từ khoá; giữ thứ tự nhóm như thứ tự xuất hiện. */
  const groupedCatalog = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matched = q
      ? catalog.filter(c =>
          c.template.title.toLowerCase().includes(q) || (c.description ?? '').toLowerCase().includes(q))
      : catalog

    const groups = new Map<string, WidgetCatalogEntry[]>()
    matched.forEach(entry => {
      const key = entry.groupLabel ?? 'Khác'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(entry)
    })
    return [...groups.entries()]
  }, [catalog, search])

  return (
    <>
      {/* ── Lưới widget ───────────────────────────────────────────────────── */}
      {ready && (
        <div className={cn("relative min-h-[400px]", isEditMode && "bg-slate-50/50 dark:bg-slate-800/10 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-800")}>
          {isEditMode && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
              <div className="grid grid-cols-12 w-full h-full gap-4 px-2">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-x border-slate-300 dark:border-slate-700 h-full" />)}
              </div>
            </div>
          )}

          {/* Không còn widget nào hiện: nói rõ phải làm gì thay vì để trang trắng */}
          {visibleCount === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-20 px-6">
              <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                <LayoutGrid size={30} aria-hidden="true" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-black text-lg text-slate-900 dark:text-white">Trang chủ đang trống</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                  Bạn đã ẩn toàn bộ nội dung. Thêm widget bạn cần theo dõi, hoặc dùng một bố cục gợi ý để bắt đầu nhanh.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={() => setIsAddModalOpen(true)} className="min-h-[44px] px-5 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 flex items-center gap-2 cursor-pointer">
                  <Plus size={16} aria-hidden="true" /> Thêm widget
                </button>
                {presets?.length ? (
                  <button onClick={() => setPendingPreset(presets[0] ?? null)} className="min-h-[44px] px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black text-sm hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer">
                    <Sparkles size={16} aria-hidden="true" /> Dùng bố cục gợi ý
                  </button>
                ) : null}
              </div>
            </div>
          )}

          <ResponsiveGridLayout
            className="layout"
            layouts={gridLayouts}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 12, sm: 12, xs: 6, xxs: 4 }}
            rowHeight={32}
            compactType="vertical"
            draggableHandle=".drag-handle"
            isDraggable={isEditMode}
            isResizable={isEditMode}
            onLayoutChange={(current, all) => { if (isEditMode) handleLayoutChange((all.lg ?? current) as GridLayoutItem[]) }}
            margin={[16, 16]}
          >
            {widgets.filter(b => b.visible).map((block) => (
              <div
                key={block.i}
                className={cn(
                  // overflow-hidden là hàng rào bắt buộc: widget nào render cao hơn ô lưới
                  // (vd danh sách cảnh báo tự giãn theo nội dung) sẽ tràn ra và ĐÈ lên hàng
                  // dưới. Clip ở đây chặn được mọi trường hợp, không phụ thuộc widget tự lo.
                  "relative group h-full overflow-hidden rounded-[28px]",
                  isEditMode && "ring-2 ring-transparent hover:ring-indigo-500 transition-all"
                )}
              >
                {isEditMode && (
                  /*
                    Gom cả cụm vào GÓC TRÊN PHẢI và nằm TRONG biên ô:
                    - đặt ngoài biên (-top-2) thì bị overflow-hidden cắt mất;
                    - đặt giữa trên thì che đúng tiêu đề widget.
                    Kéo-thả chỉ là một cách; các nút bên cạnh là đường đi bắt buộc cho bàn phím
                    và cảm ứng (WCAG 2.2 AA — Dragging Movements), trên mobile là cách duy nhất.
                  */
                  <div className="absolute top-2 right-2 z-[60] flex items-center gap-1 bg-white/95 dark:bg-slate-800/95 backdrop-blur border border-slate-200 dark:border-slate-700 px-1.5 py-1 rounded-full shadow-lg opacity-80 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <span className="drag-handle hidden md:flex cursor-move items-center gap-1 px-2 py-1" aria-hidden="true">
                      <GripVertical size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kéo</span>
                    </span>
                    {moveWidget && (
                      <>
                        <ChromeIconButton label={`Đưa "${block.title}" lên trên`} onClick={() => moveWidget(block.i, 'up')}><ArrowUp size={15} aria-hidden="true" /></ChromeIconButton>
                        <ChromeIconButton label={`Đưa "${block.title}" xuống dưới`} onClick={() => moveWidget(block.i, 'down')}><ArrowDown size={15} aria-hidden="true" /></ChromeIconButton>
                      </>
                    )}
                    {cycleWidth && (
                      <ChromeIconButton label={`Đổi bề rộng của "${block.title}"`} onClick={() => cycleWidth(block.i)}><MoveHorizontal size={15} aria-hidden="true" /></ChromeIconButton>
                    )}
                    <span className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" aria-hidden="true" />
                    <ChromeIconButton
                      label={`Gỡ "${block.title}" khỏi trang`}
                      onClick={() => deleteWidget(block.i)}
                      danger
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </ChromeIconButton>
                  </div>
                )}
                {/*
                  Lớp cuộn riêng: widget cao hơn ô thì cuộn TRONG ô thay vì bị cắt cụt.
                  Widget đã tự quản chiều cao (WidgetShell) luôn vừa khít nên lớp này không kích hoạt.
                  Khi chỉnh sửa thì tắt con trỏ để biểu đồ không giành hover/tooltip/mousedown.
                */}
                <div className={cn("h-full w-full overflow-y-auto custom-scrollbar", isEditMode && "pointer-events-none")}>
                  {renderWidget(block)}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* ── Drawer Ẩn/Hiện ────────────────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Ẩn hoặc hiện nội dung" className="w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-lg">Ẩn/Hiện nội dung</h3>
              <button onClick={() => setIsConfigOpen(false)} aria-label="Đóng" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"><X size={20} aria-hidden="true" /></button>
            </div>
            <div className="space-y-3 flex-1 overflow-auto custom-scrollbar">
              {widgets.map((b) => (
                <div key={b.i} className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-all", b.visible ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-60")}>
                  <span className="flex-1 text-sm font-bold truncate">{b.title}</span>
                  <button
                    onClick={() => toggleVisibility(b.i)}
                    aria-label={b.visible ? `Ẩn "${b.title}"` : `Hiện "${b.title}"`}
                    aria-pressed={b.visible}
                    className={cn("p-2.5 rounded-xl transition-colors cursor-pointer", b.visible ? "text-indigo-600 bg-indigo-100 hover:bg-indigo-200" : "text-slate-400 bg-slate-200 hover:bg-slate-300")}
                  >
                    {b.visible ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
              <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black hover:opacity-90 transition-all cursor-pointer">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Thư viện widget ───────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Thư viện widget" className="w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] shadow-2xl p-5 sm:p-7 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="min-w-0">
                <h3 className="font-black text-xl">Thư viện widget</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Chọn nội dung bạn muốn theo dõi trên trang chủ</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} aria-label="Đóng" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer shrink-0"><X size={24} aria-hidden="true" /></button>
            </div>

            <div className="relative mb-5">
              <Search size={16} aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm widget theo tên hoặc mô tả…"
                aria-label="Tìm widget"
                className="w-full min-h-[44px] pl-11 pr-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              />
            </div>

            {/* Bố cục gợi ý — lối tắt cho người không muốn tự dựng từng ô */}
            {presets?.length ? (
              <div className="mb-6">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Bố cục gợi ý</p>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPendingPreset(p)}
                      title={p.description}
                      className="min-h-[44px] px-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-bold hover:border-indigo-500 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Sparkles size={14} aria-hidden="true" /> {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex-1 overflow-auto pr-1 custom-scrollbar space-y-7">
              {groupedCatalog.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-12">Không tìm thấy widget nào khớp “{search}”.</p>
              )}
              {groupedCatalog.map(([groupLabel, entries]) => (
                <section key={groupLabel}>
                  <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">{groupLabel}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {entries.map(({ template, icon, description }) => {
                      // Chặn trùng theo id widget — nhiều widget có thể dùng chung một `type`
                      const isAdded = widgets.some(w => w.i === template.i)
                      return (
                        <button
                          key={template.i}
                          type="button"
                          // Thẻ là một công tắc: bấm để thêm, bấm lại để gỡ. Trước đây thẻ đã thêm
                          // bị disabled nên muốn bỏ chọn phải đóng thư viện rồi xoá ngoài lưới.
                          onClick={() => (isAdded ? deleteWidget(template.i) : addWidget(template))}
                          aria-pressed={isAdded}
                          className={cn(
                            "flex items-start gap-4 p-4 rounded-2xl border text-left transition-all group cursor-pointer",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                            isAdded
                              ? "bg-indigo-50/60 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-700"
                              : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-lg"
                          )}
                        >
                          <div className={cn(
                            "w-11 h-11 shrink-0 rounded-xl flex items-center justify-center",
                            isAdded
                              ? "bg-indigo-600 text-white"
                              : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600"
                          )}>
                            {isAdded ? <Check size={20} aria-hidden="true" /> : icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm text-slate-900 dark:text-white">{template.title}</p>
                            {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">{description}</p>}
                            {/* Nói rõ bấm lần nữa sẽ gỡ, để trạng thái "đã chọn" không thành ngõ cụt */}
                            <p className={cn(
                              "text-[10px] font-black uppercase tracking-wider mt-1.5",
                              isAdded ? "text-indigo-600 dark:text-indigo-400" : "text-transparent"
                            )}>
                              {isAdded ? 'Đã thêm · bấm để gỡ' : ' '}
                            </p>
                          </div>
                          {isAdded
                            ? <X size={16} aria-hidden="true" className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
                            : <Plus size={16} aria-hidden="true" className="text-slate-300 group-hover:text-indigo-600 transition-colors shrink-0 mt-1" />}
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                Đang hiển thị <span className="text-slate-900 dark:text-white">{widgets.length}</span> widget trên trang chủ
              </p>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="min-h-[44px] px-8 rounded-2xl bg-indigo-600 text-white font-black text-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 transition-colors cursor-pointer"
              >
                Xong
              </button>
            </div>
          </div>
        </div>
      )}

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

/** Nút icon trong thanh điều khiển widget — đủ 44px vùng chạm và có tên cho trình đọc màn hình. */
function ChromeIconButton({ label, onClick, danger, children }: {
  label: string; onClick: () => void; danger?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "min-w-[36px] min-h-[36px] md:min-w-[32px] md:min-h-[32px] flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 transition-colors cursor-pointer",
        danger
          ? "text-red-500 hover:text-white hover:bg-red-500 focus-visible:ring-red-500"
          : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 focus-visible:ring-indigo-500"
      )}
    >
      {children}
    </button>
  )
}
