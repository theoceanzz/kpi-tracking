import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useOverviewStats } from '../hooks/useOverviewStats'
import {
  TrendingUp, 
  AlertTriangle,
  Briefcase,
  Star,
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Zap
} from 'lucide-react'

// Dummy data to fulfill the executive dashboard requirements
const dummyAlerts = [
  { id: 1, type: 'critical', title: 'Doanh số tín dụng đang giảm', desc: 'Chi nhánh Hà Nội tụt 15% so với tuần trước. Nguyên nhân: Chậm phê duyệt hồ sơ. Hành động: Giám đốc rà soát ngay quy trình tại CN.', branch: 'Hà Nội' },
  { id: 2, type: 'warning', title: 'Năng suất nhân sự thấp', desc: 'Phòng ban Nguồn vốn có 3 nhân sự chưa đạt 50% chỉ tiêu tuần.', branch: 'Nguồn vốn' }
]

const performanceData = [
  { label: 'Doanh số (Doanh thu)', value: '12.4 Tỷ', target: '15 Tỷ', percent: 82, trend: 'up', icon: <TrendingUp size={20} />, color: 'text-blue-500', bg: 'bg-blue-500/10', bar: 'bg-blue-500' },
  { label: 'Chất lượng Dịch vụ', value: '4.8/5', target: '4.5', percent: 100, trend: 'up', icon: <Star size={20} />, color: 'text-emerald-500', bg: 'bg-emerald-500/10', bar: 'bg-emerald-500' },
  { label: 'Năng suất nhân sự', value: '75%', target: '100%', percent: 75, trend: 'down', icon: <Briefcase size={20} />, color: 'text-amber-500', bg: 'bg-amber-500/10', bar: 'bg-amber-500' },
]

export default function DirectorDashboard() {
  const { data: stats, isLoading } = useOverviewStats()

  if (isLoading) return <LoadingSkeleton rows={4} />

  // Overall monthly progress fake calc
  const monthlyProgress = 68

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bảng Thống kê Điều hành</h1>
        </div>
        <div className="px-4 py-2 bg-[var(--color-card)] border border-[var(--color-border)] rounded-full text-sm font-medium flex items-center gap-2 shadow-sm">
          <Activity size={16} className="text-[var(--color-primary)]" />
          <span>Tháng hiện tại: {new Date().getMonth() + 1}/{new Date().getFullYear()}</span>
        </div>
      </div>

      {/* Cảnh báo (Alerts) Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dummyAlerts.map(alert => (
          <div key={alert.id} className={`p-4 rounded-xl border flex gap-4 items-start ${alert.type === 'critical' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/50' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50'}`}>
            <div className={`p-2 rounded-lg shrink-0 mt-1 ${alert.type === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'}`}>
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className={`font-bold text-sm ${alert.type === 'critical' ? 'text-red-800 dark:text-red-400' : 'text-amber-800 dark:text-amber-400'}`}>
                  [CẢNH BÁO] {alert.title}
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 mix-blend-multiply">{alert.branch}</span>
              </div>
              <p className={`text-sm leading-relaxed ${alert.type === 'critical' ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {alert.desc}
              </p>
              <div className="mt-3">
                <button className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${alert.type === 'critical' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}`}>
                  Xử lý ngay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tiến độ tháng (Monthly Progress) */}
      <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm">
        <div className="flex justify-between items-end mb-2">
          <div>
            <h3 className="text-lg font-bold">Tiến độ Kế hoạch Tháng</h3>
            <p className="text-sm text-[var(--color-muted-foreground)]">Dựa trên tổng chỉ tiêu đã giao toàn công ty</p>
          </div>
          <span className="text-2xl font-black text-[var(--color-primary)]">{monthlyProgress}%</span>
        </div>
        <div className="w-full bg-[var(--color-muted)] rounded-full h-3 mb-2 overflow-hidden">
          <div className="bg-[var(--color-primary)] h-3 rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${monthlyProgress}%` }}>
            <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-[var(--color-muted-foreground)] font-medium">
          <span>Khởi động</span>
          <span>Sắp đạt mục tiêu (Còn 12 ngày)</span>
        </div>
      </div>

      {/* Key Business Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {performanceData.map((item, idx) => (
          <div key={idx} className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div className={`${item.bg} ${item.color} w-10 h-10 rounded-lg flex items-center justify-center`}>
                {item.icon}
              </div>
              <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${item.trend === 'up' ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'}`}>
                {item.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {item.trend === 'up' ? '+12%' : '-5%'}
              </div>
            </div>
            <p className="text-[var(--color-muted-foreground)] text-sm font-medium mb-1">{item.label}</p>
            <h3 className="text-2xl font-bold mb-4">{item.value} <span className="text-sm font-normal text-[var(--color-muted-foreground)]">/ {item.target}</span></h3>
            
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span>Đạt được</span>
                <span className="font-semibold">{item.percent}%</span>
              </div>
              <div className="w-full bg-[var(--color-muted)] rounded-full h-1.5">
                <div className={`${item.bar} h-1.5 rounded-full`} style={{ width: `${item.percent}%` }}></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Internal System Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={20} className="text-amber-500" />
            <h3 className="font-semibold text-lg">Hoạt động Thực thi KPI</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
              <p className="text-[var(--color-muted-foreground)] text-xs font-medium mb-1 uppercase tracking-wider">Phòng ban</p>
              <p className="text-xl font-bold">{stats?.totalDepartments ?? 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
              <p className="text-[var(--color-muted-foreground)] text-xs font-medium mb-1 uppercase tracking-wider">Nhân sự</p>
              <p className="text-xl font-bold">{stats?.totalUsers ?? 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
              <p className="text-[var(--color-muted-foreground)] text-xs font-medium mb-1 uppercase tracking-wider">Chỉ tiêu</p>
              <p className="text-xl font-bold text-[var(--color-primary)]">{stats?.totalKpiCriteria ?? 0}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--color-muted)]/50 text-center">
              <p className="text-[var(--color-muted-foreground)] text-xs font-medium mb-1 uppercase tracking-wider">Bài nộp</p>
              <p className="text-xl font-bold text-emerald-500">{stats?.totalSubmissions ?? 0}</p>
            </div>
          </div>
          
          <div className="border-t border-[var(--color-border)] pt-4">
             <h4 className="text-sm font-semibold mb-3">Thông tin tỷ lệ phê duyệt bài nộp:</h4>
             <div className="h-4 w-full bg-[var(--color-muted)] flex rounded-full overflow-hidden">
                <div style={{width: `${stats?.totalSubmissions ? ((stats.approvedSubmissions/stats.totalSubmissions)*100) : 0}%`}} className="bg-emerald-500" title={`Đã duyệt: ${stats?.approvedSubmissions ?? 0}`}></div>
                <div style={{width: `${stats?.totalSubmissions ? ((stats.rejectedSubmissions/stats.totalSubmissions)*100) : 0}%`}} className="bg-red-500" title={`Từ chối: ${stats?.rejectedSubmissions ?? 0}`}></div>
                <div style={{width: `${stats?.totalSubmissions ? ((stats.pendingSubmissions/stats.totalSubmissions)*100) : 0}%`}} className="bg-amber-400" title={`Chờ duyệt: ${stats?.pendingSubmissions ?? 0}`}></div>
             </div>
             <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-muted-foreground)]">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Đã duyệt ({stats?.approvedSubmissions ?? 0})</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-amber-400"></div> Chờ duyệt ({stats?.pendingSubmissions ?? 0})</span>
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> Từ chối ({stats?.rejectedSubmissions ?? 0})</span>
             </div>
          </div>
        </div>

        <div className="bg-[var(--color-card)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-semibold text-lg mb-1">Cảnh báo hệ thống</h3>
            <p className="text-sm text-[var(--color-muted-foreground)] mb-4">Các chỉ tiêu cần được Giám đốc xét duyệt hoặc phòng ban cần can thiệp hành chính.</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-amber-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium">Có {stats?.pendingSubmissions ?? 0} bài nộp chờ xử lý</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Cần các phòng ban duyệt để chốt tiến độ.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-red-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium">12 nhân sự chưa có KPI</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Nhân sự mới gia nhập hệ thống tuần này.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0"></div>
              <div>
                <p className="text-sm font-medium">Hoàn thành đánh giá quý</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Chỉ còn 3 ngày để kết thúc chu kỳ đánh giá.</p>
              </div>
            </div>
          </div>
          
          <button className="w-full mt-6 px-4 py-2 bg-[var(--color-muted)] hover:bg-[var(--color-accent)] rounded-lg text-sm font-medium transition-colors">
            Xem chi tiết báo cáo
          </button>
        </div>
      </div>
    </div>
  )
}
