import { Navigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import SettingsSectionLayout from '@/components/common/SettingsSectionLayout'
import { usePageTitle } from '@/features/organization/hooks/usePageTitle'
import { approvalInboxApi } from '../api/approvalInboxApi'
import ApprovalProcessListSection from '../components/ApprovalProcessListSection'
import MyProcessesPage from './MyProcessesPage'
import ProcessApprovalsPage, { DecisionDialog } from './ProcessApprovalsPage'

/**
 * "Quy trình" ngoài sidebar: Quy trình của tôi (mọi người) · Chờ tôi duyệt (mọi người — người giữ
 * bước có thể là bất kỳ ai được chỉ định) · Quản lý quy trình (WORKFLOW:MANAGE / COMPANY:UPDATE).
 * Vào trang là ra tab luôn (không qua lưới thẻ). `?flow=<id>` (link từ thông báo) mở thẳng đề xuất đó.
 */
export default function ProcessesPage() {
  const { t } = useTranslation('approvalProcess')
  const title = usePageTitle('processes', t('page.title'))
  const [params, setParams] = useSearchParams()
  const { data: inbox = [] } = useQuery({ queryKey: ['approvals', 'inbox'], queryFn: approvalInboxApi.inbox })
  const flowId = params.get('flow')

  if (!params.get('section')) {
    const next = new URLSearchParams(params)
    next.set('section', 'my-processes')
    return <Navigate to={{ search: `?${next}` }} replace />
  }

  const closeFlow = () => setParams((prev) => { const p = new URLSearchParams(prev); p.delete('flow'); return p }, { replace: true })

  return (
    <>
      <SettingsSectionLayout
        navId="processes"
        title={title}
        subtitle={t('page.subtitle')}
        sections={[
          { id: 'my-processes', render: () => <MyProcessesPage /> },
          { id: 'process-approvals', badge: inbox.length > 0 ? inbox.length : null, render: () => <ProcessApprovalsPage /> },
          { id: 'approval-processes', render: () => <ApprovalProcessListSection /> },
        ]}
      />
      {flowId && <FlowFromLink key={flowId} flowId={flowId} onClose={closeFlow} />}
    </>
  )
}

/** Không xem được (403/404) thì im lặng — trang vẫn đứng ở mục đang mở. */
function FlowFromLink({ flowId, onClose }: { flowId: string; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['approvals', 'flow', flowId], queryFn: () => approvalInboxApi.detail(flowId) })
  return data ? <DecisionDialog item={data.item} onClose={onClose} /> : null
}
