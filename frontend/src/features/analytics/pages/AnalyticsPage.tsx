import { TrendingUp } from 'lucide-react'
import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { useAuthStore } from '@/store/authStore'
import { useOrganization } from '@/features/orgunits/hooks/useOrganization'
import MyStatsTab from './MyStatsTab'
import DrillDownTab from './DrillDownTab'
import SummaryTab from './SummaryTab'
import MyObjectivesTab from './MyObjectivesTab'
import BscAnalyticsTab from './BscAnalyticsTab'
import SubordinateManagementTab from './SubordinateManagementTab'

/**
 * Các góc nhìn phân tích trong một trang: lưới thẻ để chọn, rồi hàng tab mảnh khi đã
 * vào một mục — cùng khuôn với Quản lý hiệu suất và hai trang thiết lập.
 *
 * Quyền của từng mục nằm ở cây nav; ở đây chỉ quyết định cặp nào hiện theo cờ tính
 * năng của tổ chức: bật OKR thì xem theo mục tiêu, tắt thì xem theo KPI.
 */
export default function AnalyticsPage() {
  const { user } = useAuthStore()
  const pageTitle = usePageTitle('analytics', 'Thống kê')

  const organizationId = user?.memberships?.[0]?.organizationId
  const { data: org, isLoading: loadingOrg } = useOrganization(organizationId)
  const isOkr = org?.enableOkr ?? false
  const isBsc = org?.enableBsc ?? false

  // Chờ cờ tính năng rồi mới vẽ: dựng lưới bằng giá trị mặc định sẽ hiện nhầm cặp KPI
  // rồi nháy sang cặp mục tiêu ngay sau đó.
  if (loadingOrg) {
    return (
      <div className="max-w-[1600px] mx-auto px-4 md:px-0 pb-20 space-y-8 animate-pulse">
        <div className="space-y-3">
          <div className="h-6 w-44 bg-[var(--color-muted)] rounded-full" />
          <div className="h-9 w-36 bg-[var(--color-muted)] rounded-xl" />
          <div className="h-4 w-full max-w-80 bg-[var(--color-muted)] rounded-lg" />
        </div>
        {/* Cùng ngưỡng cột với lưới thật trong SettingsSectionLayout — khung xương nhảy
            khác số cột rồi mới đổ nội dung thì thấy rõ một nhịp giật. */}
        <div className="@container space-y-3">
          <div className="h-3 w-24 bg-[var(--color-muted)] rounded-full" />
          <div className="grid gap-4 grid-cols-1 @lg:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-36 bg-[var(--color-muted)] rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <SettingsSectionLayout
        navId="analytics"
        title={pageTitle}
        subtitle="Phân tích hiệu suất KPI, bài nộp và đánh giá"
        eyebrow={
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 text-xs font-black uppercase tracking-widest mb-3">
            <TrendingUp size={14} /> Thống kê & Phân tích
          </div>
        }
        sections={[
          { id: 'my-objectives', visible: isOkr, render: () => <MyObjectivesTab /> },
          { id: 'subordinate', visible: isOkr, render: () => <SubordinateManagementTab /> },
          { id: 'my', visible: !isOkr, render: () => <MyStatsTab /> },
          { id: 'summary', visible: !isOkr, render: () => <SummaryTab /> },
          { id: 'drilldown', render: () => <DrillDownTab /> },
          { id: 'bsc', visible: isBsc, render: () => <BscAnalyticsTab /> },
        ]}
      />
    </>
  )
}
