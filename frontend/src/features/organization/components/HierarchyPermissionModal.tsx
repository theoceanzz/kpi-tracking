import { useState, useMemo } from 'react'
import { 
  X, 
  ShieldCheck, 
  Zap, 
  Check, 
  Layers,
  Shield,
  Lock,
  Loader2
} from 'lucide-react'
import { toast } from 'sonner'
import { useAllPermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { useRoles } from '../hooks/useRoles'
import { ROLE_MAP } from '@/constants/roles'

interface HierarchyPermissionModalProps {
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

// Define core permission codes for easier mapping - strictly following V2 Seed Data logic
const PERMS = {
  // Director gets almost everything
  DIRECTOR_EXCLUDES: ['KPI:VIEW_MY', 'SUBMISSION:VIEW_MY', 'EVALUATION:VIEW_MY', 'STATS:VIEW_MY'],
  
  // Head/Manager (Rank 0, Level 1 or 2)
  MANAGER_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:CREATE', 'KPI:UPDATE', 'KPI:DELETE', 'KPI:APPROVE', 'KPI:REJECT', 'KPI:SUBMIT', 'KPI:IMPORT', 'KPI:VIEW_MY',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY',
    'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'
  ],

  // Deputy (Rank 1, Level 1 or 2)
  DEPUTY_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW', 'KPI:UPDATE', 'KPI:SUBMIT', 'KPI:VIEW_MY',
    'SUBMISSION:VIEW', 'SUBMISSION:REVIEW', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW', 'EVALUATION:CREATE', 'EVALUATION:VIEW_MY',
    'ORG:VIEW', 'USER:VIEW', 'NOTIF:VIEW', 'AI:SUGGEST_KPI', 'ATTACHMENT:UPLOAD',
    'STATS:VIEW_ORG', 'STATS:VIEW_EMPLOYEE', 'STATS:VIEW_MY'
  ],

  // Staff (Rank 2, Level 2)
  STAFF_CORE: [
    'DASHBOARD:VIEW', 'KPI:VIEW_MY', 'KPI:SUBMIT', 'KPI_PERIOD:VIEW',
    'SUBMISSION:CREATE', 'SUBMISSION:VIEW_MY',
    'EVALUATION:VIEW_MY', 'EVALUATION:CREATE',
    'NOTIF:VIEW', 'ATTACHMENT:UPLOAD', 'STATS:VIEW_MY'
  ]
}

export default function HierarchyPermissionModal({ isOpen, onClose, hierarchyLevels }: HierarchyPermissionModalProps) {
  const { data: allPermissions = [] } = useAllPermissions()
  const { data: roles = [] } = useRoles()
  const updateMutation = useUpdateRolePermissions()
  const [isApplying, setIsApplying] = useState(false)
  
  const hierarchyCount = hierarchyLevels.length

  // Define what each role type gets based on SQL V2 definitions
  const roleTypeDefinitions = useMemo(() => {
    const director = allPermissions
      .filter(p => !PERMS.DIRECTOR_EXCLUDES.includes(p.code))
      .map(p => p.code)
      
    const manager = PERMS.MANAGER_CORE
    const deputy = PERMS.DEPUTY_CORE
    const staff = PERMS.STAFF_CORE

    return { director, manager, deputy, staff }
  }, [allPermissions])

  // Group all available permissions by resource for the matrix display
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, string[]> = {}
    allPermissions.forEach(p => {
      const resource = p.resource || 'CHƯA PHÂN LOẠI'
      if (!groups[resource]) groups[resource] = []
      if (!groups[resource].includes(p.code)) groups[resource].push(p.code)
    })
    return groups
  }, [allPermissions])

  const displayRoles = useMemo(() => {
    const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
    const result: any[] = []
    
    activeRoleLevels.forEach((levelVal, idx) => {
      const lvl = hierarchyLevels.find(l => l.roleLevel === levelVal)
      if (!lvl) return
      
      const isTop = idx === 0
      const isBottom = idx === activeRoleLevels.length - 1
      
      // Pattern: Each level has Head (0) and Deputy (1). Bottom level also has Staff (2).
      const ranks = isBottom ? [0, 1, 2] : [0, 1]
      
      ranks.forEach(rank => {
        // Try to find an actual role for this position to get a realistic label
        const actualRole = roles.find(r => r.level === levelVal && r.rank === rank && !r.isSystem)
        
        let label = ''
        if (actualRole) {
          label = ROLE_MAP[actualRole.name] || actualRole.name
        } else {
          // Fallback labels based on hierarchy info
          if (rank === 0) {
            label = isTop ? (lvl.managerRoleLabel || 'GIÁM ĐỐC') : `TRƯỞNG ${lvl.unitTypeName}`
          } else if (rank === 1) {
            label = `PHÓ ${isTop ? (lvl.managerRoleLabel || 'GIÁM ĐỐC') : lvl.unitTypeName}`
          } else {
            label = 'NHÂN VIÊN'
          }
        }
        
        result.push({
          key: `lvl_${levelVal}_rank_${rank}`,
          label: label.toUpperCase(),
          roleLevel: levelVal,
          rank: rank
        })
      })
    })
    return result
  }, [roles, hierarchyLevels])

  const handleApply = async () => {
    setIsApplying(true)
    try {
      let successCount = 0
      // Get the set of active role levels for this company
      const activeRoleLevels = new Set(hierarchyLevels.map(l => l.roleLevel))

      for (const role of roles) {
        // Skip roles that are not in the active hierarchy levels
        if (!activeRoleLevels.has(role.level)) continue

        let targetCodes: string[] = []
        
        // Find if this role is at the top-most level of the company
        const minRoleLevel = Math.min(...Array.from(activeRoleLevels))
        const maxRoleLevel = Math.max(...Array.from(activeRoleLevels))

        if (role.level === minRoleLevel && role.rank === 0) {
          // Top-most manager gets director permissions
          targetCodes = roleTypeDefinitions.director
        } else if (role.level === maxRoleLevel && role.rank === 2) {
          // Bottom-most staff gets staff permissions
          targetCodes = roleTypeDefinitions.staff
        } else {
          // Everyone else in between or deputy
          targetCodes = role.rank === 0 ? roleTypeDefinitions.manager : roleTypeDefinitions.deputy
        }

        if (targetCodes.length > 0) {
          const permissionIds = allPermissions
            .filter(p => targetCodes.includes(p.code))
            .map(p => p.id)
            
          await updateMutation.mutateAsync({
            roleId: role.id,
            permissionIds
          })
          successCount++
        }
      }
      toast.success(`Đã cập nhật quyền hạn cho ${successCount} vai trò theo phân cấp thực tế của công ty.`)
      onClose()
    } catch (err) {
      toast.error('Có lỗi xảy ra khi áp dụng quyền hạn.')
    } finally {
      setIsApplying(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500" onClick={onClose} />
      
      <div className="relative w-full max-w-6xl bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-10 duration-700">
        
        {/* Header */}
        <div className="p-8 md:p-10 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 dark:shadow-none">
                <ShieldCheck size={32} />
              </div>
              <div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Thiết lập Quyền theo Phân cấp</h3>
                <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                  <Layers size={14} />
                  Mô hình tổ chức: <span className="text-indigo-600 font-black uppercase">{hierarchyCount} cấp</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-slate-50/30">
          
          {/* Permission Matrix Preview */}
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                 <Zap size={14} className="text-amber-500" /> Ma trận quyền hạn chi tiết
               </h4>
               <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold text-slate-500">Đầy đủ</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-bold text-slate-500">Một phần</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <X size={12} className="text-slate-300" />
                    <span className="text-[10px] font-bold text-slate-500">Không có</span>
                 </div>
               </div>
            </div>

            <div className="space-y-4">
              {Object.entries(groupedPermissions).map(([resource, codes]) => (
                <div key={resource} className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-8 py-4 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Lock size={14} className="text-indigo-500" />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{resource}</span>
                    </div>
                    <div className="flex items-center gap-12 mr-4">
                       <div className="w-48 text-left text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                         Mô tả chi tiết quyền hạn
                       </div>
                       {displayRoles.map(r => (
                         <div key={r.key} className="w-20 text-center text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                           {r.label}
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {codes.map(code => (
                      <div key={code} className="px-8 py-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                        <div className="flex flex-col flex-1">
                          <span className="text-[13px] font-bold text-slate-700 dark:text-slate-300">{code}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{code.split(':')[1]} action</span>
                        </div>
                        <div className="flex items-center gap-12 mr-4">
                          <div className="w-48 text-left text-[10px] text-slate-500 font-medium leading-relaxed pr-4">
                            {allPermissions.find(p => p.code === code)?.description || PERMISSION_DESCRIPTIONS[code] || 'Mô tả đang được cập nhật...'}
                          </div>
                          {displayRoles.map(r => {
                            // Align preview logic with handleApply logic
                            const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
                            const minRoleLevel = activeRoleLevels[0]
                            const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]
                            
                            let targetCodes: string[] = []
                            if (r.roleLevel === minRoleLevel && r.rank === 0) {
                              targetCodes = roleTypeDefinitions.director
                            } else if (r.roleLevel === maxRoleLevel && r.rank === 2) {
                              targetCodes = roleTypeDefinitions.staff
                            } else {
                              targetCodes = r.rank === 0 ? roleTypeDefinitions.manager : roleTypeDefinitions.deputy
                            }
                            
                            const has = targetCodes.includes(code)
                            return (
                              <div key={r.key} className="w-20 flex justify-center">
                                {has ? (
                                  <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                                    <Check size={14} strokeWidth={3} />
                                  </div>
                                ) : (
                                  <X size={14} className="text-slate-200 dark:text-slate-700" />
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-4 text-slate-400">
             <Shield size={20} />
             <p className="text-xs font-bold max-w-sm">
               Hành động này sẽ thay thế toàn bộ thiết lập quyền hạn hiện tại của các vai trò. Hãy chắc chắn bạn đã kiểm tra kỹ.
             </p>
          </div>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 font-black transition-all"
            >
              Hủy bỏ
            </button>
            <button 
              onClick={handleApply}
              disabled={isApplying}
              className="px-10 py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center gap-3"
            >
              {isApplying ? <Loader2 className="w-5 h-5 animate-spin" /> : <Zap size={18} fill="currentColor" />}
              {isApplying ? 'Đang thiết lập...' : 'Xác nhận áp dụng cho toàn công ty'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
