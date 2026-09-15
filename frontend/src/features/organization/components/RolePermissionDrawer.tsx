import { useState, useEffect, useMemo } from 'react'
import {
  Lock, 
  CheckSquare, 
  Square,
  Loader2,
  Save,
  Search,
  Zap,
  Check
} from 'lucide-react'
import { useAllPermissions, useRolePermissions, useUpdateRolePermissions } from '../hooks/useRolePermissions'
import { RoleResponse } from '../api/role.api'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Drawer, Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface RolePermissionDrawerProps {
  role: RoleResponse | null
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

function PermissionTooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  
  return (
    <div className="relative" onMouseEnter={() => setVisible(true)} onMouseLeave={() => setVisible(false)}>
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-4 bg-[var(--color-foreground)] text-[var(--color-background)] text-xs font-medium rounded-card shadow-2xl z-[200] animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
          <div className="relative">
            {text}
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[var(--color-foreground)]" />
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
      label = role.name;
    } else if (role.level === maxRoleLevel && role.rank === 2) {
      targetType = 'staff';
      label = role.name;
    } else {
      if (role.rank === 0) { targetType = 'manager'; label = role.name; }
      else if (role.rank === 1) { targetType = 'deputy'; label = role.name; }
      else { targetType = 'staff'; label = role.name; }
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

  return (
    <>
    <Drawer
      open={isOpen}
      onClose={onClose}
      size="lg"
      flush
      dismissible={!updateMutation.isPending}
      title="Thiết lập Phân quyền"
      description={<>Vai trò: <span className="font-medium text-[var(--color-foreground)]">{role?.name}</span></>}
      headerExtra={
        <Button variant="outline" size="sm" onClick={handleApplyDefaults} className="shrink-0">
          <Zap aria-hidden="true" />
          <span className="hidden sm:inline">Áp dụng quyền mặc định</span>
          <span className="sm:hidden">Mặc định</span>
        </Button>
      }
      footer={
        <DialogFooter
          note={<>Đã chọn <span className="font-medium text-[var(--color-foreground)] tabular-nums">{selectedIds.size}</span> quyền hạn</>}
          secondary={<Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>Hủy bỏ</Button>}
          primary={
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
              Lưu phân quyền
            </Button>
          }
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Search */}
        <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-subtle-foreground)]" aria-hidden="true" />
            <input
              type="text"
              placeholder="Tìm kiếm quyền hạn hoặc tài nguyên..."
              aria-label="Tìm quyền hạn"
              className="h-9 w-full rounded-control border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-3 text-sm text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-subtle-foreground)] focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Body */}
        <div className="custom-scrollbar min-h-0 flex-1 space-y-6 overflow-y-auto bg-[var(--color-muted)] p-5">
          {(isLoadingAll || isLoadingRole) ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-[var(--color-primary)] animate-spin" />
              <p className="text-[var(--color-muted-foreground)] font-semibold animate-pulse">Đang nạp dữ liệu phân quyền...</p>
            </div>
          ) : (
            Object.entries(groupedPermissions).map(([resource, permissions]) => {
              const allIds = permissions.map(p => p.id)
              const selectedCount = allIds.filter(id => selectedIds.has(id)).length
              const isAllSelected = selectedCount === allIds.length

              return (
                <div key={resource} className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)] transition-all">
                  <div className="p-6 border-b bg-[var(--color-muted)] flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Lock className="w-4 h-4 text-[var(--color-subtle-foreground)]" />
                      <h4 className="text-sm font-semibold text-[var(--color-foreground)]">{resource}</h4>
                      <span className="px-2 py-0.5 bg-[var(--color-primary-soft)] text-[var(--color-primary)] text-xs font-semibold rounded-full">
                        {selectedCount}/{allIds.length}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => toggleResource(resource, permissions)}>
                      {isAllSelected ? 'Hủy chọn tất cả' : 'Chọn tất cả'}
                    </Button>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {permissions.map(p => (
                      <PermissionTooltip key={p.id} text={p.description || PERMISSION_DESCRIPTIONS[p.code] || `Quyền hạn thực hiện hành động ${p.action} trên tài nguyên ${p.resource}.`}>
                        <button
                          onClick={() => togglePermission(p.id)}
                          className={cn(
                            "w-full flex items-center space-x-3 px-4 py-3 rounded-card border transition-all text-left",
                            selectedIds.has(p.id) 
                              ? "bg-[var(--color-primary-soft)] border-[var(--color-border)] text-[var(--color-primary)] shadow-sm" 
                              : "bg-[var(--color-card)] border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-border)]"
                          )}
                        >
                          {selectedIds.has(p.id) ? (
                            <CheckSquare className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                          ) : (
                            <Square className="w-5 h-5 text-[var(--color-subtle-foreground)] shrink-0" />
                          )}
                          <div>
                            <div className="text-sm font-medium truncate tracking-tight">{p.code}</div>
                            <div className="text-eyebrow tracking-tighter">{p.action}</div>
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
      </div>
    </Drawer>

      <Dialog
        open={showDefaultPreview.isOpen}
        onClose={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })}
        size="md"
        title="Xem trước quyền mặc định"
        description={<>Gợi ý cho vai trò: <span className="font-medium text-[var(--color-foreground)]">{showDefaultPreview.type}</span></>}
        footer={
          <DialogFooter
            secondary={<Button variant="outline" onClick={() => setShowDefaultPreview({ ...showDefaultPreview, isOpen: false })}>Hủy bỏ</Button>}
            primary={<Button onClick={confirmApplyDefaults}>Xác nhận áp dụng</Button>}
          />
        }
      >
        <p className="text-eyebrow mb-3">Danh sách mã quyền sẽ được gán</p>
        <div className="grid grid-cols-2 gap-2">
          {showDefaultPreview.codes.map(code => (
            <div key={code} className="flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-caption">
              <Check size={12} className="shrink-0 text-[var(--color-success)]" strokeWidth={3} aria-hidden="true" /> <span className="truncate">{code}</span>
            </div>
          ))}
        </div>
      </Dialog>
    </>
  )
}
