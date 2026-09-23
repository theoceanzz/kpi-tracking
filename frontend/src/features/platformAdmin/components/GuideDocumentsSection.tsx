import { platformAdminApi } from '../api/platformAdminApi'
import RagDocumentsPanel, { type RagDocumentsApi } from '@/features/analytics/components/rag/RagDocumentsPanel'

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
  return (
    <div className="rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <RagDocumentsPanel
        api={GUIDE_API}
        scope="platform"
        canManage
        title="Bộ hướng dẫn sử dụng KeyGo"
        description={
          <>
            Tài liệu chung toàn hệ thống: trợ lý của mọi công ty dùng nó để trả lời "làm sao để…", "ở đâu", kèm ảnh
            màn hình và đường dẫn. Nạp lại sau mỗi lần cập nhật bộ hướng dẫn; tài liệu riêng của từng công ty nằm ở
            Thiết lập công ty của họ.
          </>
        }
        emptyText='Chưa nạp bộ hướng dẫn. Trợ lý của mọi công ty sẽ trả lời "chưa có tài liệu" cho câu hỏi cách dùng.'
        searchPlaceholder="vd. Làm sao để nộp báo cáo KPI?"
      />
    </div>
  )
}
