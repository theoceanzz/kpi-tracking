import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import AiQuotaPanel from '../components/AiQuotaPanel'

/**
 * Trang phân bổ hạn mức token AI.
 *
 * <p>Dùng chung cho cả quản lý cao nhất lẫn trưởng đơn vị — nội dung tự đổi theo vai trò.
 * Gác bằng quyền AI_QUOTA:ALLOCATE thay vì đặt trong /settings, vì /settings đòi ORG:VIEW +
 * USER:VIEW + ROLE:VIEW mà trưởng đơn vị không có.
 */
export default function AiQuotaPage() {
  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <WorkspaceHeader
        title="Hạn mức AI"
        description="Chia hạn mức token AI hằng tháng cho nhân sự thuộc phạm vi quản lý của bạn."
      />

      <AiQuotaPanel />
    </div>
  )
}
