import { useState, useMemo, useCallback } from 'react'
import { LayoutGrid, List as ListIcon, PlusCircle, Download, Upload, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { usePageTitle } from '../hooks/usePageTitle'
import { useOrgUnitTree, useOrgHierarchyLevels, useDeleteOrgUnit, useImportOrgUnits } from '../hooks/useOrganizationStructure'
import type { OrgUnitTreeResponse } from '../types/org-unit'
import { OrgMindmapView } from '../components/OrgMindmapView'
import { OrgListView } from '../components/OrgListView'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'
import OrgImportGuideModal from '../components/OrgImportGuideModal'
import OrgExcelPreviewModal from '../components/OrgExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { } from 'xlsx'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'
import { orgUnitApi } from '../api/org-unit.api'
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import { SegmentedControl } from '@/components/common/FilterBar'
import EmptyState from '@/components/common/EmptyState'

export function OrganizationStructurePage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId // Getting organizationId from the first membership for a director

  const pageTitle = usePageTitle('org-structure', 'Sơ đồ tổ chức')

  const { data: treeData = [], isLoading: isTreeLoading } = useOrgUnitTree(orgId)
  const { data: hierarchyLevelsData = [], isLoading: isLevelsLoading } = useOrgHierarchyLevels(orgId)
  const deleteMutation = useDeleteOrgUnit()
  const importMutation = useImportOrgUnits()

  const [viewMode, setViewMode] = useState<'mindmap' | 'list'>('mindmap')
  const [isExporting, setIsExporting] = useState(false)
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [previewFile, setPreviewFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [drawerState, setDrawerState] = useState<DrawerState>({
    isOpen: false,
    mode: 'create-root',
    parentNode: null,
    currentNode: null
  })

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; unitId: string | null }>({
    isOpen: false,
    unitId: null
  })

  const maxDepth = useMemo(() => {
    if (!hierarchyLevelsData.length) return 1
    return Math.max(...hierarchyLevelsData.map(l => l.levelOrder))
  }, [hierarchyLevelsData])

  const hierarchyLevelsMap = useMemo(() => {
    const map: Record<number, string> = {}
    hierarchyLevelsData.forEach(l => {
      map[l.levelOrder] = l.unitTypeName
    })
    return map
  }, [hierarchyLevelsData])

  const handleCreateRoot = useCallback(() => {
    setDrawerState({
      isOpen: true,
      mode: 'create-root',
      parentNode: null,
      currentNode: null
    })
  }, [])

  const handleAddChild = useCallback((id: string, name: string, level: number) => {
    setDrawerState({
      isOpen: true,
      mode: 'create-child',
      parentNode: { id, name, level },
      currentNode: null
    })
  }, [])

  const handleEdit = useCallback((node: OrgUnitTreeResponse) => {
    setDrawerState({
      isOpen: true,
      mode: 'edit',
      parentNode: null,
      currentNode: node
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setDeleteConfirm({ isOpen: true, unitId: id })
  }, [])

  const handleConfirmDelete = async () => {
    if (orgId && deleteConfirm.unitId) {
      deleteMutation.mutate({ orgId, unitId: deleteConfirm.unitId }, {
        onSuccess: () => {
          setDeleteConfirm({ isOpen: false, unitId: null })
        }
      })
    }
  }

  const handleCloseDrawer = useCallback(() => {
    setDrawerState(prev => ({ ...prev, isOpen: false }))
  }, [])

  const handleExport = async () => {
    if (!orgId) return
    setIsExporting(true)
    try {
      const data = await orgUnitApi.exportUnits(orgId)

      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet("Sơ đồ tổ chức")

      // Define columns
      worksheet.columns = [
        { header: "Name", key: "name", width: 35 },
        { header: "Code", key: "code", width: 15 },
        { header: "ParentCode", key: "parentCode", width: 15 },
        { header: "Email", key: "email", width: 25 },
        { header: "Phone", key: "phone", width: 15 },
        { header: "Address", key: "address", width: 40 }
      ]

      // Add data
      data.forEach(item => {
        worksheet.addRow({
          name: item.name,
          code: item.code,
          parentCode: item.parentCode,
          email: item.email,
          phone: item.phone,
          address: item.address
        })
      })

      // Style Header
      const headerRow = worksheet.getRow(1)
      headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '4F46E5' } // Indigo-600
      }
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Add borders and cell styling
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
          if (rowNumber > 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' }
          }
        })
      })

      // Generate buffer and download
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `So_do_to_chuc_${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`
      anchor.click()
      window.URL.revokeObjectURL(url)

      toast.success("Xuất file thành công")
    } catch (error) {
      console.error(error)
      toast.error("Xuất file thất bại")
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setPreviewFile(file)
    }
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  const handleConfirmImport = (file: File) => {
    if (orgId) {
      importMutation.mutate({ orgId, file })
    }
    setPreviewFile(null)
  }

  if (isTreeLoading || isLevelsLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-info-border)]"></div></div>
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[var(--color-card)] rounded-card shadow-sm border text-center">
        <h2 className="text-section-title mb-2">Lỗi truy cập</h2>
        <p className="text-[var(--color-muted-foreground)]">Tài khoản của bạn không thuộc tổ chức nào.</p>
      </div>
    )
  }

  // Chế độ Sơ đồ: ép trang lấp đúng chiều cao <main> để canvas tự vừa khung, không sinh cuộn.
  // Chế độ Danh sách: giữ luồng cuộn tự nhiên vì danh sách có thể dài.
  // Trước đây trang tự lấp đầy chiều cao <main>. Giờ nó là một mục trong trang
  // "Thiết lập công ty" nên không còn tầng cha nào có chiều cao xác định để bám vào —
  // canvas tự đặt chiều cao theo viewport.
  const fitToScreen = false

  return (
    <div className={`mx-auto max-w-[1600px] ${fitToScreen ? 'flex h-full flex-col gap-4' : 'space-y-4'}`}>
      <WorkspaceHeader
        id="tour-org-header"
        title={pageTitle}
        description="Sơ đồ phân cấp phòng ban, chi nhánh. Bấm một đơn vị để xem thành viên và đơn vị trực thuộc."
        className="shrink-0"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx,.xls,.csv" onChange={handleFileChange} />
            <Button variant="outline" onClick={() => setShowImportGuide(true)} disabled={importMutation.isPending}>
              {importMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
              Nhập Excel
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Download aria-hidden="true" />}
              Xuất Excel
            </Button>
            {treeData.length > 0 && (
              <div id="tour-org-view-mode">
                <SegmentedControl ariaLabel="Dạng hiển thị" value={viewMode} onChange={setViewMode}
                  options={[
                    { value: 'mindmap', label: <><LayoutGrid aria-hidden="true" /> Sơ đồ</>, title: 'Sơ đồ' },
                    { value: 'list', label: <><ListIcon aria-hidden="true" /> Danh sách</>, title: 'Danh sách' },
                  ]} />
              </div>
            )}
          </div>
        }
      />

      {!treeData || treeData.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)] bg-[var(--color-card)]">
          <EmptyState
            icon={LayoutGrid}
            title="Chưa có đơn vị nào"
            description="Tạo đơn vị gốc (thường là tên công ty) rồi thêm các phòng ban, chi nhánh bên dưới."
            action={<Button onClick={handleCreateRoot}><PlusCircle aria-hidden="true" /> Tạo đơn vị gốc</Button>}
          />
        </div>
      ) : (
        <div id="tour-org-content" className={`fade-in ${fitToScreen ? 'flex-1 min-h-0' : ''}`}>
          {viewMode === 'mindmap' ? (
            <OrgMindmapView
              data={treeData}
              maxDepth={maxDepth}
              onAddChild={handleAddChild}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ) : (
            <OrgListView
              data={treeData}
              maxDepth={maxDepth}
              onAddChild={handleAddChild}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {showImportGuide && (
        <OrgImportGuideModal
          open={showImportGuide}
          onClose={() => setShowImportGuide(false)}
          onSelectFile={() => fileInputRef.current?.click()}
        />
      )}

      {previewFile && orgId && (
        <OrgExcelPreviewModal
          open={!!previewFile}
          file={previewFile}
          orgId={orgId}
          onClose={() => setPreviewFile(null)}
          onImport={handleConfirmImport}
          isImporting={importMutation.isPending}
          hierarchyLevels={hierarchyLevelsMap}
        />
      )}

      {drawerState.isOpen && (
        <OrgUnitDrawer
          orgId={orgId}
          drawerState={drawerState}
          onClose={handleCloseDrawer}
          hierarchyLevels={hierarchyLevelsMap}
        />
      )}

      <ConfirmDialog
        open={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, unitId: null })}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xoá"
        description="Bạn có chắc chắn muốn xoá thành phần tổ chức này không? Hành động này không thể hoàn tác."
        confirmLabel="Xoá ngay"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
