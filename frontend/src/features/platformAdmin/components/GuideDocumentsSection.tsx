import { platformAdminApi } from '../api/platformAdminApi'
import RagDocumentsPanel, { type RagDocumentsApi } from '@/features/analytics/components/rag/RagDocumentsPanel'
import { useTranslation } from 'react-i18next'

const GUIDE_API: RagDocumentsApi = {
  list: platformAdminApi.listGuideDocuments,
  upload: (file, title) => platformAdminApi.uploadGuideDocument(file, title),
  remove: platformAdminApi.deleteGuideDocument,
  chunks: platformAdminApi.listGuideChunks,
  search: platformAdminApi.searchGuide,
}

/**
 * Bộ hướng dẫn sử dụng KeyGo trong kho tri thức của trợ lý — tài liệu CHUNG, mọi công ty đều được
 * trợ lý trích. Nạp/xoá ở đây đổi câu trả lời cho tất cả khách hàng, nên chỉ quản trị nền tảng.
 */
export default function GuideDocumentsSection() {
  const { t } = useTranslation('platformAdmin')
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <RagDocumentsPanel
        api={GUIDE_API}
        scope="platform"
        canManage
        title={t('GuideDocumentsSection.keygoUserGuide')}
        description={
          <>
            {t('GuideDocumentsSection.aSharedSystemWideDocumentEvery')}
          </>
        }
        emptyText={t('GuideDocumentsSection.theGuideHasNotBeenLoaded')}
        searchPlaceholder={t('GuideDocumentsSection.eGHowDoISubmit')}
      />
    </div>
  )
}
