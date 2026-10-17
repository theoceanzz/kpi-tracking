import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { blockedByTour } from '@/components/common/tours/guard'
import { cn } from '@/lib/utils'
import { useReorderGroups } from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import type { FormGroup } from '../../types'

/** Kéo để xếp thứ tự nhóm — nhóm đứng đầu hiện đầu tiên ở trang Nộp đơn. */
export default function SortGroupsDialog({ groups, lang, onClose }: { groups: FormGroup[]; lang: string; onClose: () => void }) {
  const { t } = useTranslation('approvalForms')
  const [ids, setIds] = useState(() => groups.map((g) => g.id))
  const reorder = useReorderGroups()
  const byId = new Map(groups.map((g) => [g.id, g]))
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return
    setIds((list) => arrayMove(list, list.indexOf(String(e.active.id)), list.indexOf(String(e.over!.id))))
  }
  const save = () => {
    if (blockedByTour()) return
    reorder.mutate(ids, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      title={t('admin.sortTitle')}
      description={t('admin.sortHint')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>}
          primary={<Button onClick={save} disabled={reorder.isPending}>{t('common.save')}</Button>}
        />
      }
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {ids.map((id) => <Row key={id} id={id} label={pickName(byId.get(id)?.name, lang)} />)}
          </ul>
        </SortableContext>
      </DndContext>
    </Dialog>
  )
}

function Row({ id, label }: { id: string; label: string }) {
  const { t } = useTranslation('approvalForms')
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn('flex items-center gap-2 rounded-control border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-2 text-sm',
        isDragging && 'relative z-10 shadow-md')}
    >
      <button type="button" {...attributes} {...listeners} aria-label={t('admin.dragToSort')}
        className="cursor-grab touch-none text-[var(--color-muted-foreground)] active:cursor-grabbing">
        <GripVertical size={16} aria-hidden="true" />
      </button>
      <span className="truncate">{label}</span>
    </li>
  )
}
