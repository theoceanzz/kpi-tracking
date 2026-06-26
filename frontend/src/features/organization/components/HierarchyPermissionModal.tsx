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


interface HierarchyPermissionModalProps {
  isOpen: boolean
  onClose: () => void
  hierarchyLevels: any[]
}

const PERMISSION_DESCRIPTIONS: Record<string, string> = {
  'DASHBOARD:VIEW': 'Cho phép xem các biểu đồ, số liệu thống kê tổng quan và các khung hiển thị trên trang tổng quan chính',
  'COMPANY:VIEW': 'Cho phép xem thông tin hồ sơ công ty/tổ chức (tên, địa chỉ, logo, thông tin liên hệ...)',
  'COMPANY:UPDATE': 'Cho phép chỉnh sửa, cập nhật thông tin hồ sơ công ty/tổ chức',
  'COMPANY:DELETE': 'Cho phép xoá hoặc lưu trữ tổ chức khỏi hệ thống — chỉ dành cho quản trị cấp cao nhất',
  'ORG:VIEW': 'Cho phép xem sơ đồ tổ chức, danh sách các đơn vị/phòng ban đầy đủ chi tiết',
  'ORG:CREATE': 'Cho phép tạo mới đơn vị/phòng ban trong sơ đồ tổ chức',
  'ORG:UPDATE': 'Cho phép chỉnh sửa thông tin đơn vị/phòng ban (tên, cấp bậc, trưởng đơn vị...)',
  'ORG:DELETE': 'Cho phép xoá đơn vị/phòng ban khỏi sơ đồ tổ chức',
  'ORG:VIEW_TREE': 'Cho phép xem cây sơ đồ tổ chức ở dạng rút gọn (dùng cho bộ lọc, chọn đơn vị nhanh)',
  'USER:VIEW': 'Cho phép xem danh mục, hồ sơ chi tiết của nhân sự trong tổ chức',
  'USER:CREATE': 'Cho phép thêm mới tài khoản/hồ sơ nhân sự vào hệ thống',
  'USER:UPDATE': 'Cho phép chỉnh sửa thông tin cá nhân, chức vụ, đơn vị công tác của nhân sự',
  'USER:DELETE': 'Cho phép xoá hoặc vô hiệu hoá tài khoản nhân sự',
  'USER:IMPORT': 'Cho phép nhập danh sách nhân sự hàng loạt từ tệp Excel/CSV',
  'USER:VIEW_LIST': 'Cho phép xem danh sách nhân sự ở dạng rút gọn, dùng để hiển thị trên trang tổng quan hoặc bộ lọc nhanh',
  'ROLE:VIEW': 'Cho phép xem danh sách các vai trò hiện có trong tổ chức',
  'ROLE:ASSIGN': 'Cho phép gán một hoặc nhiều vai trò cho người dùng cụ thể',
  'ROLE:CREATE': 'Cho phép tạo mới vai trò cùng danh sách quyền đi kèm',
  'ROLE:UPDATE': 'Cho phép chỉnh sửa tên, mô tả và danh sách quyền của vai trò đã có',
  'ROLE:DELETE': 'Cho phép xoá vai trò khỏi hệ thống — chỉ áp dụng khi vai trò không còn người dùng nào sử dụng',
  'PERMISSION:EDIT': 'Cho phép thiết lập chi tiết, bật/tắt từng quyền cụ thể cho vai trò — quyền quản trị nhạy cảm',
  'PERMISSION:VIEW': 'Cho phép xem danh sách toàn bộ quyền hiện có trong hệ thống',
  'KPI:VIEW': 'Cho phép xem danh mục, chi tiết các chỉ tiêu KPI đã thiết lập trong tổ chức',
  'KPI:CREATE': 'Cho phép thiết lập mới chỉ tiêu KPI cho đơn vị/nhân sự',
  'KPI:UPDATE': 'Cho phép chỉnh sửa nội dung, trọng số, mục tiêu của chỉ tiêu KPI đã tạo',
  'KPI:DELETE': 'Cho phép xoá chỉ tiêu KPI khỏi hệ thống',
  'KPI:APPROVE_CRITERIA': 'Cho phép phê duyệt chỉ tiêu KPI do cấp dưới đề xuất trước khi áp dụng',
  'KPI:APPROVE_ADJUSTMENT': 'Cho phép phê duyệt yêu cầu điều chỉnh chỉ tiêu KPI trong quá trình thực hiện',
  'KPI:APPROVE_OWN': 'Cho phép chỉ tiêu KPI tự tạo được duyệt ngay (tự động chuyển sang trạng thái đã duyệt khi tạo) mà không cần chờ người khác phê duyệt',
  'KPI:VIEW_MY': 'Cho phép xem các chỉ tiêu KPI được giao cho chính bản thân người dùng',
  'KPI:IMPORT': 'Cho phép nhập hàng loạt chỉ tiêu KPI từ tệp Excel/CSV',
  'KPI:SUBMIT': 'Cho phép gửi chỉ tiêu KPI đã thiết lập đi để cấp trên phê duyệt',
  'KPI:REJECT': 'Cho phép từ chối, trả lại chỉ tiêu KPI không hợp lệ kèm lý do',
  'KPI_PERIOD:VIEW': 'Cho phép xem danh sách các kỳ đánh giá KPI (theo tháng/quý/năm)',
  'KPI_PERIOD:CREATE': 'Cho phép tạo mới kỳ đánh giá KPI với thời gian bắt đầu/kết thúc xác định',
  'KPI_PERIOD:UPDATE': 'Cho phép cập nhật thông tin, trạng thái của kỳ đánh giá KPI',
  'KPI_PERIOD:DELETE': 'Cho phép xoá kỳ đánh giá KPI khỏi hệ thống',
  'SUBMISSION:REVIEW': 'Cho phép duyệt/từ chối bài nộp kết quả KPI của nhân viên cấp dưới',
  'SUBMISSION:REVIEW_KPI': 'Cho phép xem chi tiết bài nộp KPI của nhân viên để phục vụ việc đánh giá',
  'SUBMISSION:CREATE': 'Cho phép nộp báo cáo kết quả thực hiện KPI cá nhân kèm minh chứng/tệp đính kèm',
  'SUBMISSION:VIEW_MY': 'Cho phép xem lại lịch sử các bài nộp báo cáo KPI của chính bản thân',
  'SUBMISSION:VIEW': 'Cho phép xem toàn bộ bản nộp KPI của tất cả nhân sự trong phạm vi quản lý',
  'SUBMISSION:DELETE': 'Cho phép xoá bản nộp KPI đã được gửi lên hệ thống',
  'SUBMISSION:UPDATE': 'Cho phép chỉnh sửa nội dung bản nộp KPI đã tồn tại',
  'EVALUATION:VIEW': 'Cho phép xem kết quả đánh giá, xếp loại KPI của nhân sự trong phạm vi quản lý',
  'EVALUATION:CREATE': 'Cho phép thực hiện đánh giá, chấm điểm và xếp loại kết quả KPI cho nhân viên',
  'EVALUATION:UPDATE': 'Cho phép chỉnh sửa kết quả đánh giá KPI đã được lập trước đó',
  'EVALUATION:DELETE': 'Cho phép xoá kết quả đánh giá KPI khỏi hệ thống',
  'EVALUATION:VIEW_MY': 'Cho phép xem kết quả đánh giá KPI của chính bản thân người dùng',
  'NOTIF:VIEW': 'Cho phép xem danh sách thông báo gửi đến tài khoản của mình',
  'NOTIF:MANAGE': 'Cho phép quản lý, soạn và gửi thông báo hệ thống đến người dùng khác',
  'AI:SUGGEST_KPI': 'Cho phép sử dụng tính năng trí tuệ nhân tạo để gợi ý nội dung, chỉ tiêu KPI tự động',
  'POLICY:VIEW': 'Cho phép xem nội dung các chính sách, quy định nội bộ của tổ chức',
  'POLICY:CREATE': 'Cho phép soạn thảo, tạo mới chính sách/quy định nội bộ',
  'POLICY:UPDATE': 'Cho phép chỉnh sửa nội dung chính sách/quy định đã ban hành',
  'POLICY:DELETE': 'Cho phép xoá chính sách/quy định khỏi hệ thống',
  'POLICY:ASSIGN': 'Cho phép gán chính sách/quy định áp dụng cho từng vai trò cụ thể',
  'STATS:VIEW_ORG': 'Cho phép xem số liệu thống kê, báo cáo tổng hợp theo từng đơn vị/phòng ban',
  'STATS:VIEW_EMPLOYEE': 'Cho phép xem số liệu thống kê kết quả KPI chi tiết theo từng nhân viên',
  'STATS:VIEW_MY': 'Cho phép xem tiến độ, số liệu thống kê KPI của chính bản thân người dùng',
  'SYSTEM:ADMIN': 'Quyền quản trị toàn hệ thống, cho phép bỏ qua mọi giới hạn phạm vi đơn vị/tổ chức — chỉ cấp cho quản trị viên cao nhất',
  'USER_ROLE:VIEW': 'Cho phép xem danh sách vai trò đang được gán cho từng người dùng',
  'USER_ROLE:ASSIGN': 'Cho phép gán vai trò mới cho người dùng trong tổ chức',
  'USER_ROLE:REVOKE': 'Cho phép thu hồi (gỡ bỏ) vai trò đã gán khỏi người dùng',
  'ATTACHMENT:UPLOAD': 'Cho phép tải lên tệp đính kèm (minh chứng, tài liệu...) cho các bản nộp KPI',
  'ATTACHMENT:DELETE': 'Cho phép xoá tệp đính kèm đã tải lên hệ thống',
  'REMINDER:SEND': 'Cho phép gửi thông báo nhắc nhở nhân viên về tiến độ nộp/hoàn thành KPI',
  'ADJUSTMENT:VIEW_MY': 'Cho phép xem các yêu cầu điều chỉnh chỉ tiêu KPI do chính bản thân gửi lên'
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
          label = actualRole.name
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
        <div className="p-5 md:p-10 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-16 md:h-16 rounded-xl md:rounded-[2rem] bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-200 dark:shadow-none shrink-0">
                <ShieldCheck size={18} className="md:hidden" />
                <ShieldCheck size={32} className="hidden md:block" />
              </div>
              <div>
                <h3 className="text-sm md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Thiết lập Quyền theo Phân cấp</h3>
                <p className="text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 text-xs md:text-sm">
                  <Layers size={12} />
                  Mô hình tổ chức: <span className="text-indigo-600 font-black uppercase">{hierarchyCount} cấp</span>
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 md:p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-400 shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-slate-50/30">
          
          {/* Permission Matrix Preview */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                 <Zap size={14} className="text-amber-500" /> Ma trận quyền hạn chi tiết
               </h4>
               <div className="hidden sm:flex items-center gap-6">
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

            {/* Desktop matrix */}
            <div className="hidden md:block overflow-x-auto pb-4 -mx-2 px-2 custom-scrollbar">
              <div className="min-width-max space-y-3" style={{ minWidth: `${180 + 250 + (displayRoles.length * 75)}px` }}>
                {Object.entries(groupedPermissions).map(([resource, codes]) => (
                  <div key={resource} className="bg-white dark:bg-slate-800 rounded-[1.5rem] border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="px-6 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center">
                      <div className="w-[180px] shrink-0 flex items-center gap-2">
                        <Lock size={12} className="text-indigo-500" />
                        <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider truncate">{resource}</span>
                      </div>
                      <div className="w-[250px] shrink-0 text-left text-[8px] font-black text-slate-400 uppercase tracking-tighter pl-4 border-l border-slate-200/50 dark:border-slate-700/50 ml-2">
                        Mô tả chi tiết quyền hạn
                      </div>
                      <div className="flex items-center gap-2">
                        {displayRoles.map(r => (
                          <div key={r.key} className="w-[70px] text-center text-[8px] font-black text-slate-400 uppercase tracking-tighter whitespace-normal leading-tight">
                            {r.label}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                      {codes.map(code => (
                        <div key={code} className="px-6 py-2 flex items-center hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors">
                          <div className="w-[180px] shrink-0 flex flex-col pr-4">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate" title={code}>{code}</span>
                            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter">{code.split(':')[1]} action</span>
                          </div>
                          <div className="w-[250px] shrink-0 text-left text-[9px] text-slate-500 font-medium leading-tight pr-6 border-l border-slate-100 dark:border-slate-700/50 pl-4 ml-2">
                            {allPermissions.find(p => p.code === code)?.description || PERMISSION_DESCRIPTIONS[code] || 'Mô tả đang được cập nhật...'}
                          </div>
                          <div className="flex items-center gap-2">
                            {displayRoles.map(r => {
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
                                <div key={r.key} className="w-[70px] flex justify-center shrink-0">
                                  {has ? (
                                    <div className="w-5 h-5 rounded bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100/50">
                                      <Check size={12} strokeWidth={3} />
                                    </div>
                                  ) : (
                                    <div className="w-5 h-5 flex items-center justify-center">
                                      <X size={12} className="text-slate-200 dark:text-slate-700 opacity-50" />
                                    </div>
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

            {/* Mobile matrix - card layout with role pills */}
            <div className="md:hidden space-y-3">
              {Object.entries(groupedPermissions).map(([resource, codes]) => (
                <div key={resource} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                    <Lock size={11} className="text-indigo-500" />
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-wider">{resource}</span>
                  </div>
                  <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {codes.map(code => {
                      const activeRoleLevels = Array.from(new Set(hierarchyLevels.map(l => l.roleLevel))).sort((a, b) => a - b)
                      const minRoleLevel = activeRoleLevels[0]
                      const maxRoleLevel = activeRoleLevels[activeRoleLevels.length - 1]
                      return (
                        <div key={code} className="px-4 py-3 space-y-2">
                          <div>
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{code}</span>
                            <span className="text-[8px] text-slate-400 font-medium uppercase tracking-tighter ml-2">{code.split(':')[1]} action</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {displayRoles.map(r => {
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
                                <span key={r.key} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                  has
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                                    : 'bg-slate-50 dark:bg-slate-700/30 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-700'
                                }`}>
                                  {has ? <Check size={8} strokeWidth={3} /> : <X size={8} />}
                                  {r.label}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 md:p-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 text-slate-400">
             <Shield size={18} className="shrink-0 mt-0.5" />
             <p className="text-xs font-bold">
               Hành động này sẽ thay thế toàn bộ thiết lập quyền hạn hiện tại của các vai trò. Hãy chắc chắn bạn đã kiểm tra kỹ.
             </p>
          </div>
          <div className="flex flex-col-reverse md:flex-row gap-3 md:gap-4">
            <button
              onClick={onClose}
              className="w-full md:w-auto px-6 md:px-8 py-3 md:py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl hover:bg-slate-200 font-black transition-all text-sm whitespace-nowrap"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="w-full md:w-auto px-6 md:px-10 py-3 md:py-4 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 font-black transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2 text-sm whitespace-nowrap"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap size={16} fill="currentColor" />}
              {isApplying ? 'Đang thiết lập...' : 'Xác nhận áp dụng cho toàn công ty'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
