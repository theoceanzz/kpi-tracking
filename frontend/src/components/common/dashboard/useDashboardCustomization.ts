import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { reportApi } from '@/features/reports/api/reportApi'
import type { WidgetType } from '@/types/datasource'
import type { DashboardWidget } from './ChartWrapper'

interface Options {
  /** Tên report dùng để lưu cấu hình lưới của tab (mỗi tab 1 tên riêng). */
  configReportName: string
  reportDescription?: string
  defaultWidgets: DashboardWidget[]
  /** Map loại widget (FE) → enum WidgetType hợp lệ ở DB (tránh sửa check-constraint). */
  toBackendWidgetType: (type: string) => WidgetType
  /** Xử lý thêm sau khi map từ report (migration/ép chiều cao…). Mặc định: đảm bảo mọi widget mặc định có mặt. */
  postProcess?: (mapped: DashboardWidget[], defaults: DashboardWidget[]) => DashboardWidget[]
}

/**
 * Toàn bộ state + logic cho lưới widget tuỳ chỉnh (kéo-thả/dãn, ẩn/hiện, thêm, ghim, lưu qua reportApi).
 * Dùng chung cho các tab thống kê. Loại thật của widget suy từ `i` (id) khi tải lên nên giá trị
 * widgetType lưu ở DB không ảnh hưởng hiển thị.
 */
export function useDashboardCustomization({
  configReportName, reportDescription, defaultWidgets, toBackendWidgetType, postProcess,
}: Options) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultWidgets)
  const [configReportId, setConfigReportId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const ensureDefaultsPresent = (mapped: DashboardWidget[]): DashboardWidget[] => {
    let result = [...mapped]
    defaultWidgets.forEach(def => {
      if (!result.some(w => w.i === def.i)) {
        const maxY = result.length ? Math.max(...result.map(w => w.y + w.h)) : 0
        result = [...result, { ...def, y: maxY }]
      }
    })
    return result
  }

  const mapWidgetsFromReport = (report: any): DashboardWidget[] => {
    if (!report.widgets || report.widgets.length === 0) return defaultWidgets
    const mapped = report.widgets.map((sw: any) => {
      try {
        const pos = JSON.parse(sw.position || '{}')
        const cfg = JSON.parse(sw.chartConfig || '{}')
        const def = defaultWidgets.find(dw => dw.i === cfg.i)
        return {
          ...(def || {}), ...pos, ...cfg, id: sw.id,
          // Loại thật suy từ id widget (def) — không tin widgetType lưu ở DB.
          i: cfg.i || sw.id, type: (def?.type ?? sw.widgetType),
          title: sw.title, visible: cfg.visible !== false, isPinned: sw.isPinned,
        } as DashboardWidget
      } catch { return null }
    }).filter(Boolean) as DashboardWidget[]
    return (postProcess ?? ensureDefaultsPresent)(mapped, defaultWidgets)
  }

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const reports = await reportApi.getAll({ size: 100 })
        const configReport = reports.content.find(r => r.name === configReportName)
        if (configReport) {
          setConfigReportId(configReport.id)
          setWidgets(mapWidgetsFromReport(configReport))
        }
      } catch (e) { console.error("Failed to load dashboard config", e) }
    }
    loadConfig()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configReportName])

  const saveConfig = async (): Promise<DashboardWidget[]> => {
    try {
      const widgetRequests = widgets.map((w, index) => ({
        id: w.id, widgetType: toBackendWidgetType(w.type), title: w.title,
        position: JSON.stringify({ x: w.x, y: w.y, w: w.w, h: w.h }),
        chartConfig: JSON.stringify({ i: w.i, visible: w.visible }),
        widgetOrder: index, isPinned: w.isPinned,
      }))
      let updatedReport
      if (configReportId) {
        updatedReport = await reportApi.update(configReportId, { widgets: widgetRequests })
      } else {
        const newReport = await reportApi.create({ name: configReportName, description: reportDescription ?? 'Cấu hình giao diện thống kê' })
        updatedReport = await reportApi.update(newReport.id, { widgets: widgetRequests })
        setConfigReportId(newReport.id)
      }
      const newWidgets = mapWidgetsFromReport(updatedReport)
      setWidgets(newWidgets)
      setIsEditMode(false)
      return newWidgets
    } catch (err) {
      console.error(err)
      toast.error("Không thể lưu cấu hình")
      throw err
    }
  }

  const toggleVisibility = (id: string) => setWidgets(prev => prev.map(b => b.i === id ? { ...b, visible: !b.visible } : b))
  // Xác nhận do DashboardEditToolbar hiển thị (ConfirmDialog) — không confirm() lần nữa ở đây.
  const resetLayout = () => setWidgets(defaultWidgets)
  const handleLayoutChange = (newLayout: any[]) => {
    setWidgets(prev => prev.map(item => {
      const updated = newLayout.find(l => l.i === item.i)
      return updated ? { ...item, x: updated.x, y: updated.y, w: updated.w, h: updated.h } : item
    }))
  }
  const deleteWidget = (i: string) => setWidgets(prev => prev.filter(w => w.i !== i))
  // Không đóng thư viện sau mỗi lần thêm — người dùng thường chọn vài cái một lượt.
  // Chặn trùng và tính `y` làm trong hàm cập nhật để bấm nhanh nhiều thẻ không bị chồng vị trí.
  const addWidget = (template: DashboardWidget) => {
    setWidgets(prev => {
      if (prev.some(w => w.i === template.i)) return prev
      const maxY = prev.length > 0 ? Math.max(...prev.map(w => w.y + w.h)) : 0
      return [...prev, { ...template, y: maxY, visible: true }]
    })
  }

  const handleTogglePin = async (widget: DashboardWidget) => {
    let targetWidgetId = widget.id
    if (!targetWidgetId) {
      try {
        const savedWidgets = await saveConfig()
        const found = savedWidgets.find(w => w.i === widget.i)
        if (found?.id) { targetWidgetId = found.id } else { toast.error("Không thể ghim: Lỗi khởi tạo cấu hình"); return }
      } catch { return }
    }
    try {
      const updated = await reportApi.togglePinWidget(targetWidgetId)
      setWidgets(prev => prev.map(w => w.id === targetWidgetId ? { ...w, isPinned: updated.isPinned } : w))
      queryClient.invalidateQueries({ queryKey: ['reports', 'widgets', 'pinned'] })
      toast.success(updated.isPinned ? "Đã ghim vào trang chủ" : "Đã bỏ ghim khỏi trang chủ")
    } catch (err) {
      console.error(err)
      toast.error("Không thể thay đổi trạng thái ghim")
    }
  }

  // Bố cục lưới theo breakpoint: lg/md giữ vị trí tùy chỉnh; sm/xs/xxs xếp chồng full-width.
  const visibleWidgets = widgets.filter(b => b.visible)
  const orderedVisible = [...visibleWidgets].sort((a, b) => a.y - b.y || a.x - b.x)
  const stackFull = (cols: number) => orderedVisible.map((w, i) => ({ i: w.i, x: 0, y: i, w: cols, h: w.h }))
  const gridLayouts = {
    lg: visibleWidgets, md: visibleWidgets,
    sm: stackFull(12), xs: stackFull(6), xxs: stackFull(4),
  }

  return {
    widgets, setWidgets,
    isEditMode, setIsEditMode,
    isConfigOpen, setIsConfigOpen,
    isAddModalOpen, setIsAddModalOpen,
    gridLayouts,
    saveConfig, handleTogglePin, addWidget, deleteWidget, toggleVisibility, resetLayout, handleLayoutChange,
  }
}
