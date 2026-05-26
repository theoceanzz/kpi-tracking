import { useState, useMemo, useCallback } from 'react'
import { LayoutGrid, List as ListIcon, PlusCircle, Download, Upload, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree, useOrgHierarchyLevels, useDeleteOrgUnit, useImportOrgUnits } from '../hooks/useOrganizationStructure'
import type { OrgUnitTreeResponse } from '../types/org-unit'
import { OrgMindmapView } from '../components/OrgMindmapView'
import { OrgListView } from '../components/OrgListView'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'
import OrgImportGuideModal from '../components/OrgImportGuideModal'
import OrgExcelPreviewModal from '../components/OrgExcelPreviewModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import PageTour from '@/components/common/PageTour'
import { orgStructureSteps } from '@/components/common/tourSteps'
import { } from 'xlsx'
import ExcelJS from 'exceljs'
import { toast } from 'sonner'
import { orgUnitApi } from '../api/org-unit.api'
import { useRef } from 'react'

export function OrganizationStructurePage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId // Getting organizationId from the first membership for a director
  
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
    return <div className="p-8 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
  }

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl shadow-sm border text-center">
        <h2 className="text-xl font-semibold mb-2">Lỗi truy cập</h2>
        <p className="text-gray-500">Tài khoản của bạn không thuộc tổ chức nào.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 container mx-auto px-4 md:px-0">
      <PageTour pageKey="org-structure" steps={orgStructureSteps} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Cấu trúc Tổ chức</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý sơ đồ phân cấp phòng ban, chi nhánh</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".xlsx,.xls,.csv" 
            onChange={handleFileChange} 
          />
          <button
            onClick={() => setShowImportGuide(true)}
            disabled={importMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {importMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} className="text-emerald-500" />}
            Import Hệ thống
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 text-blue-700 text-sm font-bold hover:bg-blue-100 hover:border-blue-300 transition-all shadow-sm active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} className="text-blue-500" />}
            Xuất Excel
          </button>
        </div>
        
        {treeData.length > 0 && (
          <div id="tour-org-view-mode" className="flex items-center space-x-2 bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
            <button 
              onClick={() => setViewMode('mindmap')}
              className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'mindmap' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Sơ đồ
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <ListIcon className="w-4 h-4 mr-2" />
              Danh sách
            </button>
          </div>
        )}
      </div>

      {!treeData || treeData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl shadow-sm border text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
            <LayoutGrid className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Bạn chưa có tổ chức nào.</h2>
          <p className="text-gray-500 mb-6 max-w-md">Hãy tạo thành phần tổ chức gốc (Ví dụ: Tên công ty) để bắt đầu xây dựng sơ đồ phân cấp.</p>
          <button 
            onClick={handleCreateRoot}
            className="flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
          >
            <PlusCircle className="w-5 h-5 mr-2" />
            Tạo tổ chức gốc
          </button>
        </div>
      ) : (
        <div id="tour-org-content" className="fade-in">
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
