import { useState, useMemo, useCallback } from 'react'
import { LayoutGrid, List as ListIcon, PlusCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useOrgUnitTree, useOrgHierarchyLevels, useDeleteOrgUnit } from '../hooks/useOrganizationStructure'
import type { OrgUnitTreeResponse } from '../types/org-unit'
import { OrgMindmapView } from '../components/OrgMindmapView'
import { OrgListView } from '../components/OrgListView'
import { OrgUnitDrawer, DrawerState } from '../components/OrgUnitDrawer'
import ConfirmDialog from '@/components/common/ConfirmDialog'

export function OrganizationStructurePage() {
  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId // Getting organizationId from the first membership for a director
  
  const { data: treeData = [], isLoading: isTreeLoading } = useOrgUnitTree(orgId)
  const { data: hierarchyLevelsData = [], isLoading: isLevelsLoading } = useOrgHierarchyLevels(orgId)
  const deleteMutation = useDeleteOrgUnit()
  
  const [viewMode, setViewMode] = useState<'mindmap' | 'list'>('mindmap')
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Cấu trúc Tổ chức</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý sơ đồ phân cấp phòng ban, chi nhánh</p>
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
