import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { stepCodes } from '../model/processGraphModel'
import type { ProcessGraph } from '../types'
import ProcessCanvas from './canvas/ProcessCanvas'

/**
 * Sơ đồ quy trình (chỉ đọc) trong chi tiết đối tượng: bản chụp lúc gửi duyệt, tô đường đã đi và
 * viền bước đang chờ. Chỉ có khi quy trình bật "Hiển thị quy trình trong đối tượng".
 */
export default function ProcessDiagramDialog({
  open, onClose, title, graph, pathNodeIds, currentNodeId,
}: {
  open: boolean
  onClose: () => void
  title: string
  graph: ProcessGraph
  pathNodeIds: string[]
  currentNodeId?: string | null
}) {
  const { t } = useTranslation('approvalProcess')
  const codes = useMemo(() => stepCodes(graph), [graph])
  const highlight = useMemo(() => ({ pathNodeIds, currentNodeId }), [pathNodeIds, currentNodeId])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="2xl"
      title={title}
      description={t('diagram.description')}
      flush
      footer={<DialogFooter secondary={<Button variant="outline" onClick={onClose}>{t('common.close')}</Button>} />}
    >
      <ProcessCanvas
        graph={graph}
        stepCodes={codes}
        highlight={highlight}
        allowFullscreen={false}
        className="h-[min(70vh,640px)] min-h-[420px]"
      />
    </Dialog>
  )
}
