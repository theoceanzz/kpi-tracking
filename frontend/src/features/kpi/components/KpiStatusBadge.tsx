import StatusBadge from '@/components/common/StatusBadge'

export default function KpiStatusBadge({ status, className }: { status: string; className?: string }) {
  return <StatusBadge status={status} className={className} />
}
