import StatusBadge from '@/components/common/StatusBadge'

export default function KpiStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />
}
