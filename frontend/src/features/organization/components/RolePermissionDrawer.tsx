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
  Zap,
  Check
} from 'lucide-react'
import { useAllPermissions, useRolePermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { RoleResponse } from '../api/role.api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface RolePermissionDrawerProps {
  role: RoleResponse | null
  isOpen: boolean
  onClose: () => void
  hierarchyLevels: any[]
}

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'DASHBOARD:VIEW': 'Cho phép xem bảng điều khiển tổng quan và các báo cáo nhanh về hiệu suất.',
  'KPI:VIEW': 'Quyền xem danh sách các chỉ tiêu KPI của bản thân hoặc đơn vị.',
  'KPI:CREATE': 'Cho phép tạo mới các chỉ tiêu KPI cho cá nhân hoặc nhóm.',
  'KPI:UPDATE': 'Quyền chỉnh sửa nội dung, trọng số của các chỉ tiêu KPI đã tạo.',
  'KPI:DELETE': 'Quyền xóa bỏ các chỉ tiêu KPI (chỉ áp dụng khi chưa được phê duyệt).',
  'KPI:APPROVE': 'Quyền phê duyệt hoặc từ chối các chỉ tiêu KPI của cấp dưới.',
  'SUBMISSION:VIEW': 'Xem các bài nộp, bằng chứng kết quả công việc của nhân viên.',
  'SUBMISSION:CREATE': 'Cho phép nhân viên nộp kết quả thực hiện KPI cho cấp trên.',
  'SUBMISSION:REVIEW': 'Quyền kiểm tra và chấm điểm cho các bài nộp của nhân viên.',
  'EVALUATION:VIEW': 'Xem các bản đánh giá hiệu suất định kỳ của cá nhân hoặc đơn vị.',
  'EVALUATION:CREATE': 'Cho phép thực hiện tự đánh giá hoặc đánh giá nhân viên cấp dưới.',
  'ROLE:VIEW': 'Xem danh sách các vai trò và cấp bậc trong hệ thống.',
  'ROLE:ASSIGN': 'Quyền phân bổ vai trò và quyền hạn cho người dùng trong đơn vị.',
  'ORG:VIEW': 'Xem sơ đồ tổ chức, danh sách phòng ban và đội nhóm.',
  'USER:VIEW': 'Xem thông tin danh sách nhân viên trong hệ thống.',
  'SYSTEM:ADMIN': 'Quyền quản trị toàn diện hệ thống (Cẩn trọng khi cấp quyền này).',
  'REPORT:VIEW': 'Quyền xem và xuất các báo cáo phân tích nâng cao.',
  'ADJUSTMENT:CREATE': 'Cho phép tạo yêu cầu điều chỉnh KPI sau khi đã chốt.',
  'ADJUSTMENT:APPROVE': 'Quyền phê duyệt các yêu cầu điều chỉnh KPI của cấp dưới.'
};

function PermissionTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  
  return (
    <div className="relative" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-gray-900/90 backdrop-blur-md text-white text-[11px] font-medium rounded-2xl shadow-2xl z-[200] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <div className="relative">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-gray-900/90" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RolePermissionDrawer({ role, isOpen, onClose, hierarchyLevels }: RolePermissionDrawerProps) {
  const { data: allPermissions = [], isLoading: isLoadingAll } = useAllPermissions()
  const { data: rolePermissions, isLoading: isLoadingRole } = useRolePermissions(role?.id)
  const updateMutation = useUpdateRolePermissions()

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [showDefaultPreview, setShowDefaultPreview] = useState<{ isOpen: boolean; type: string; codes: string[] }>({
    isOpen: false,
    type: '',
    codes: []
  })

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

  const handleApplyDefaults = () => {
    if (!role) return;

    let targetType = 'staff';
    let label = 'Nhân viên';

    // Get the set of active role levels for this company
    const activeRoleLevels = Array.from(new Set(hierarchyLevels.map((l: any) => l.roleLevel)) as Set<number>).sort((a: number, b: number) => a - b)
    const minRoleLevel = activeRoleLevels[0]
    const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]

    if (role.level === minRoleLevel && role.rank === 0) {
      targetType = 'director';
      label = 'Giám đốc';
    } else if (role.level === maxRoleLevel && role.rank === 2) {
      targetType = 'staff';
      label = 'Nhân viên';
    } else {
      if (role.rank === 0) { targetType = 'manager'; label = 'Quản lý'; }
      else if (role.rank === 1) { targetType = 'deputy'; label = 'Phó quản lý'; }
      else { targetType = 'staff'; label = 'Nhân viên'; }
    }

    // Use the same definitions as the global modal (strictly following SQL V2 logic)
    const EXCLUDES = ['KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY'];
    const MANAGER = ['DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE', 'KPI:REJECT', 'KPI:SUBMIT', 'KPI:IMPORT', 'KPI:VIEW_MY', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY', 'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'];
    const DEPUTY = ['DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:UPDATE', 'KPI:SUBMIT', 'KPI:VIEW_MY', 'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY', 'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'];
    const STAFF = ['DASHBOARD:VIEW', 'KPI:VIEW_MY', 'KPI:SUBMIT', 'KPI_PERIOD:VIEW', 'SUBMISSION:CREATE', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'EVALUATION:CREATE', 'NOTIF:VIEW', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_MY'];

    let codes: string[] = [];
    if (targetType === 'director') codes = allPermissions.filter(p => !EXCLUDES.includes(p.code)).map(p => p.code);
    else if (targetType === 'manager') codes = MANAGER;
    else if (targetType === 'deputy') codes = DEPUTY;
    else codes = STAFF;

    setShowDefaultPreview({ isOpen: true, type: label, codes });
  };

  const confirmApplyDefaults = () => {
    const nextIds = new Set(selectedIds);
    const suggestedIds = allPermissions
      .filter(p => showDefaultPreview.codes.includes(p.code))
      .map(p => p.id);
    
    suggestedIds.forEach(id => nextIds.add(id));
    setSelectedIds(nextIds);
    setShowDefaultPreview({ ...showDefaultPreview, isOpen: false });
    toast.success(`Đã đề xuất bộ quyền hạn cho "${showDefaultPreview.type}"`);
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
              onClick={handleApplyDefaults}
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
                      <PermissionTooltip key={p.id} text={PERMISSION_DESCRIPTIONS[p.code] || `Quyền hạn thực hiện hành động ${p.action} trên tài nguyên ${p.resource}.`}>
                        <button
                          onClick={() => togglePermission(p.id)}
                          className={cn(
                            "w-full flex items-center space-x-3 px-4 py-3 rounded-2xl border transition-all text-left",
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
                      </PermissionTooltip>
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

      {/* Default Permission Preview Modal */}
      {showDefaultPreview.isOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })} />
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg relative z-[251] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50">
               <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-lg shadow-amber-200">
                    <Zap size={24} fill="currentColor" />
                  </div>
                  <div>
                    <h4 className="text-xl font-black text-slate-900 dark:text-white">Xem trước quyền mặc định</h4>
                    <p className="text-sm text-slate-500 font-medium">Gợi ý cho vai trò: <span className="text-amber-600 font-bold uppercase">{showDefaultPreview.type}</span></p>
                  </div>
               </div>
            </div>
            <div className="p-8 max-h-[400px] overflow-y-auto custom-scrollbar">
               <div className="space-y-2">
                 <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Danh sách mã quyền sẽ được gán:</p>
                 <div className="grid grid-cols-2 gap-2">
                   {showDefaultPreview.codes.map(code => (
                     <div key={code} className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-2">
                        <Check size={12} className="text-emerald-500" strokeWidth={3} /> {code}
                     </div>
                   ))}
                 </div>
               </div>
            </div>
            <div className="p-8 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button 
                onClick={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })}
                className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-sm hover:bg-slate-200 transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={confirmApplyDefaults}
                className="flex-[2] px-6 py-4 bg-amber-500 text-white rounded-2xl font-black text-sm hover:bg-amber-600 transition-all shadow-lg shadow-amber-200"
              >
                Xác nhận áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
