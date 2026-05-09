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

  const steps: Step[] = useMemo(() => [
    {
      target: 'body',
      title: `Chào mừng ${user?.fullName}!`,
      content: (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-3xl mb-2 animate-bounce">
            👋
          </div>
          <p>
            Chào mừng bạn đến với <strong>Hệ thống Quản trị KPI</strong>. Hãy để chúng tôi hướng dẫn bạn qua các tính năng cốt lõi để bắt đầu công việc hiệu quả nhất.
          </p>
        </div>
      ),
      placement: 'center',
    },
    {
      target: '#tour-dashboard-nav',
      title: 'Trình điều khiển Trung tâm',
      content: (
        <div className="space-y-2">
          <p>
            Đây là <strong>Trang Tổng quan</strong>. Nơi quy tụ toàn bộ dữ liệu hiệu suất của tổ chức.
          </p>
          <p className="text-xs text-slate-400 italic">
            * Dữ liệu được cập nhật thời gian thực từ tất cả các đơn vị thành viên.
          </p>
        </div>
      ),
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
      content: (
        <p>
          Là người quản lý, bạn có thể <strong>xử lý nhanh các yêu cầu đang chờ</strong> ngay tại đây. Nút này hiển thị số lượng hồ sơ cần bạn phản hồi gấp.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-dashboard-completion',
      title: 'Biểu đồ Hiệu suất',
      content: (
        <p>
          Theo dõi <strong>Tỷ lệ hoàn thành công việc</strong> trung bình của toàn công ty. Giúp bạn nhận diện ngay các điểm nóng hoặc các đơn vị đang hoạt động xuất sắc.
        </p>
      ),
      placement: 'right',
    },
    {
      target: '#tour-dashboard-tabs',
      title: 'Đa góc nhìn Dữ liệu',
      content: (
        <div className="space-y-2">
          <p>Chuyển đổi linh hoạt giữa 3 chế độ xem:</p>
          <ul className="text-xs space-y-1 list-disc pl-4">
            <li><strong>Tổng quan:</strong> Toàn cảnh công ty.</li>
            <li><strong>Cơ cấu:</strong> So sánh hiệu suất giữa các đơn vị.</li>
            <li><strong>Bảng nhân sự:</strong> Chi tiết từng cá nhân.</li>
          </ul>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '#tour-company-nav-group',
      title: 'Thiết lập Nền tảng',
      content: (
        <p>
          Trước khi bắt đầu, hãy cấu hình <strong>5 module nền tảng</strong> này. Đây là nơi định hình "DNA" và quy tắc vận hành của hệ thống đối với tổ chức của bạn.
        </p>
      ),
      placement: 'right',
    },
    {
      target: '#tour-company-hero',
      title: 'Hồ sơ Doanh nghiệp',
      content: (
        <p>
          <strong>Bước 1:</strong> Xác thực danh tính tổ chức bằng cách cập nhật Tên, Mã số thuế và thông tin pháp lý chính thức.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-company-hierarchy',
      title: 'Xây dựng Bộ khung',
      content: (
        <div className="space-y-2">
          <p>
            Định nghĩa các <strong>Cấp bậc Quản lý</strong> (Ví dụ: Công ty {"->"} Phòng ban {"->"} Tổ nhóm).
          </p>
          <p className="text-xs font-bold text-indigo-500">
            * Đây là nơi bạn đặt tên cho các Chức danh Quản lý cho từng cấp.
          </p>
        </div>
      ),
      placement: 'left',
    },
    {
      target: '#tour-company-scoring',
      title: 'Tiêu chuẩn Đánh giá',
      content: (
        <p>
          Thiết lập các ngưỡng điểm để phân loại nhân viên (Xuất sắc, Tốt, Khá...). Hệ thống sẽ <strong>tự động xếp hạng</strong> dựa trên cấu hình này.
        </p>
      ),
      placement: 'right',
    },
    {
      target: '#tour-roles-header',
      title: 'Quản lý Vai trò',
      content: (
        <p>
          <strong>Bước 2:</strong> Thiết lập ma trận chức danh. Bạn có thể định nghĩa quyền hạn cụ thể cho từng vị trí lãnh đạo hoặc nhân viên.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-roles-table',
      title: 'Chi tiết quyền hạn',
      content: (
        <p>
          Sử dụng nút <strong>Phân quyền</strong> để tùy chỉnh chính xác các hành động mà từng vai trò được phép thực hiện trên hệ thống.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-org-view-mode',
      title: 'Thiết lập cấu trúc',
      content: (
        <p>
          <strong>Bước 3:</strong> Xây dựng sơ đồ cây phòng ban. Tương tác trực quan qua Mindmap để nắm bắt toàn bộ dòng chảy nhân sự.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-users-header',
      title: 'Quản lý Nhân sự',
      content: (
        <p>
          <strong>Bước 4:</strong> Đưa nhân viên vào hệ thống. Bạn có thể thêm lẻ hoặc <strong>Import hàng loạt từ Excel</strong> chỉ trong vài giây.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-users-filters',
      title: 'Bộ lọc nhân sự',
      content: (
        <p>
          Truy xuất dữ liệu nhanh chóng theo chức danh, phòng ban hoặc tìm kiếm thông minh theo tên.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-settings-header',
      title: 'Cấu hình hệ thống',
      content: (
        <p>
          <strong>Bước 5:</strong> Nơi tùy chỉnh trải nghiệm. Cá nhân hóa thuật ngữ công ty và cài đặt các quy tắc thông báo tự động.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: '#tour-settings-tabs',
      title: 'Sidebar & Thông báo',
      content: (
        <p>
          Bạn có thể <strong>tự đặt tên các mục menu</strong> để phù hợp với văn hóa riêng của doanh nghiệp mình.
        </p>
      ),
      placement: 'bottom',
    },
    {
      target: 'body',
      title: 'Sẵn sàng bắt đầu!',
      content: (
        <div className="space-y-4">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl mb-2 animate-pulse">
            ✨
          </div>
          <p>
            Hành trình giới thiệu đã kết thúc. Hãy bắt đầu xây dựng tổ chức và quản trị KPI hiệu quả ngay bây giờ!
          </p>
        </div>
      ),
      placement: 'center',
    },
  ], [user])

  useEffect(() => {
    if (user && !user.hasSeenOnboarding) {
      const timer = setTimeout(() => setRun(true), 1500)
      return () => clearTimeout(timer)
    }
  }, [user])

  const handleJoyrideEvent = async (data: EventData) => {
    const { status, index, type, action } = data

    if (type === 'step:after') {
      if (action === 'next') {
        if (index === 0) navigate('/dashboard')
        if (index === 5) navigate('/company')
        if (index === 9) navigate('/roles')
        if (index === 11) navigate('/org-structure')
        if (index === 12) navigate('/users')
        if (index === 14) navigate('/settings')
        
        setStepIndex(index + 1)
      } else if (action === 'prev') {
        if (index === 1) navigate('/dashboard')
        if (index === 6) navigate('/dashboard')
        if (index === 10) navigate('/company')
        if (index === 12) navigate('/roles')
        if (index === 13) navigate('/org-structure')
        if (index === 15) navigate('/users')

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

  const filteredSteps = useMemo(() => steps.filter(step => {
    if (step.target === '#tour-company-nav-group') return hasPermission(['ORG:CREATE', 'ROLE:VIEW'])
    return true
  }), [steps, user])

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
