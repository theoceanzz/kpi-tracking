import { SlidersHorizontal, Target } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import { ScoringConfigSection, QualitativeConfigSection } from '../components/ScoringSections'

type TabKey = 'quantitative' | 'qualitative'

/**
 * Kiểu của `org` bám theo chính hai section bên dưới, thay vì khai lại `any` lần nữa:
 * khi nào tổ chức có kiểu thật thì trang này ăn theo mà không phải sửa.
 */
type ScoringSectionProps = Parameters<typeof ScoringConfigSection>[0]

/**
 * Định lượng và định tính là hai nửa của cùng một câu hỏi — "chấm KPI theo thang nào" —
 * nên đi chung một mục thay vì hai thẻ nằm cạnh nhau trên lưới. Tách ra thì người dùng
 * phải quay về lưới mới đối chiếu được hai thang, trong khi chúng ăn khớp với nhau
 * (điểm định tính quy đổi sang % để tính hiệu suất chung).
 *
 * Tab định tính chỉ hiện khi tổ chức bật KPI hành vi, đúng như hồi còn là hai thẻ rời:
 * tắt cờ thì mục này còn đúng một tab và `WorkspaceHeader` tự bỏ hàng tab đi.
 *
 * Dùng `?scoring=` chứ không phải `?tab=` để không đụng tham số của các mục khác trong
 * cùng trang Thiết lập công cụ.
 */
export default function ScoringSettingsPage({
  org,
  enableQualitative,
}: ScoringSectionProps & { enableQualitative: boolean }) {
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>(
    [
      { key: 'quantitative', label: 'Định lượng', icon: Target },
      { key: 'qualitative', label: 'Định tính', icon: SlidersHorizontal, visible: enableQualitative },
    ],
    { param: 'scoring' }
  )

  return (
    <WorkspaceTabsProvider
      tabs={visibleTabs}
      activeTab={activeTab}
      setActiveTab={key => setActiveTab(key as TabKey)}
    >
      {activeTab === 'quantitative' && <ScoringConfigSection org={org} />}
      {activeTab === 'qualitative' && <QualitativeConfigSection org={org} />}
    </WorkspaceTabsProvider>
  )
}
