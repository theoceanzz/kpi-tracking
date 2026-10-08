import { lazy, Suspense } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

// Trình soạn tài liệu kéo theo TipTap + Markdown (+ mammoth khi chuyển .docx) — nạp muộn, chỉ ai mở tài liệu mới tải.
const DocumentEditorPage = lazy(() => import('./DocumentEditorPage'))

export default function LazyDocumentEditorPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1100px]"><LoadingSkeleton type="card" rows={8} /></div>}>
      <DocumentEditorPage />
    </Suspense>
  )
}
