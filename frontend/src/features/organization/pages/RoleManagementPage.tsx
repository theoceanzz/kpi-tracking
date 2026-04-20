import { useState } from 'react'
import { 
  Shield, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  ShieldCheck,
  AlertCircle,
  Loader2,
  ChevronRight,
  Key
} from 'lucide-react'
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '../hooks/useRoles'
import { RoleResponse } from '../api/role.api'
import RolePermissionDrawer from '../components/RolePermissionDrawer'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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
  const [formData, setFormData] = useState({ name: '', parentRoleId: '' })
  
  const { data: roles = [], isLoading } = useRoles()
  const createMutation = useCreateRole()
  const updateMutation = useUpdateRole()
  const deleteMutation = useDeleteRole()

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleOpenModal = (role?: RoleResponse) => {
    if (role) {
      setEditingRole(role)
      setFormData({ name: role.name, parentRoleId: role.parentRoleId || '' })
    } else {
      setEditingRole(null)
      setFormData({ name: '', parentRoleId: '' })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name) {
      toast.error('Vui lòng nhập tên vai trò')
      return
    }

    try {
      if (editingRole) {
        await updateMutation.mutateAsync({
          roleId: editingRole.id,
          payload: { name: formData.name, parentRoleId: formData.parentRoleId || undefined }
        })
      } else {
        await createMutation.mutateAsync({
          name: formData.name,
          parentRoleId: formData.parentRoleId || undefined
        })
      }
      setIsModalOpen(false)
    } catch (error) {
      // Error handled by mutation
    }
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
      } catch (error) {
        // Error handled by mutation
      }
    }
  }

  const handleOpenPermissions = (role: RoleResponse) => {
    setSelectedRoleForPerms(role)
    setIsPermissionDrawerOpen(true)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            Quản lý Vai trò
          </h1>
          <p className="text-gray-500 font-medium mt-1">Thiết lập và phân cấp các vai trò trong tổ chức</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center justify-center px-6 py-3.5 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-black transition-all shadow-xl shadow-blue-200 hover:scale-[1.02] active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" />
          Thêm vai trò mới
        </button>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="p-6 border-b bg-gray-50/30 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Tìm kiếm vai trò..." 
              className="w-full pl-12 pr-4 py-3 bg-white border-none rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-bold text-sm shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-widest px-4">
            Tổng cộng: <span className="text-blue-600 ml-2">{filteredRoles.length} vai trò</span>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] border-b">
                <th className="px-8 py-5">Tên vai trò</th>
                <th className="px-8 py-5">Cấp cha</th>
                <th className="px-8 py-5">Ngày tạo</th>
                <th className="px-8 py-5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500 font-bold animate-pulse">Đang tải danh sách vai trò...</p>
                  </td>
                </tr>
              ) : filteredRoles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Shield className="w-10 h-10 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-bold italic">Không tìm thấy vai trò nào phù hợp</p>
                  </td>
                </tr>
              ) : (
                filteredRoles.map(role => (
                  <tr key={role.id} className="group hover:bg-blue-50/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm",
                          role.isSystem ? "bg-indigo-600 text-white" : "bg-blue-50 text-blue-600 border border-blue-100"
                        )}>
                          {role.isSystem ? <ShieldCheck className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                        </div>
                        <div className="flex items-center space-x-2">
                           <span className="font-black text-gray-900">{role.name}</span>
                           {role.isSystem && (
                             <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[8px] font-black rounded-full uppercase tracking-tighter border border-indigo-100">
                               Hệ thống
                             </span>
                           )}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 font-bold text-gray-500 text-sm">
                      {role.parentRoleName ? (
                        <div className="flex items-center">
                          <ChevronRight className="w-3 h-3 mr-2 text-gray-300" />
                          {role.parentRoleName}
                        </div>
                      ) : (
                        <span className="text-gray-300 italic font-medium">Cấp cao nhất</span>
                      )}
                    </td>
                    <td className="px-8 py-5 text-gray-500 font-medium text-sm">
                      {format(new Date(role.createdAt), 'dd/MM/yyyy', { locale: vi })}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button 
                          onClick={() => handleOpenPermissions(role)}
                          className="p-2.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          title="Phân quyền"
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        {!role.isSystem && (
                          <>
                            <button 
                              onClick={() => handleOpenModal(role)}
                              className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                              title="Chỉnh sửa"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(role)}
                              className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                              title="Xoá"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {role.isSystem && (
                          <div className="pl-1">
                             <AlertCircle className="w-4 h-4 text-gray-300" />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-[101] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            <div className="p-10 border-b bg-gradient-to-r from-gray-50 to-white">
              <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                {editingRole ? 'Cập nhật vai trò' : 'Thêm vai trò mới'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 font-medium">Thiết lập các thuộc tính cơ bản cho vai trò tổ chức.</p>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-10 space-y-8">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Tên vai trò *</label>
                  <input 
                    type="text" 
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-sm"
                    placeholder="VD: GIÁM ĐỐC KINH DOANH"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Vai trò cấp cha (Nếu có)</label>
                  <select 
                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 transition-all font-bold text-sm appearance-none cursor-pointer"
                    value={formData.parentRoleId}
                    onChange={(e) => setFormData({ ...formData, parentRoleId: e.target.value })}
                  >
                    <option value="">Không có - Vai trò cấp cao nhất</option>
                    {roles
                      .filter(r => r.id !== editingRole?.id) // Prevent self-parent
                      .map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-10 bg-gray-50/50 flex space-x-4 border-t">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-8 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl hover:bg-gray-100 font-black transition-all shadow-sm"
                >
                  Hủy
                </button>
                <button 
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 font-black transition-all shadow-xl shadow-blue-200 disabled:opacity-50 flex items-center justify-center"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    editingRole ? 'Lưu thay đổi' : 'Tạo ngay'
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
      />

      <ConfirmDialog 
        open={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, role: null })}
        onConfirm={handleConfirmDelete}
        title="Xác nhận xoá vai trò"
        description={`Bạn có chắc chắn muốn xoá vai trò "${deleteConfirm.role?.name}" không? Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá ngay"
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
