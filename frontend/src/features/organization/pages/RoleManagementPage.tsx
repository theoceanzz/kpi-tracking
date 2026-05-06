import { useState, useMemo } from 'react'
import { 
  Shield, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck,
  AlertCircle,
  Loader2,
  Key,
  Layers,
  Filter,
  History,
  Lock,
  ArrowRight,
  MoreVertical,
  Zap
} from 'lucide-react'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../hooks/useRoles'
import { useOrgHierarchyLevels } from '../hooks/useOrganizationStructure'
import { useAuthStore } from '@/store/authStore'
import { RoleResponse } from '../api/role.api'
import RolePermissionDrawer from '../components/RolePermissionDrawer'
import HierarchyPermissionModal from '../components/HierarchyPermissionModal'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ROLE_MAP } from '@/constants/roles'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export default function RoleManagementPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPermissionDrawerOpen, setIsPermissionDrawerOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<RoleResponse | null>(null)
  const [selectedRoleForPerms, setSelectedRoleForPerms] = useState<RoleResponse | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; role: RoleResponse | null }>({
    isOpen: false,
    role: null
  })
  const [isHierarchyModalOpen, setIsHierarchyModalOpen] = useState(false)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const [formData, setFormData] = useState<{ name: string; level: number; rank: number }>({ 
    name: '', 
    level: 2,
    rank: 2
  })
  
  const { data: roles = [], isLoading } = useRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const { user } = useAuthStore()
  const orgId = user?.memberships?.[0]?.organizationId
  const { data: hierarchyLevels = [] } = useOrgHierarchyLevels(orgId)

  const filteredRoles = useMemo(() => {
    // Get unique role levels from organization hierarchy
    const activeRoleLevels = new Set(hierarchyLevels.map(l => l.roleLevel))
    
    return roles.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (ROLE_MAP[r.name] || '').toLowerCase().includes(searchQuery.toLowerCase())
      if (!matchesSearch) return false

      if (activeRoleLevels.size > 0) {
        // Only show roles that belong to the active hierarchy levels
        if (r.isSystem && r.name === 'DIRECTOR_SYSTEM') return false
        
        if (r.level === undefined) return false
        return activeRoleLevels.has(r.level as number)
      }
      return true
    })
  }, [roles, hierarchyLevels, searchQuery])
  
  const getLevelInfo = (level: number | undefined) => {
    if (level === undefined) return { label: 'N/A', color: 'gray' }
    const hl = hierarchyLevels.find(l => l.roleLevel === level)
    if (!hl) return { label: 'Khác', color: 'gray' }
    
    // Determine relative position for colors
    const levels = [...new Set(hierarchyLevels.map(l => l.roleLevel))].sort((a, b) => a - b)
    const index = levels.indexOf(level)
    
    if (index === 0) return { label: hl.unitTypeName, color: 'rose' }
    if (index === levels.length - 1) return { label: hl.unitTypeName, color: 'emerald' }
    return { label: hl.unitTypeName, color: 'amber' }
  }

  // Stats calculation
  const stats = useMemo(() => ({
    total: filteredRoles.length,
    system: filteredRoles.filter(r => r.isSystem).length,
    custom: filteredRoles.filter(r => !r.isSystem).length,
    highLevel: filteredRoles.filter(r => r.level === 0).length
  }), [filteredRoles])



  const handleOpenModal = (role?: RoleResponse) => {
    if (role) {
      setEditingRole(role)
      setFormData({ 
        name: role.name, 
        level: role.level ?? 2,
        rank: role.rank ?? 2
      })
    } else {
      setEditingRole(null)
      setFormData({ name: '', level: 2, rank: 2 })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Vui lòng nhập tên vai trò')
      return
    }

    // Validation: 1 level can only have 1 rank 0 and 1 rank 1
    if (formData.rank !== 2) {
      const duplicate = roles.find(r => 
        r.level === formData.level && 
        r.rank === formData.rank && 
        r.id !== editingRole?.id
      )
      if (duplicate) {
        const rankName = formData.rank === 0 ? "TRƯỞNG (Rank 0)" : "PHÓ (Rank 1)"
        toast.error(`Mỗi phân cấp chỉ được phép có tối đa 1 ${rankName}. Hiện tại đã có vai trò "${duplicate.name}" ở phân cấp này.`)
        return
      }
    }
    try {
        if (editingRole) {
        await updateMutation.mutateAsync({
          roleId: editingRole.id,
          payload: { 
            name: formData.name, 
            level: formData.level, 
            rank: formData.rank
          }
        })
      } else {
        await createMutation.mutateAsync({ 
          name: formData.name, 
          level: formData.level, 
          rank: formData.rank
        })
      }
      setIsModalOpen(false)
    } catch (error) {}
  }

  const handleDelete = (role: RoleResponse) => {
    if (role.isSystem) return
    setDeleteConfirm({ isOpen: true, role })
  }

  const handleConfirmDelete = async () => {
    if (deleteConfirm.role) {
      try {
        await deleteMutation.mutateAsync(deleteConfirm.role.id)
        setDeleteConfirm({ isOpen: false, role: null })
      } catch (error) {}
    }
  }

  const handleOpenPermissions = (role: RoleResponse) => {
    setSelectedRoleForPerms(role)
    setIsPermissionDrawerOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-700 rounded-[2.5rem] p-8 md:p-12 shadow-2xl shadow-indigo-200/50">
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-48 h-48 bg-indigo-400/20 rounded-full blur-2xl" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white/80 text-[10px] font-bold uppercase tracking-widest mb-4">
              <Shield size={12} className="text-indigo-200" />
              Bảo mật & Phân quyền
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
              Quản lý <span className="text-indigo-200">Vai trò</span>
            </h1>
            <p className="text-indigo-100/80 font-medium mt-3 max-w-xl text-lg">
              Thiết lập hệ thống phân cấp và ma trận quyền hạn cho toàn bộ nhân sự trong tổ chức của bạn.
            </p>
          </div>
          
          <div className="flex flex-col xl:flex-row items-center gap-4 shrink-0">
            <button 
              onClick={() => setIsHierarchyModalOpen(true)}
              className="group flex items-center justify-center gap-3 px-6 py-4 bg-white/10 text-white border border-white/20 rounded-[1.25rem] hover:bg-white/20 font-black transition-all shadow-xl hover:scale-[1.02] active:scale-95 text-sm whitespace-nowrap backdrop-blur-md"
            >
              <Zap size={18} className="text-amber-300" fill="currentColor" />
              Thiết lập Quyền theo Phân cấp
            </button>

            <button 
              onClick={() => handleOpenModal()}
              className="group flex items-center justify-center gap-3 px-8 py-4 bg-white text-indigo-600 rounded-[1.25rem] hover:bg-indigo-50 font-black transition-all shadow-xl shadow-black/10 hover:scale-[1.02] active:scale-95 text-sm whitespace-nowrap"
            >
              <Plus className="w-5 h-5" />
              Thêm vai trò mới
            </button>
          </div>
        </div>

        {/* Stats Summary Area */}
        <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-4 mt-12 pt-8 border-t border-white/10">
          {[
            { label: 'Tổng số vai trò', value: stats.total, icon: Layers },
            { label: 'Vai trò hệ thống', value: stats.system, icon: Lock },
            { label: 'Vai trò tùy chỉnh', value: stats.custom, icon: ShieldCheck },
            { label: 'Cấp lãnh đạo', value: stats.highLevel, icon: Key }
          ].map((s, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex items-center gap-2 text-indigo-100/60 text-xs font-bold uppercase tracking-wider mb-1">
                <s.icon size={12} />
                {s.label}
              </div>
              <div className="text-2xl font-black text-white">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-indigo-100/30 border border-indigo-50 overflow-hidden">
        {/* Advanced Toolbar */}
        <div className="p-6 md:p-8 bg-gray-50/50 flex flex-col md:flex-row gap-6 justify-between items-center border-b border-gray-100">
          <div className="relative w-full md:w-[450px] group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-5 h-5 text-gray-400 group-focus-within:text-indigo-600 transition-colors" />
            </div>
            <input 
              type="text" 
              placeholder="Tìm kiếm theo tên vai trò hoặc định danh..." 
              className="w-full pl-12 pr-6 py-4 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-[11px] font-black uppercase tracking-wider">
               <Filter size={14} />
               Phân loại
             </div>
             <div className="h-8 w-px bg-gray-200 mx-1" />
             <div className="text-xs font-bold text-gray-400">
               Hiển thị <span className="text-gray-900">{filteredRoles.length}</span> kết quả
             </div>
          </div>
        </div>

        {/* Premium Table Container */}
        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/80 text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] whitespace-nowrap">
                <th className="px-8 py-6 border-b border-gray-100">Thông tin vai trò</th>
                <th className="px-8 py-6 border-b border-gray-100 text-center">Vị trí</th>
                <th className="px-8 py-6 border-b border-gray-100">Phân cấp hệ thống</th>
                <th className="px-8 py-6 border-b border-gray-100">Ngày tạo</th>
                <th className="px-8 py-6 border-b border-gray-100 text-right">Quản lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-24 text-center">
                    <div className="relative inline-block">
                      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
                      <Shield className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-indigo-600 w-6 h-6" />
                    </div>
                    <p className="text-gray-500 font-black mt-4 animate-pulse uppercase tracking-widest text-[10px]">Đang tải dữ liệu vai trò...</p>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-20 h-20 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-300">
                        <Shield size={40} />
                      </div>
                      <div>
                        <p className="text-xl font-black text-gray-400 uppercase tracking-widest">Không tìm thấy vai trò</p>
                        <p className="text-gray-400 font-medium mt-1">Thử thay đổi từ khóa tìm kiếm của bạn.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRoles.map((role, index) => (
                  <tr key={role.id} className="group hover:bg-indigo-50/30 transition-all duration-300">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm",
                          role.isSystem 
                            ? "bg-indigo-600 text-white shadow-indigo-200 rotate-3 group-hover:rotate-0" 
                            : "bg-white text-indigo-600 border border-indigo-100 group-hover:border-indigo-300 group-hover:shadow-md"
                        )}>
                          {role.isSystem ? <ShieldCheck size={24} /> : <Shield size={24} />}
                        </div>
                        <div className="flex flex-col">
                           <div className="flex items-center gap-2">
                             <span className="font-black text-gray-900 text-base whitespace-nowrap">{ROLE_MAP[role.name] || role.name}</span>
                             {role.isSystem && (
                               <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-black rounded-lg border border-indigo-100 flex items-center gap-1 uppercase tracking-tighter">
                                 <Lock size={8} /> Hệ thống
                               </span>
                             )}
                           </div>
                            {/* <span className="text-[10px] font-bold text-gray-400 tracking-wider font-mono">ID: {role.id.split('-')[0]}</span> */}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <div className={cn(
                        "inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border whitespace-nowrap",
                        role.rank === 0 ? "bg-blue-50 text-blue-600 border-blue-100" :
                        role.rank === 1 ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                        "bg-gray-50 text-gray-400 border-gray-100"
                      )}>
                        {role.rank === 0 ? 'Trưởng' : role.rank === 1 ? 'Phó' : 'Thành viên'}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {(() => {
                        const info = getLevelInfo(role.level);
                        return (
                          <div className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-colors whitespace-nowrap",
                            info.color === 'rose' ? "bg-rose-50 text-rose-700 border-rose-100" :
                            info.color === 'amber' ? "bg-amber-50 text-amber-700 border-amber-100" :
                            "bg-emerald-50 text-emerald-700 border-emerald-100"
                          )}>
                            <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", 
                              info.color === 'rose' ? "bg-rose-500" : 
                              info.color === 'amber' ? "bg-amber-500" : "bg-emerald-500"
                            )} />
                            {info.label}
                          </div>
                        );
                      })()}
                    </td>

                    <td className="px-8 py-6">
                       <div className="flex items-center gap-2 text-gray-500 whitespace-nowrap">
                         <History size={14} className="text-gray-300" />
                         <span className="font-bold text-sm">{format(new Date(role.createdAt), 'dd MMM, yyyy', { locale: vi })}</span>
                       </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end">
                        <div className="relative">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === role.id ? null : role.id);
                            }}
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                              activeMenuId === role.id 
                                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" 
                                : "text-gray-400 hover:bg-gray-100 hover:text-indigo-600"
                            )}
                          >
                            <MoreVertical size={20} />
                          </button>

                          {activeMenuId === role.id && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                              <div className={cn(
                                "absolute right-0 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-20 animate-in fade-in zoom-in-95 duration-200",
                                index >= filteredRoles.length / 2 ? "bottom-full mb-2 origin-bottom" : "top-full mt-2 origin-top"
                              )}>
                                <button 
                                  onClick={() => {
                                    handleOpenPermissions(role);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <Key size={16} />
                                  </div>
                                  Phân quyền
                                </button>
                                
                                {!role.isSystem ? (
                                  <>
                                    <button 
                                      onClick={() => {
                                        handleOpenModal(role);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-3 transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 flex items-center justify-center">
                                        <Edit2 size={16} />
                                      </div>
                                      Chỉnh sửa
                                    </button>
                                    <div className="h-px bg-gray-100 my-1 mx-4" />
                                    <button 
                                      onClick={() => {
                                        handleDelete(role);
                                        setActiveMenuId(null);
                                      }}
                                      className="w-full px-4 py-3 text-left text-sm font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-3 transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                                        <Trash2 size={16} />
                                      </div>
                                      Xóa vai trò
                                    </button>
                                  </>
                                ) : (
                                  <div className="px-4 py-3 mt-1 border-t border-gray-50 bg-gray-50/50 text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                    <AlertCircle size={14} className="text-gray-300" />
                                    Hệ thống bảo vệ
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modern Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-indigo-950/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl relative z-[101] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-500">
            {/* Modal Header */}
            <div className="p-10 pb-0 flex items-start justify-between">
              <div>
                <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-indigo-200 mb-6">
                  <Plus size={32} />
                </div>
                <h3 className="text-3xl font-black text-gray-900 tracking-tight">
                  {editingRole ? 'Chỉnh sửa vai trò' : 'Tạo vai trò mới'}
                </h3>
                <p className="text-gray-500 mt-2 font-medium">Cấu hình tên gọi và vị trí trong cây phân cấp của tổ chức.</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all"
              >
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">
                    <History size={12} /> Tên định danh vai trò *
                  </label>
                  <input 
                    type="text" 
                    className="w-full px-8 py-5 bg-gray-50 border-2 border-transparent rounded-3xl outline-none focus:bg-white focus:border-indigo-600 transition-all font-black text-lg placeholder:text-gray-300 shadow-inner"
                    placeholder="VD: TRƯỞNG PHÒNG MARKETING"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">
                      <Layers size={12} /> Phân lớp quản lý *
                    </label>
                    <Select value={String(formData.level)} onValueChange={(val) => setFormData({ ...formData, level: Number(val) })}>
                      <SelectTrigger className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black h-[64px] shadow-sm">
                        <SelectValue placeholder="Chọn cấp độ" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-2xl z-[110] p-1">
                        {hierarchyLevels.map((lvl) => (
                          <SelectItem 
                            key={lvl.id} 
                            value={String(lvl.roleLevel)} 
                            className="font-bold cursor-pointer rounded-xl py-3 focus:bg-indigo-50 focus:text-indigo-600"
                          >
                            {lvl.unitTypeName} (LEVEL {lvl.roleLevel})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] ml-1">
                      <Shield size={12} /> Định danh vị trí *
                    </label>
                    <Select value={String(formData.rank)} onValueChange={(val) => setFormData({ ...formData, rank: Number(val) })}>
                      <SelectTrigger className="w-full px-6 py-5 bg-gray-50 border-none rounded-[1.5rem] text-sm font-black h-[64px] shadow-sm">
                        <SelectValue placeholder="Chọn vị trí" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-2xl z-[110] p-1">
                        <SelectItem value="0" className="font-bold cursor-pointer rounded-xl py-3">Trưởng (0)</SelectItem>
                        <SelectItem value="1" className="font-bold cursor-pointer rounded-xl py-3">Phó (1)</SelectItem>
                        <SelectItem value="2" className="font-bold cursor-pointer rounded-xl py-3">Khác (2)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>


              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-8 py-5 bg-gray-100 text-gray-500 rounded-3xl hover:bg-gray-200 font-black transition-all"
                >
                  Đóng
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-[2] px-8 py-5 bg-indigo-600 text-white rounded-3xl hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      {editingRole ? 'Cập nhật thay đổi' : 'Xác nhận tạo mới'}
                      <ArrowRight size={20} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RolePermissionDrawer 
        role={selectedRoleForPerms}
        isOpen={isPermissionDrawerOpen}
        onClose={() => setIsPermissionDrawerOpen(false)}
        hierarchyLevels={hierarchyLevels}
      />

      <HierarchyPermissionModal 
        isOpen={isHierarchyModalOpen}
        onClose={() => setIsHierarchyModalOpen(false)}
        hierarchyLevels={hierarchyLevels}
      />

      <ConfirmDialog 
        open={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, role: null })}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xoá vai trò"
        description={`Bạn có chắc chắn muốn xoá vai trò "${deleteConfirm.role?.name}" khỏi hệ thống? Tất cả nhân sự thuộc vai trò này sẽ bị ảnh hưởng.`}
        confirmLabel="Vẫn xoá vai trò"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
