import React from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import {
  Settings2, Save, RotateCcw, Plus, Layout, X, Eye, EyeOff, GripVertical, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardWidget } from './ChartWrapper'
import type { useDashboardCustomization } from './useDashboardCustomization'

const ResponsiveGridLayout = WidthProvider(Responsive)

type CustomizationApi = ReturnType<typeof useDashboardCustomization>

/** Cụm nút "Tuỳ chỉnh / Lưu / Ẩn-Hiện / Thêm / Đặt lại" — đặt tuỳ ý trong header của tab. */
export function DashboardEditToolbar({ api }: { api: CustomizationApi }) {
  const { isEditMode, setIsEditMode, setIsConfigOpen, setIsAddModalOpen, saveConfig, resetLayout } = api
  if (isEditMode) {
    return (
      <div className="flex flex-wrap items-center gap-2 bg-indigo-50 dark:bg-indigo-900/20 p-1 rounded-xl border border-indigo-100 dark:border-indigo-800">
        <button onClick={resetLayout} className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400" title="Đặt lại mặc định"><RotateCcw size={18} /></button>
        <button onClick={() => setIsConfigOpen(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2"><Layout size={14} /> Ẩn/Hiện</button>
        <button onClick={() => setIsAddModalOpen(true)} className="px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg flex items-center gap-2"><Plus size={14} /> Thêm biểu đồ</button>
        <div className="w-px h-4 bg-indigo-200 dark:bg-indigo-800 mx-1" />
        <button onClick={() => setIsEditMode(false)} className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700">Huỷ</button>
        <button onClick={saveConfig} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-2"><Save size={14} /> Lưu</button>
      </div>
    )
  }
  return (
    <button onClick={() => setIsEditMode(true)} className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 shadow-sm transition-all">
      <Settings2 size={16} /> Tuỳ chỉnh
    </button>
  )
}

interface Props {
  api: CustomizationApi
  renderWidget: (w: DashboardWidget) => React.ReactNode
  /** Danh mục widget để "Thêm biểu đồ" (mỗi mục: template + icon hiển thị). */
  catalog: { template: DashboardWidget; icon: React.ReactNode }[]
  /** Gate hiển thị lưới (vd chờ dữ liệu chính). Mặc định true. */
  ready?: boolean
}

/**
 * Vùng lưới widget tuỳ chỉnh: lưới react-grid-layout (kéo-thả/dãn) + drawer Ẩn/Hiện + modal Thêm biểu đồ.
 * Thanh công cụ tách riêng ở {@link DashboardEditToolbar} để tab tự đặt vào header.
 */
export default function DashboardCustomizeChrome({ api, renderWidget, catalog, ready = true }: Props) {
  const {
    widgets, isEditMode, setIsConfigOpen, isConfigOpen, isAddModalOpen, setIsAddModalOpen,
    gridLayouts, addWidget, deleteWidget, toggleVisibility, handleLayoutChange,
  } = api

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
            onLayoutChange={(current, all) => { if (isEditMode) { if (all.lg) handleLayoutChange(all.lg as any); else handleLayoutChange(current as any) } }}
            margin={[16, 16]}
          >
            {widgets.filter(b => b.visible).map((block) => (
              <div key={block.i} className={cn("relative group h-full", isEditMode && "ring-2 ring-transparent hover:ring-indigo-500 rounded-[24px] transition-all overflow-visible")}>
                {isEditMode && (
                  <>
                    <div className="drag-handle absolute top-2 left-1/2 -translate-x-1/2 opacity-70 group-hover:opacity-100 z-[60] cursor-move bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3 py-1 rounded-full shadow-lg flex items-center gap-1 transition-opacity">
                      <GripVertical size={14} className="text-slate-400" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kéo</span>
                    </div>
                    <button onClick={() => deleteWidget(block.i)} className="absolute -top-2 -right-2 opacity-70 group-hover:opacity-100 z-[60] bg-red-500 text-white p-1.5 rounded-xl shadow-lg hover:bg-red-600 transition-all"><Trash2 size={14} /></button>
                  </>
                )}
                {/* Khi chỉnh sửa: tắt con trỏ trên nội dung để biểu đồ không giành hover/tooltip/mousedown. */}
                <div className={cn("h-full w-full", isEditMode && "pointer-events-none")}>{renderWidget(block)}</div>
              </div>
            ))}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* ── Drawer Ẩn/Hiện ────────────────────────────────────────────────── */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/40 backdrop-blur-sm" onClick={() => setIsConfigOpen(false)}>
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 h-full shadow-2xl p-6 flex flex-col animate-in slide-in-from-right" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <h3 className="font-black text-lg">Ẩn/Hiện nội dung</h3>
              <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><X size={20} /></button>
            </div>
            <div className="space-y-3 flex-1 overflow-auto custom-scrollbar">
              {widgets.map((b) => (
                <div key={b.i} className={cn("flex items-center gap-3 p-4 rounded-2xl border transition-all", b.visible ? "border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-900/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-60")}>
                  <span className="flex-1 text-sm font-bold truncate">{b.title}</span>
                  <button onClick={() => toggleVisibility(b.i)} className={cn("p-2 rounded-xl transition-colors", b.visible ? "text-indigo-600 bg-indigo-100 hover:bg-indigo-200" : "text-slate-400 bg-slate-200 hover:bg-slate-300")}>
                    {b.visible ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
              ))}
            </div>
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-auto">
              <button onClick={() => setIsConfigOpen(false)} className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black hover:opacity-90 transition-all">Đóng</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Thêm biểu đồ ────────────────────────────────────────────── */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setIsAddModalOpen(false)}>
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 rounded-[28px] sm:rounded-[32px] shadow-2xl p-5 sm:p-8 animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="font-black text-xl">Thêm biểu đồ phân tích</h3>
                <p className="text-xs font-bold text-slate-400 mt-1">Chọn từ các biểu đồ có sẵn trong hệ thống</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"><X size={24} /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-auto pr-2 custom-scrollbar">
              {catalog.map(({ template, icon }) => {
                const isAlreadyAdded = widgets.some(w => w.type === template.type)
                return (
                  <button key={template.i} disabled={isAlreadyAdded} onClick={() => addWidget(template)}
                    className={cn("flex items-center gap-4 p-5 rounded-2xl border text-left transition-all group", isAlreadyAdded ? "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-50 cursor-not-allowed" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-xl hover:-translate-y-1")}
                  >
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", isAlreadyAdded ? "bg-slate-200 text-slate-400" : "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 group-hover:scale-110 transition-transform")}>
                      {icon}
                    </div>
                    <div className="flex-1">
                      <p className="font-black text-sm text-slate-900 dark:text-white">{template.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{isAlreadyAdded ? 'Đã thêm' : 'Sẵn có'}</p>
                    </div>
                    {!isAlreadyAdded && <Plus size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-8 flex justify-end">
              <button onClick={() => setIsAddModalOpen(false)} className="px-8 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 font-black text-sm hover:bg-slate-200 transition-all">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
