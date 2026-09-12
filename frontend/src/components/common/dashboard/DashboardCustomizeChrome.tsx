import React, { useMemo, useState } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import {
  Settings2, Save, RotateCcw, Plus, Layout, X, Eye, EyeOff, GripVertical, Trash2,
  ArrowUp, ArrowDown, MoveHorizontal, Search, LayoutGrid, Sparkles, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import EmptyState from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Dialog, Drawer, DialogFooter } from '@/components/ui/dialog'
import type { DashboardWidget } from './ChartWrapper'
import { ChoiceChip } from '@/components/ui/choice-chip'

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
        <div role="toolbar" aria-label="Tuỳ chỉnh trang chủ" className="flex flex-wrap items-center gap-1 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] p-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmReset(true)} aria-label="Đặt lại bố cục mặc định" title="Đặt lại mặc định"><RotateCcw aria-hidden="true" /></Button>
          <Button variant="ghost" size="sm" onClick={() => setIsConfigOpen(true)}><Layout aria-hidden="true" /> Ẩn/Hiện</Button>
          <Button variant="ghost" size="sm" onClick={() => setIsAddModalOpen(true)}><Plus aria-hidden="true" /> Thêm widget</Button>
          <span className="mx-1 h-4 w-px bg-[var(--color-border)]" aria-hidden="true" />
          <Button variant="ghost" size="sm" onClick={() => setIsEditMode(false)}>Hủy</Button>
          <Button size="sm" onClick={saveConfig}><Save aria-hidden="true" /> Lưu bố cục</Button>
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
    <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
      <Settings2 aria-hidden="true" /> Tuỳ chỉnh
    </Button>
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
        <div className={cn('relative min-h-[400px]', isEditMode && 'rounded-widget border-2 border-dashed border-[var(--color-border)] bg-[var(--color-muted)]')}>
          {isEditMode && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-30" aria-hidden="true">
              <div className="grid h-full w-full grid-cols-12 gap-4 px-2">
                {Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-full border-x border-[var(--color-border)]" />)}
              </div>
            </div>
          )}

          {/* Không còn widget nào hiện: nói rõ phải làm gì thay vì để trang trắng */}
          {visibleCount === 0 && (
            <EmptyState
              icon={LayoutGrid}
              title="Trang chủ đang trống"
              description="Bạn đã ẩn toàn bộ nội dung. Thêm widget cần theo dõi, hoặc dùng một bố cục gợi ý để bắt đầu nhanh."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => setIsAddModalOpen(true)}><Plus aria-hidden="true" /> Thêm widget</Button>
                  {presets?.length ? <Button variant="outline" onClick={() => setPendingPreset(presets[0] ?? null)}><Sparkles aria-hidden="true" /> Dùng bố cục gợi ý</Button> : null}
              </div>
              }
            />
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
                  'group relative h-full overflow-hidden rounded-widget',
                  isEditMode && 'ring-2 ring-transparent transition-shadow hover:ring-[var(--color-primary)]'
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
                  <div className="absolute right-2 top-2 z-[60] flex items-center gap-0.5 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] p-0.5 shadow-md">
                    <span className="drag-handle hidden cursor-move items-center gap-1 px-2 py-1 md:flex" aria-hidden="true">
                      <GripVertical size={14} className="text-[var(--color-muted-foreground)]" />
                      <span className="text-caption">Kéo</span>
                    </span>
                    {moveWidget && (
                      <>
                        <ChromeIconButton label={`Đưa "${block.title}" lên trên`} onClick={() => moveWidget(block.i, 'up')}><ArrowUp aria-hidden="true" /></ChromeIconButton>
                        <ChromeIconButton label={`Đưa "${block.title}" xuống dưới`} onClick={() => moveWidget(block.i, 'down')}><ArrowDown aria-hidden="true" /></ChromeIconButton>
                      </>
                    )}
                    {cycleWidth && (
                      <ChromeIconButton label={`Đổi bề rộng của "${block.title}"`} onClick={() => cycleWidth(block.i)}><MoveHorizontal aria-hidden="true" /></ChromeIconButton>
                    )}
                    <span className="mx-0.5 h-5 w-px bg-[var(--color-border)]" aria-hidden="true" />
                    <ChromeIconButton label={`Gỡ "${block.title}" khỏi trang`} onClick={() => deleteWidget(block.i)} danger>
                      <Trash2 aria-hidden="true" />
                    </ChromeIconButton>
                  </div>
                )}
                {/*
                  Lớp cuộn riêng: widget cao hơn ô thì cuộn TRONG ô thay vì bị cắt cụt.
                  Widget đã tự quản chiều cao (WidgetShell) luôn vừa khít nên lớp này không kích hoạt.
                  Khi chỉnh sửa thì tắt con trỏ để biểu đồ không giành hover/tooltip/mousedown.
                */}
                <div className={cn('custom-scrollbar h-full w-full overflow-y-auto', isEditMode && 'pointer-events-none')}>
                  {renderWidget(block)}
                </div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* ── Drawer Ẩn/Hiện ────────────────────────────────────────────────── */}
      <Drawer
        open={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        size="sm"
        title="Ẩn / hiện widget"
        description={`${visibleCount} / ${widgets.length} đang hiển thị`}
        footer={<DialogFooter primary={<Button onClick={() => setIsConfigOpen(false)}>Xong</Button>} />}
      >
        <ul className="space-y-1">
              {widgets.map((b) => (
            <li key={b.i} className="flex h-10 items-center gap-3 rounded-control px-2 hover:bg-[var(--color-muted)]">
              <span className={cn('min-w-0 flex-1 truncate text-sm', b.visible ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]')} title={b.title}>{b.title}</span>
              <Button
                variant="ghost" size="icon-sm"
                    onClick={() => toggleVisibility(b.i)}
                    aria-label={b.visible ? `Ẩn "${b.title}"` : `Hiện "${b.title}"`}
                    aria-pressed={b.visible}
                className={cn(b.visible ? 'text-[var(--color-primary)]' : 'text-[var(--color-subtle-foreground)]')}
                  >
                {b.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              </Button>
            </li>
              ))}
        </ul>
      </Drawer>

      {/* ── Thư viện widget ───────────────────────────────────────────────── */}
      <Dialog
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        size="xl"
        title="Thư viện widget"
        description="Chọn nội dung bạn muốn theo dõi trên trang chủ. Bấm lại một thẻ đã thêm để gỡ."
        footer={
          <DialogFooter
            note={<span className="tabular-nums">{widgets.length} widget trên trang chủ</span>}
            primary={<Button onClick={() => setIsAddModalOpen(false)}>Xong</Button>}
          />
        }
      >
        <div className="space-y-5">
          <label className="relative flex h-9 items-center">
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 text-[var(--color-muted-foreground)]" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm widget theo tên hoặc mô tả…"
                aria-label="Tìm widget"
              className="h-9 w-full rounded-control border border-[var(--color-input)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-ring)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
              />
          </label>

            {/* Bố cục gợi ý — lối tắt cho người không muốn tự dựng từng ô */}
            {presets?.length ? (
            <div>
              <p className="text-eyebrow mb-2">Bố cục gợi ý</p>
                <div className="flex flex-wrap gap-2">
                  {presets.map(p => (
                  <Button key={p.key} variant="outline" size="sm" onClick={() => setPendingPreset(p)} title={p.description}>
                    <Sparkles aria-hidden="true" /> {p.label}
                  </Button>
                  ))}
                </div>
              </div>
            ) : null}

              {groupedCatalog.length === 0 && (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">Không tìm thấy widget nào khớp “{search}”.</p>
              )}
              {groupedCatalog.map(([groupLabel, entries]) => (
                <section key={groupLabel}>
              <h3 className="text-eyebrow mb-2">{groupLabel}</h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    {entries.map(({ template, icon, description }) => {
                      // Chặn trùng theo id widget — nhiều widget có thể dùng chung một `type`
                      const isAdded = widgets.some(w => w.i === template.i)
                      return (
                        <ChoiceChip selected={isAdded} className="text-left" key={template.i} onClick={() => (isAdded ? deleteWidget(template.i) : addWidget(template))} aria-pressed={isAdded}>
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-control [&_svg]:size-[18px]', isAdded ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]' : 'bg-[var(--color-muted)] text-[var(--color-primary)]')} aria-hidden="true">
                        {isAdded ? <Check /> : icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-[var(--color-foreground)]">{template.title}</span>
                        {description && <span className="mt-0.5 block text-caption">{description}</span>}
                        {isAdded && <span className="mt-1 block text-caption text-[var(--color-primary)]">Đã thêm · bấm để gỡ</span>}
                      </span>
                          {isAdded
                        ? <X aria-hidden="true" className="mt-1 shrink-0 text-[var(--color-primary)] opacity-0 transition-opacity group-hover:opacity-100" />
                        : <Plus aria-hidden="true" className="mt-1 shrink-0 text-[var(--color-subtle-foreground)] transition-colors group-hover:text-[var(--color-foreground)]" />}
                        </ChoiceChip>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
      </Dialog>

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

/** Nút icon trong thanh điều khiển widget — 32px, có tên cho trình đọc màn hình. */
function ChromeIconButton({ label, onClick, danger, children }: {
  label: string; onClick: () => void; danger?: boolean; children: React.ReactNode
}) {
  return (
    <Button
      variant="ghost" size="icon-sm"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(danger && 'text-[var(--color-error)] hover:bg-[var(--color-error-bg)]')}
    >
      {children}
    </Button>
  )
}
