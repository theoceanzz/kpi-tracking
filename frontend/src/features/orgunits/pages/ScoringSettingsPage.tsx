import { SlidersHorizontal, Target, HeartHandshake } from 'lucide-react'
import { useTabParam } from '@/hooks/useTabParam'
import { WorkspaceTabsProvider } from '@/components/common/WorkspaceTabs'
import { ScoringConfigSection, QualitativeConfigSection } from '../components/ScoringSections'
import ConductConfigSection from '@/features/conduct/components/ConductConfigSection'

type TabKey = 'quantitative' | 'qualitative' | 'conduct'

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
 * Hạnh kiểm là thang thứ ba của cùng câu hỏi đó nên nằm chung ở đây, không tách mục
 * riêng: nó cũng là một bộ tiêu chí có trọng số và cũng đổ vào ma trận xếp loại — chỉ
 * khác ở chỗ nó lấp trục nào còn trống.
 *
 * Mỗi tab chỉ hiện khi tổ chức bật module tương ứng — định tính theo `enableQualitative`,
 * hạnh kiểm theo `enableConduct` — giống hệt nhau để trang không có chỗ nào "hiện nhưng
 * dùng không được". Tắt hết thì mục này còn đúng một tab và `WorkspaceHeader` tự bỏ hàng
 * tab đi. Muốn khai báo trước khi dùng thì bật module ở mục Module &amp; tính năng.
 *
 * Dùng `?scoring=` chứ không phải `?tab=` để không đụng tham số của các mục khác trong
 * cùng trang Thiết lập công cụ.
 */
export default function ScoringSettingsPage({
  org,
  enableQualitative,
  enableConduct,
}: ScoringSectionProps & { enableQualitative: boolean; enableConduct: boolean }) {
  const { activeTab, setActiveTab, visibleTabs } = useTabParam<TabKey>(
    [
      { key: 'quantitative', label: 'Định lượng', icon: Target },
      { key: 'qualitative', label: 'Định tính', icon: SlidersHorizontal, visible: enableQualitative },
      { key: 'conduct', label: 'Hạnh kiểm', icon: HeartHandshake, visible: enableConduct },
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
      {activeTab === 'conduct' && <ConductConfigSection org={org} />}
    </WorkspaceTabsProvider>
  )
}
