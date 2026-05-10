import { Joyride, Step, STATUS, EventData, TooltipRenderProps } from 'react-joyride'
import { useAuthStore } from '@/store/authStore'
import { useEffect, useState, useMemo } from 'react'
import { authApi } from '@/features/auth/api/authApi'
import { useNavigate } from 'react-router-dom'
import { X, ArrowRight, ArrowLeft } from 'lucide-react'

/* ========== PREMIUM CUSTOM TOOLTIP COMPONENT ========== */
function CustomTooltip({
  index,
  isLastStep,
  size,
  step,
  backProps,
  primaryProps,
  skipProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  return (
    <div
      {...tooltipProps}
      className="max-w-[420px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl shadow-indigo-500/20 border border-slate-100 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative"
    >
      {/* Decorative Top Accent */}
      <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
      
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
             <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase tracking-widest w-fit">
              <span>Bước {index + 1}</span>
              <span className="opacity-30">/</span>
              <span className="opacity-60">{size}</span>
            </div>
          </div>
          <button {...closeProps} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3">
          {step.title && (
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              {step.title}
            </h3>
          )}
          <div className="text-[15px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
            {step.content}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-6 gap-4 border-t border-slate-50 dark:border-slate-800/50">
          <button
            {...skipProps}
            className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors uppercase tracking-wider"
          >
            Bỏ qua
          </button>

          <div className="flex items-center gap-3">
            {index > 0 && (
              <button
                {...backProps}
                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-95"
              >
                <ArrowLeft size={16} />
              </button>
            )}
            <button
              {...primaryProps}
              className="flex items-center gap-3 px-8 py-3 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 group"
            >
              <span>{isLastStep ? 'Xong' : 'Tiếp tục'}</span>
              {!isLastStep && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </div>
        </div>

        {/* Tiny Progress Bar at the very bottom */}
        <div className="absolute bottom-0 left-0 h-1 bg-indigo-100 dark:bg-slate-800 w-full overflow-hidden">
          <div 
            className="h-full bg-indigo-500 transition-all duration-500" 
            style={{ width: `${((index + 1) / size) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default function OnboardingTour() {
  const { user } = useAuthStore()
  const [run, setRun] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const navigate = useNavigate()

  const hasPermission = (permissionCodes: string[]) => {
    if (!user?.permissions) return false
    return permissionCodes.some((code) => user.permissions.includes(code))
  }

  const isDirector = hasPermission(['ORG:CREATE', 'ROLE:VIEW'])
  const isHead = !isDirector && user?.memberships?.some(m => m.roleRank === 0)
  const isDeputy = !isDirector && user?.memberships?.some(m => m.roleRank === 1)
  const isStaff = !isDirector && !isHead && !isDeputy

  const steps: Step[] = useMemo(() => {
    const welcomeStep: Step = {
      target: 'body',
      title: `Chào mừng ${user?.fullName}!`,
      content: (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-2 animate-bounce">👋</div>
          <p>Chào mừng bạn đến với <strong>Hệ thống Quản trị KPI</strong>. Hãy để chúng tôi hướng dẫn bạn qua các tính năng cốt lõi để bắt đầu công việc hiệu quả nhất.</p>
        </div>
      ),
      placement: 'center',
    }

    const finalStep: Step = {
      target: 'body',
      title: 'Sẵn sàng bắt đầu!',
      content: (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mb-2 animate-pulse">✨</div>
          <p>Hành trình giới thiệu đã kết thúc. Hãy bắt đầu xây dựng tổ chức và quản trị KPI hiệu quả ngay bây giờ!</p>
        </div>
      ),
      placement: 'center',
    }

    if (isStaff) {
      return [
        welcomeStep,
        {
          target: '#nav-item--dashboard-staff',
          title: 'Dashboard Cá nhân',
          content: <p>Đây là trung tâm điều hành của bạn. Nơi theo dõi mọi chỉ số hiệu suất cá nhân và danh sách nhiệm vụ cần làm.</p>,
          placement: 'right',
        },
        {
          target: '#tour-staff-stats',
          title: 'Chỉ số Hiệu suất',
          content: <p>Nắm bắt nhanh tỷ lệ phê duyệt, điểm trung bình và số lượng bài đã nộp của bạn trong kỳ này.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-staff-tasks',
          title: 'Nhiệm vụ Tiêu điểm',
          content: <p>Danh sách các KPI quan trọng nhất cần bạn thực hiện và báo cáo ngay lập tức.</p>,
          placement: 'right',
        },
        {
          target: '#tour-staff-submit',
          title: 'Nộp báo cáo mới',
          content: <p>Bất cứ khi nào hoàn thành công việc, hãy vào đây để gửi báo cáo và tài liệu minh chứng cho quản lý.</p>,
          placement: 'bottom',
        },
        {
          target: '#nav-item--my-kpi',
          title: 'Kho chỉ tiêu cá nhân',
          content: (
            <div className="space-y-3">
              <p>Đây là danh sách toàn bộ mục tiêu bạn cần đạt được. Hãy lưu ý:</p>
              <ul className="text-xs space-y-2 list-disc pl-4">
                <li><strong>Trọng số (%):</strong> Mức độ quan trọng của từng chỉ tiêu.</li>
                <li><strong>Mục tiêu:</strong> Con số cụ thể bạn cần chinh phục.</li>
                <li><strong>Hạn nộp:</strong> Theo dõi để không bị trừ điểm muộn.</li>
              </ul>
              <p className="text-xs text-indigo-500 italic font-bold">* Bạn có thể nhấn trực tiếp vào tên KPI để xem hướng dẫn thực hiện chi tiết.</p>
            </div>
          ),
          placement: 'right',
        },
        {
          target: '#tour-my-kpi-toolbar',
          title: 'Tìm kiếm & Lọc chỉ tiêu',
          content: <p>Sử dụng thanh công cụ này để tìm nhanh KPI hoặc lọc theo từng **Kỳ đánh giá** cụ thể để tập trung vào mục tiêu hiện tại.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-my-kpi-table',
          title: 'Bảng theo dõi chi tiết',
          content: <p>Nơi hiển thị tiến độ thực hiện của bạn. Nếu KPI hiển thị nút **"Nộp bài"**, hãy nhấn vào đó để cập nhật kết quả công việc ngay.</p>,
          placement: 'top',
        },
        {
          target: '#nav-item--submissions',
          title: 'Nhật ký kết quả công việc',
          content: (
            <div className="space-y-3">
              <p>Quản lý toàn bộ tiến trình phê duyệt báo cáo của bạn:</p>
              <ul className="text-xs space-y-2 list-disc pl-4">
                <li><strong>Trạng thái:</strong> Biết ngay bài nộp đang Chờ duyệt, Đã duyệt hay cần Sửa đổi.</li>
                <li><strong>Phản hồi:</strong> Xem nhận xét từ cấp trên để cải thiện kết quả.</li>
                <li><strong>Bản nháp:</strong> Các bài chưa gửi đi sẽ nằm trong mục Bản nháp để bạn hoàn thiện thêm.</li>
              </ul>
            </div>
          ),
          placement: 'right',
        },
        {
          target: '#tour-my-sub-tabs',
          title: 'Bộ lọc trạng thái',
          content: <p>Nhanh chóng lọc ra các bài nộp bị **Từ chối** hoặc đang **Chờ duyệt** để kịp thời xử lý và phản hồi quản lý.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-my-sub-list',
          title: 'Danh sách báo cáo đã gửi',
          content: <p>Nhấn vào từng dòng để xem chi tiết bài nộp, các minh chứng đi kèm và đặc biệt là **Nhận xét của Quản lý**.</p>,
          placement: 'top',
        },
        finalStep
      ]
    }

    if (isHead) {
      return [
        welcomeStep,
        {
          target: '#tour-dashboard-nav',
          title: 'Trung tâm Điều hành Quản lý',
          content: (
            <div className="space-y-2">
              <p>Chào mừng bạn đến với Dashboard dành riêng cho cấp Quản lý đơn vị.</p>
              <p className="text-xs text-slate-500 italic">* Nơi bạn có cái nhìn bao quát nhất về hiệu suất làm việc của toàn bộ nhân sự dưới quyền.</p>
            </div>
          ),
          placement: 'right',
        },
        {
          target: '#tour-dashboard-stats',
          title: 'Tổng hợp Chỉ số Nhanh',
          content: (
            <div className="space-y-2">
              <p>Theo dõi thời gian thực 3 thông tin quan trọng nhất:</p>
              <ul className="text-xs space-y-1 list-disc pl-4">
                <li><strong>KPI Chờ duyệt:</strong> Các chỉ tiêu nhân viên vừa thiết lập.</li>
                <li><strong>Báo cáo mới:</strong> Kết quả công việc chờ bạn đánh giá.</li>
                <li><strong>Tổng nhân sự:</strong> Quy mô đội ngũ bạn đang quản lý.</li>
              </ul>
            </div>
          ),
          placement: 'bottom',
        },
        {
          target: '#tour-dashboard-approve-btn',
          title: 'Lối tắt Xử lý Hồ sơ',
          content: <p>Tiết kiệm thời gian bằng cách truy cập thẳng vào trang <strong>Duyệt báo cáo</strong>. Hệ thống sẽ ưu tiên hiển thị các mục cần bạn phản hồi ngay lập tức.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-dashboard-completion',
          title: 'Theo dõi Tiến độ Team',
          content: <p>Biểu đồ này giúp bạn nhận diện nhanh tỷ lệ hoàn thành công việc của team. Bạn sẽ biết ngay team đang "về đích" hay đang gặp khó khăn ở giai đoạn nào.</p>,
          placement: 'right',
        },
        {
          target: '#tour-dashboard-tabs',
          title: 'Bảng Vàng Hiệu suất',
          content: <p>Danh sách chi tiết từng nhân viên cùng điểm số KPI hiện tại. Giúp bạn công bằng trong đánh giá và kịp thời hỗ trợ những cá nhân đang chậm tiến độ.</p>,
          placement: 'top',
        },
        {
          target: '#nav-item--dashboard-staff',
          title: 'Dashboard Cá nhân',
          content: <p>Ngoài việc quản lý team, bạn cũng có các mục tiêu KPI riêng. Hãy chuyển sang <strong>Dashboard cá nhân</strong> để theo dõi lộ trình của chính mình.</p>,
          placement: 'right',
        },
        {
          target: '#tour-staff-submit',
          title: 'Nộp KPI Cá nhân',
          content: <p>Đây là nơi bạn thực hiện nghĩa vụ báo cáo của mình. Hãy nộp kết quả công việc đúng hạn để duy trì hiệu suất tốt nhất.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-staff-stats',
          title: 'Chỉ số Cá nhân',
          content: <p>Nắm bắt nhanh số lượng bài đã nộp, tỷ lệ phê duyệt và điểm trung bình hiện tại của chính bạn.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-staff-tasks',
          title: 'Danh sách Nhiệm vụ',
          content: <p>Toàn bộ các chỉ tiêu bạn được giao sẽ tập trung tại đây. Hệ thống sẽ nhắc nhở các nhiệm vụ sắp đến hạn để bạn không bỏ lỡ.</p>,
          placement: 'right',
        },
        {
          target: '#tour-kpi-nav-group',
          title: 'Hệ thống Quản trị KPI',
          content: <p>Đây là "bộ não" của quy trình. Nơi bạn định nghĩa, phân bổ và giám sát toàn bộ các bộ chỉ tiêu KPI của phòng ban.</p>,
          placement: 'right',
        },
        {
          target: '#nav-item--kpi-criteria',
          title: 'Thiết lập Chỉ tiêu',
          content: <p>Xây dựng thư viện KPI mẫu hoặc giao chỉ tiêu trực tiếp cho từng nhân sự. Bạn có thể quy định trọng số và cách tính điểm tại đây.</p>,
          placement: 'right',
        },
        {
          target: '#tour-kpi-toolbar',
          title: 'Công cụ Tìm kiếm & Lọc',
          content: <p>Sử dụng thanh công cụ này để lọc nhanh KPI theo đợt, phòng ban hoặc tìm kiếm đích danh nhân viên.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-kpi-add-btn',
          title: 'Tạo Chỉ tiêu Mới',
          content: <p>Bấm vào đây để bắt đầu giao KPI cho đội ngũ của bạn. Bạn có thể tạo lẻ hoặc sử dụng tính năng Import để tiết kiệm thời gian.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-kpi-tabs',
          title: 'Quản lý Trạng thái',
          content: <p>Phân loại KPI theo tình trạng: Bản nháp, Chờ duyệt, hay Đã duyệt để dễ dàng quản lý khối lượng công việc.</p>,
          placement: 'top',
        },
        finalStep
      ]
    }

    if (isDeputy) {
      return [
        welcomeStep,
        {
          target: '#tour-dashboard-nav',
          title: 'Tổng quan Đơn vị',
          content: <p>Nơi theo dõi nhanh hiệu suất tổng thể của toàn bộ phòng ban/đơn vị bạn đang phụ trách.</p>,
          placement: 'right',
        },
        {
          target: '#tour-dashboard-stats',
          title: 'Chỉ số Tổng hợp',
          content: <p>Bao gồm tỷ lệ nộp bài, điểm trung bình và các biểu đồ phân tích tiến độ của cả nhóm.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-dashboard-approve-btn',
          title: 'Phê duyệt nhanh',
          content: <p>Nút truy cập nhanh danh sách các báo cáo KPI đang chờ bạn phê duyệt và cho ý kiến.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-dashboard-completion',
          title: 'Tiến độ Hoàn thành',
          content: <p>Biểu đồ trực quan giúp bạn nhận diện ngay những nhân sự nào đang chậm tiến độ hoặc cần hỗ trợ.</p>,
          placement: 'right',
        },
        {
          target: '#tour-dashboard-tabs',
          title: 'Chuyển đổi Chế độ',
          content: <p>Tại đây bạn có thể chuyển đổi linh hoạt giữa Dashboard của <strong>Đơn vị</strong> và <strong>Cá nhân</strong> bạn.</p>,
          placement: 'bottom',
        },
        {
          target: '#nav-item--dashboard-staff',
          title: 'Dashboard Cá nhân',
          content: <p>Bấm vào đây để quay lại trang quản lý KPI của chính bạn, nơi bạn tự nộp báo cáo mỗi kỳ.</p>,
          placement: 'right',
        },
        {
          target: '#tour-staff-submit',
          title: 'Nộp báo cáo mới',
          content: <p>Mỗi khi hoàn thành một chỉ tiêu, hãy bấm vào đây để nộp báo cáo kèm theo tài liệu minh chứng.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-staff-stats',
          title: 'Chỉ số Cá nhân',
          content: <p>Nắm bắt nhanh số lượng bài đã nộp, tỷ lệ phê duyệt và điểm trung bình hiện tại của chính bạn.</p>,
          placement: 'bottom',
        },
        {
          target: '#tour-staff-tasks',
          title: 'Danh sách Nhiệm vụ',
          content: <p>Toàn bộ các chỉ tiêu bạn được giao sẽ tập trung tại đây. Hệ thống sẽ nhắc nhở các nhiệm vụ sắp đến hạn để bạn không bỏ lỡ.</p>,
          placement: 'right',
        },
        finalStep
      ]
    }

    // Default: Director steps
    return [
      welcomeStep,
      {
        target: '#tour-dashboard-nav',
        title: 'Trình điều khiển Trung tâm',
        content: <p>Đây là <strong>Trang Tổng quan</strong>. Nơi quy tụ toàn bộ dữ liệu hiệu suất của tổ chức.</p>,
        placement: 'right',
      },
      {
        target: '#tour-dashboard-stats',
        title: 'Chỉ số Sức khỏe Tổ chức',
        content: (
          <div className="space-y-3">
            <p>4 thẻ chỉ số chính giúp bạn nắm bắt nhanh:</p>
            <ul className="text-xs space-y-2 list-disc pl-4">
              <li><strong>Phòng ban:</strong> Quy mô mạng lưới đơn vị.</li>
              <li><strong>Nhân sự:</strong> Tổng số lượng lao động.</li>
              <li><strong>Chỉ tiêu:</strong> Khối lượng KPI đang vận hành.</li>
              <li><strong>Đánh giá:</strong> Kết quả xếp loại gần nhất.</li>
            </ul>
          </div>
        ),
        placement: 'bottom',
      },
      {
        target: '#tour-dashboard-approve-btn',
        title: 'Lối tắt Phê duyệt',
        content: <p>Là người quản lý, bạn có thể <strong>xử lý nhanh các yêu cầu đang chờ</strong> ngay tại đây.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-dashboard-completion',
        title: 'Biểu đồ Hiệu suất',
        content: <p>Theo dõi <strong>Tỷ lệ hoàn thành công việc</strong> trung bình của toàn công ty.</p>,
        placement: 'right',
      },
      {
        target: '#tour-dashboard-tabs',
        title: 'Đa góc nhìn Dữ liệu',
        content: <p>Chuyển đổi linh hoạt giữa các chế độ xem: Tổng quan, Cơ cấu và Bảng nhân sự.</p>,
        placement: 'top',
      },
      {
        target: '#tour-company-nav-group',
        title: 'Thiết lập Nền tảng',
        content: <p>Cấu hình <strong>5 module nền tảng</strong> định hình quy tắc vận hành của hệ thống.</p>,
        placement: 'right',
      },
      {
        target: '#tour-company-hero',
        title: 'Hồ sơ Doanh nghiệp',
        content: <p><strong>Bước 1:</strong> Xác thực danh tính tổ chức bằng cách cập nhật thông tin pháp lý.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-company-hierarchy',
        title: 'Xây dựng Bộ khung',
        content: <p>Định nghĩa các <strong>Cấp bậc Quản lý</strong> và chức danh cho từng cấp.</p>,
        placement: 'left',
      },
      {
        target: '#tour-company-scoring',
        title: 'Tiêu chuẩn Đánh giá',
        content: <p>Thiết lập các ngưỡng điểm để hệ thống <strong>tự động xếp hạng</strong> nhân viên.</p>,
        placement: 'right',
      },
      {
        target: '#tour-roles-header',
        title: 'Quản lý Vai trò',
        content: <p><strong>Bước 2:</strong> Thiết lập ma trận chức danh và quyền hạn cụ thể.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-roles-table',
        title: 'Chi tiết quyền hạn',
        content: <p>Tùy chỉnh chính xác các hành động mà từng vai trò được phép thực hiện.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-org-view-mode',
        title: 'Thiết lập cấu trúc',
        content: <p><strong>Bước 3:</strong> Xây dựng sơ đồ cây phòng ban trực quan qua Mindmap.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-header',
        title: 'Quản lý Nhân sự',
        content: <p><strong>Bước 4:</strong> Đưa nhân viên vào hệ thống lẻ hoặc Import từ Excel.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-users-filters',
        title: 'Bộ lọc nhân sự',
        content: <p>Truy xuất dữ liệu nhanh chóng theo chức danh, phòng ban hoặc tìm kiếm tên.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-settings-header',
        title: 'Cấu hình hệ thống',
        content: <p><strong>Bước 5:</strong> Cá nhân hóa thuật ngữ công ty và cài đặt thông báo.</p>,
        placement: 'bottom',
      },
      {
        target: '#tour-settings-tabs',
        title: 'Sidebar & Thông báo',
        content: <p>Tự đặt tên các mục menu để phù hợp với văn hóa riêng của doanh nghiệp.</p>,
        placement: 'bottom',
      },
      finalStep
    ]
  }, [user, isHead, isDirector, isDeputy, isStaff])

  useEffect(() => {
    if (user && !user.hasSeenOnboarding) {
      const timer = setTimeout(() => setRun(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [user])

  const filteredSteps = useMemo(() => steps, [steps])
  const handleJoyrideEvent = async (data: EventData) => {
    const { status, index, type, action } = data

    if (type === 'step:after') {
      const currentStep = filteredSteps[index]
      if (!currentStep) return

      if (action === 'next') {
        const target = currentStep.target as string
        if (target === 'body' && index === 0) {
          if (isStaff) navigate('/dashboard/staff')
          else navigate('/dashboard')
        }
        if (target === '#nav-item--dashboard-staff' && isStaff) {
          navigate('/dashboard/staff')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#tour-staff-submit' && isStaff) {
          navigate('/my-kpi')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#nav-item--my-kpi' && isStaff) {
          setStepIndex(index + 1)
          return
        }
        if (target === '#tour-my-kpi-table' && isStaff) {
          navigate('/submissions')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#nav-item--submissions' && isStaff) {
          setStepIndex(index + 1)
          return
        }
        if (target === '#tour-my-sub-list' && isStaff) {
          setStepIndex(index + 1)
          return
        }
        if (target === '#tour-dashboard-tabs' && isDirector) navigate('/company')
        if (target === '#tour-dashboard-tabs' && (isHead || isDeputy)) {
          navigate('/dashboard/staff')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#tour-staff-tasks' && (isHead || isDeputy)) {
          navigate('/dashboard')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#tour-kpi-nav-group' && isHead) {
          navigate('/kpi-criteria')
          setTimeout(() => setStepIndex(index + 1), 100)
          return
        }
        if (target === '#tour-kpi-tabs' && isHead) {
          // Tutorial ends for Head after KPI tabs, final step follows
          setStepIndex(index + 1)
          return
        }
        if (target === '#nav-item--kpi-criteria' && isHead) {
          // Stay on kpi-criteria
          setStepIndex(index + 1)
          return
        }
        if (target === '#tour-company-scoring') navigate('/roles')
        if (target === '#tour-roles-table') navigate('/org-structure')
        if (target === '#tour-org-view-mode') navigate('/users')
        if (target === '#tour-users-filters') navigate('/settings')
        if (target === '#nav-item--analytics' && isHead) navigate('/dashboard/staff')
        
        setStepIndex(index + 1)
      } else if (action === 'prev') {
        const target = currentStep.target as string
        if (target === '#tour-staff-stats' && isStaff) navigate('/dashboard/staff')
        if (target === '#nav-item--my-kpi' && isStaff) navigate('/dashboard/staff')
        if (target === '#tour-my-kpi-toolbar' && isStaff) navigate('/my-kpi')
        if (target === '#nav-item--submissions' && isStaff) navigate('/my-kpi')
        if (target === '#tour-my-sub-tabs' && isStaff) navigate('/submissions')
        if (target === '#tour-dashboard-nav') navigate('/dashboard')
        if (target === '#tour-company-nav-group') navigate('/dashboard')
        if (target === '#nav-item--dashboard-staff' && (isHead || isDeputy || isStaff)) navigate('/dashboard')
        if (target === '#nav-group-quản-lý-kpi' && (isHead || isDeputy)) navigate('/dashboard/staff')
        if (target === '#tour-kpi-nav-group' && (isHead || isDeputy)) navigate('/dashboard/staff')
        if (target === '#nav-item--kpi-criteria' && (isHead || isDeputy)) navigate('/dashboard')
        if (target === '#tour-kpi-toolbar' && isHead) navigate('/dashboard')
        if (target === '#tour-approve-nav-group' && isHead) navigate('/kpi-criteria')
        if (target === '#tour-approve-table' && isHead) navigate('/dashboard')
        if (target === '#nav-item--submissions-org-unit' && isHead) navigate('/dashboard')
        if (target === '#tour-roles-header') navigate('/company')
        if (target === '#tour-org-view-mode') navigate('/roles')
        if (target === '#tour-users-header') navigate('/org-structure')
        if (target === '#tour-settings-header') navigate('/users')
        if (target === '#tour-staff-submit') {
          if (isStaff) navigate('/dashboard/staff')
          else navigate('/dashboard')
        }

        setStepIndex(index - 1)
      }
    }

    // Handle closing, finishing or skipping
    if (([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status) || action === 'close') {
      setRun(false)
      
      // If we are already marked as seen, don't call API again
      if (user?.hasSeenOnboarding) return

      try {
        console.log('Marking onboarding as complete...')
        await authApi.completeOnboarding()
        
        // Update local state immediately
        const updatedUser = { ...user, hasSeenOnboarding: true }
        useAuthStore.getState().setUser(updatedUser as any)
        console.log('Onboarding state updated locally and on server.')
      } catch (error) {
        console.error('Failed to mark onboarding as complete:', error)
        // Fallback: still update local state so it doesn't keep popping up in current session
        const updatedUser = { ...user, hasSeenOnboarding: true }
        useAuthStore.getState().setUser(updatedUser as any)
      }
    }
  }

  return (
    <Joyride
      steps={filteredSteps}
      run={run}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep
      onEvent={handleJoyrideEvent}
      tooltipComponent={CustomTooltip}
      floatingOptions={{
        hideArrow: true,
      }}
      options={{
        primaryColor: '#6366f1',
        textColor: '#1e293b',
        zIndex: 10000,
        backgroundColor: '#fff',
        arrowColor: '#fff',
        showProgress: false,
        buttons: ['back', 'primary', 'skip'],
        spotlightRadius: 24,
        overlayColor: 'rgba(15, 23, 42, 0.7)',
        scrollOffset: 150,
      }}
    />
  )
}
