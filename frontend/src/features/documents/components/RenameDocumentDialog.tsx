import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useUpdateDocument } from '../hooks/useDocuments'
import type { KbDocument } from '../types'

/** "Đổi tên" trong menu ⋯ (như Lark): chỉ một ô tên, Enter để lưu. */
export default function RenameDocumentDialog({ doc, onClose }: { doc: KbDocument; onClose: () => void }) {
  const { t } = useTranslation('documents')
  const update = useUpdateDocument()
  const [title, setTitle] = useState(doc.title)
  const draft = useStateDraft(title, setTitle, { key: `document-rename:${doc.id}`, enabled: true })
  const next = title.trim()
  const save = () => {
    if (!next || next === doc.title) return
    update.mutate({ id: doc.id, input: { title: next } }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="sm"
      dismissible={!update.isPending}
      title={t('actions.rename')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={update.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button onClick={save} disabled={!next || next === doc.title || update.isPending}>
              {update.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('actions.confirm')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-3" />
      <Input autoFocus value={title} maxLength={255} invalid={!next} aria-label={t('fields.title')}
             onChange={e => setTitle(e.target.value)}
             onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); save() } }} />
    </Dialog>
  )
}
