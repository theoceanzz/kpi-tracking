import { useState, useEffect, useMemo } from 'react'
import { 
  X, 
  ChevronRight, 
  Lock, 
  CheckSquare, 
  Square,
  Loader2,
  Save,
  ShieldCheck,
  Search,
  Zap
} from 'lucide-react'
import { useAllPermissions, useRolePermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { useRoles } from '../hooks/useRoles'
import { RoleResponse } from '../api/role.api'
import { permissionApi } from '../api/permission.api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface RolePermissionDrawerProps {
  role: RoleResponse | null
  isOpen: boolean
  onClose: () => void
}

export default function RolePermissionDrawer({ role, isOpen, onClose }: RolePermissionDrawerProps) {
  const { data: allPermissions = [], isLoading: isLoadingAll } = useAllPermissions()
  const { data: rolePermissions, isLoading: isLoadingRole } = useRolePermissions(role?.id)
  const { data: roles = [] } = useRoles()
  const updateMutation = useUpdateRolePermissions()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // Sync role permissions to local state when loaded
  useEffect(() => {
    if (!isOpen) {
      setSelectedIds(new Set())
      return
    }

    if (rolePermissions) {
      setSelectedIds(new Set(rolePermissions.map(p => p.id)))
    } else {
      setSelectedIds(new Set())
    }
  }, [rolePermissions, isOpen])

  // Group permissions by resource
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, typeof allPermissions> = {}
    allPermissions
      .filter(p => (p.code?.toLowerCase() || '').includes(searchQuery.toLowerCase()) || (p.resource?.toLowerCase() || '').includes(searchQuery.toLowerCase()))
      .forEach(p => {
        const resource = p.resource || 'CHƯA PHÂN LOẠI'
        if (!groups[resource]) {
          groups[resource] = []
        }
        groups[resource].push(p)
      })
    return groups
  }, [allPermissions, searchQuery])

  const togglePermission = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleResource = (_resource: string, permissions: typeof allPermissions) => {
    const next = new Set(selectedIds)
    const allIds = permissions.map(p => p.id)
    const isAllSelected = allIds.every(id => next.has(id))

    if (isAllSelected) {
      allIds.forEach(id => next.delete(id))
    } else {
      allIds.forEach(id => next.add(id))
    }
    setSelectedIds(next)
  }

  const handleSave = async () => {
    if (!role) return
    await updateMutation.mutateAsync({
      roleId: role.id,
      permissionIds: Array.from(selectedIds)
    })
    onClose()
  }

  const applyDefaults = async () => {
    if (!role) return;
    
    // Logic: Rank 0 -> Take from rank 0 level 1. Rank 1 -> Take from rank 1 level 1.
    const targetRank = role.rank;
    if (targetRank === undefined || targetRank > 1) {
      toast.info('Tính năng này chỉ áp dụng cho vai trò Trưởng hoặc Phó.');
      return;
    }

    const refRole = roles.find(r => r.rank === targetRank && r.level === 1);
    
    if (!refRole) {
      toast.error(`Không tìm thấy vai trò ${targetRank === 0 ? 'Trưởng' : 'Phó'} cấp 1 mẫu để sao chép quyền.`);
      return;
    }

    try {
      const perms = await permissionApi.getRolePermissions(refRole.id);
      setSelectedIds(new Set(perms.map(p => p.id)));
      toast.success(`Đã áp dụng quyền hạn mặc định từ "${refRole.name}"`);
    } catch (err) {
      toast.error('Có lỗi xảy ra khi lấy quyền hạn mặc định.');
    }
  };

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[120] flex justify-end">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Drawer Content */}
      <div className="relative w-full max-w-2xl bg-white h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-500 ease-out">
        {/* Header */}
        <div className="p-8 border-b bg-gradient-to-r from-gray-50 to-white flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 tracking-tight flex items-center">
                Thiết lập Phân quyền
              </h3>
              <p className="text-sm text-gray-500 font-bold flex items-center mt-0.5">
                <ChevronRight className="w-3 h-3 mx-1 text-gray-400" />
                Vai trò: <span className="text-indigo-600 ml-1 uppercase">{role?.name}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={applyDefaults}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-100 transition-all font-black text-[10px] uppercase tracking-wider shadow-sm"
            >
              <Zap size={14} fill="currentColor" /> Áp dụng quyền mặc định
            </button>
            <button 
              onClick={onClose}
              className="p-3 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-2xl transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-6 border-b bg-white">
          <div className="relative group">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm quyền hạn hoặc tài nguyên..." 
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-indigo-600 transition-all font-bold text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-gray-50/30">
          {(isLoadingAll || isLoadingRole) ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <p className="text-gray-500 font-bold animate-pulse">Đang nạp dữ liệu phân quyền...</p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([resource, permissions]) => {
              const allIds = permissions.map(p => p.id)
              const selectedCount = allIds.filter(id => selectedIds.has(id)).length
              const isAllSelected = selectedCount === allIds.length

              return (
                <div key={resource} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                  <div className="p-6 border-b bg-gray-50/50 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-4 h-4 text-gray-400" />
                      <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">{resource}</h4>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-full">
                        {selectedCount}/{allIds.length}
                      </span>
                    </div>
                    <button 
                      onClick={() => toggleResource(resource, permissions)}
                      className="text-[10px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-tighter"
                    >
                      {isAllSelected ? 'Hủy chọn tất cả' : 'Chọn tất cả'}
                    </button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map(p => (
                      <button
                        key={p.id}
                        onClick={() => togglePermission(p.id)}
                        className={cn(
                          "flex items-center space-x-3 px-4 py-3 rounded-2xl border transition-all text-left",
                          selectedIds.has(p.id) 
                            ? "bg-indigo-50/50 border-indigo-200 text-indigo-900 shadow-sm" 
                            : "bg-white border-gray-100 text-gray-600 hover:border-gray-200"
                        )}
                      >
                        {selectedIds.has(p.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300 shrink-0" />
                        )}
                        <div>
                          <div className="text-sm font-bold truncate tracking-tight">{p.code}</div>
                          <div className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{p.action}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-8 border-t bg-white flex items-center justify-between space-x-4">
          <div className="text-sm">
            <span className="text-gray-400 font-bold">Đã chọn:</span>
            <span className="text-indigo-600 font-black ml-2">{selectedIds.size} quyền hạn</span>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={onClose}
              className="px-8 py-3.5 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-100 font-black transition-all shadow-sm"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center"
            >
              {updateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : (
                <Save className="w-5 h-5 mr-2" />
              )}
              Lưu phân quyền
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
