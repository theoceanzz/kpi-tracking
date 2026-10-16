import { lazy, Suspense } from 'react'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'

// Trang công khai cho người nhận email — tách gói riêng, không kéo theo khung ứng dụng.
const PublicDocumentPage = lazy(() => import('./PublicDocumentPage'))

export default function LazyPublicDocumentPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[1100px] p-6"><LoadingSkeleton type="card" rows={6} /></div>}>
      <PublicDocumentPage />
    </Suspense>
  )
}
