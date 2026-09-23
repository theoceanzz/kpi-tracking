import { useHasPermission } from '@/components/auth/PermissionGate'
import { aiApi } from '@/features/analytics/api/aiApi'
import RagDocumentsPanel, { type RagDocumentsApi } from '@/features/analytics/components/rag/RagDocumentsPanel'

const ORG_API: RagDocumentsApi = {
  list: aiApi.listRagDocuments,
  upload: (file, title, source) => aiApi.uploadRagDocument(file, source ?? 'REGULATION', title),
  remove: aiApi.deleteRagDocument,
  chunks: aiApi.listRagChunks,
  search: aiApi.searchRag,
}

const SOURCE_OPTIONS = [
  { value: 'REGULATION' as const, label: 'Quy chế, quy định nội bộ', hint: 'Trợ lý trích để trả lời "quy chế nói gì", "ai được phép", "khiếu nại thế nào".' },
  { value: 'JOB_DESCRIPTION' as const, label: 'Mô tả công việc / chức năng nhiệm vụ', hint: 'Gợi ý KPI sẽ bám vào nhiệm vụ thật của đơn vị ghi trong đây, thay vì chỉ bám số liệu.' },
  { value: 'STRATEGY' as const, label: 'Chiến lược, mục tiêu năm', hint: 'Gợi ý KPI sẽ hướng theo mục tiêu công ty đang theo đuổi; trợ lý cũng trả lời được "mục tiêu năm nay là gì".' },
]

/**
 * Tài liệu CỦA TỔ CHỨC mà trợ lý AI dùng. Ba loại, hai chỗ dùng: quy chế → nhánh hỏi đáp; mô tả
 * công việc và chiến lược → gợi ý KPI (và hỏi đáp). Chỉ người trong tổ chức được trợ lý trích.
 *
 * <p>Bộ hướng dẫn sử dụng KeyGo không nằm ở đây: nó là của sản phẩm, dùng chung mọi công ty, nên
 * quản trị nền tảng nạp ở trang Quản trị nền tảng.
 */
export default function AiDocumentsSettingsTab() {
  const { hasPermission } = useHasPermission()
  return (
    <RagDocumentsPanel
      api={ORG_API}
      scope="org"
      canManage={hasPermission('COMPANY:UPDATE')}
      sourceOptions={SOURCE_OPTIONS}
      title="Tài liệu trợ lý AI"
      description={
        <>
          Trợ lý dùng tài liệu của tổ chức bạn để trả lời "quy chế nói gì" và để gợi ý KPI bám nhiệm vụ, chiến lược
          thật. Chỉ người trong tổ chức mới được trợ lý trích. Bộ hướng dẫn sử dụng KeyGo là tài liệu chung của hệ
          thống, do quản trị nền tảng nạp.
        </>
      }
      emptyText='Chưa có tài liệu nào. Trợ lý sẽ trả lời "chưa có tài liệu" cho câu hỏi về quy chế, và gợi ý KPI chỉ dựa trên số liệu.'
      searchPlaceholder="vd. Xếp loại xuất sắc thì được thưởng gì?"
    />
  )
}
