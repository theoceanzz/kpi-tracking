import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GitBranch } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ApprovalSummary } from '@/types/approvalChain'

/**
 * Đối tượng đang chờ duyệt theo quy trình: thay cho nút duyệt / từ chối tay (bị chặn ở máy chủ).
 * Người giữ bước thấy liên kết sang "Chờ tôi duyệt"; người khác chỉ thấy đang chờ ai.
 */
export default function ProcessPendingBadge({ approval }: { approval: ApprovalSummary }) {
  const { t } = useTranslation('approvalProcess')
  const text = t('pending.inProcess', {
    number: approval.stepNumber, total: approval.totalSteps, names: approval.holderNames.join(', '),
  })
  const badge = (
    <Badge variant="warning" className="gap-1 whitespace-normal text-left">
      <GitBranch size={12} aria-hidden="true" className="shrink-0" /> {text}
    </Badge>
  )
  return approval.canAct
    ? <Link to="/processes?section=process-approvals" title={t('pending.openInbox')}>{badge}</Link>
    : badge
}
