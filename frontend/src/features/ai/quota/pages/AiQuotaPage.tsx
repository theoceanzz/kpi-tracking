import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import AiQuotaPanel from '../components/AiQuotaPanel'
import { useTranslation } from 'react-i18next'

/**
 * Trang phân bổ hạn mức token AI.
 *
 * <p>Dùng chung cho cả quản lý cao nhất lẫn trưởng đơn vị — nội dung tự đổi theo vai trò.
 * Gác bằng quyền AI_QUOTA:ALLOCATE thay vì đặt trong /settings, vì /settings đòi ORG:VIEW +
 * USER:VIEW + ROLE:VIEW mà trưởng đơn vị không có.
 */
export default function AiQuotaPage() {
  const { t } = useTranslation('organization')
  return (
    <div className="space-y-5">
      <WorkspaceHeader
        title={t('AiQuotaPage.aiQuota')}
        description={t('AiQuotaPage.allocateTheMonthlyAiTokenQuota')}
      />

      <AiQuotaPanel />
    </div>
  )
}
