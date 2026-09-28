import { useHasPermission } from '@/components/auth/PermissionGate'
import { aiApi } from '@/features/analytics/api/aiApi'
import RagDocumentsPanel, { type RagDocumentsApi } from '@/features/analytics/components/rag/RagDocumentsPanel'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'

const ORG_API: RagDocumentsApi = {
  list: aiApi.listRagDocuments,
  upload: (file, title, source) => aiApi.uploadRagDocument(file, source ?? 'REGULATION', title),
  remove: aiApi.deleteRagDocument,
  chunks: aiApi.listRagChunks,
  search: aiApi.searchRag,
}

const SOURCE_OPTIONS = perLanguage(() => ([
  { value: 'REGULATION' as const, label: i18n.t('organization:AiDocumentsSettingsTab.internalRegulationsAndRules'), hint: i18n.t('organization:AiDocumentsSettingsTab.theAssistantQuotesTheseToAnswer') },
  { value: 'JOB_DESCRIPTION' as const, label: i18n.t('organization:AiDocumentsSettingsTab.jobDescriptionsDutiesAndResponsibilities'), hint: i18n.t('organization:AiDocumentsSettingsTab.kpiSuggestionsWillFollowTheUnits') },
  { value: 'STRATEGY' as const, label: i18n.t('organization:AiDocumentsSettingsTab.strategyAndAnnualGoals'), hint: i18n.t('organization:AiDocumentsSettingsTab.kpiSuggestionsWillFollowTheGoals') },
]))

/**
 * Tài liệu CỦA TỔ CHỨC mà trợ lý AI dùng. Ba loại, hai chỗ dùng: quy chế → nhánh hỏi đáp; mô tả
 * công việc và chiến lược → gợi ý KPI (và hỏi đáp). Chỉ người trong tổ chức được trợ lý trích.
 *
 * <p>Bộ hướng dẫn sử dụng KeyGo không nằm ở đây: nó là của sản phẩm, dùng chung mọi công ty, nên
 * quản trị nền tảng nạp ở trang Quản trị nền tảng.
 */
export default function AiDocumentsSettingsTab() {
  const { t } = useTranslation('organization')
  const { hasPermission } = useHasPermission()
  return (
    <RagDocumentsPanel
      api={ORG_API}
      scope="org"
      canManage={hasPermission('COMPANY:UPDATE')}
      sourceOptions={SOURCE_OPTIONS()}
      title={t('AiDocumentsSettingsTab.aiAssistantDocuments')}
      description={
        <>
          {t('AiDocumentsSettingsTab.theAssistantUsesYourOrganizationsDocuments')}
        </>
      }
      emptyText={t('AiDocumentsSettingsTab.noDocumentsYetTheAssistantWill')}
      searchPlaceholder={t('AiDocumentsSettingsTab.eGWhatRewardDoesAn')}
    />
  )
}
