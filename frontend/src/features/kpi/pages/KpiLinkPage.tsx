import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/apiError'
import { kpiApi } from '../api/kpiApi'
import KpiDetailModal, { type KpiDetailTab } from '../components/KpiDetailModal'

/**
 * Link sâu tới một KPI: `/kpi/:id?tab=discussion|tasks&comment=<id>`. Dùng cho thông báo (bình luận, KPI bị thay)
 * và link "xem KPI kia" trong dòng hệ thống. Quyền xem do backend kiểm (luật xem KPI chung).
 */
export default function KpiLinkPage() {
  const { t } = useTranslation('kpi')
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const tabParam = params.get('tab')
  const tab: KpiDetailTab = tabParam === 'discussion' || tabParam === 'tasks' ? tabParam : 'info'
  const { data: kpi, isLoading, error } = useQuery({
    queryKey: ['kpi-criteria', 'one', id],
    queryFn: () => kpiApi.getById(id!),
    enabled: !!id,
  })

  const close = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/me?section=my-kpi', { replace: true })
  }

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-[var(--color-subtle-foreground)]" /></div>
  }
  if (error || !kpi) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-sm text-[var(--color-error)]">
        {getApiErrorMessage(error, t('KpiLinkPage.notFound'))}
        <Button variant="outline" onClick={() => navigate('/me?section=my-kpi')}>{t('KpiLinkPage.back')}</Button>
      </div>
    )
  }
  return <KpiDetailModal open kpi={kpi} onClose={close} initialTab={tab} focusCommentId={params.get('comment')} />
}
