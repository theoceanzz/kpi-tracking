import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useCreateFolder, useRenameFolder } from '../hooks/useDocuments'
import type { DocumentCapabilities, DocumentFolder, DocumentScope } from '../types'
import { creatableScopes } from '../utils'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface FormState {
  name: string
  scope: DocumentScope
  unitId: string
}

interface Props {
  onClose: () => void
  caps: DocumentCapabilities
  /** Đổi tên thư mục này. */
  editing?: DocumentFolder | null
  /** Tạo bên trong thư mục này (kế thừa phạm vi). */
  parent?: DocumentFolder | null
  /** Tạo ở gốc của phạm vi đang đứng; không truyền thì người dùng chọn phạm vi. */
  scope?: DocumentScope
  unitId?: string | null
}

/**
 * Tạo hoặc đổi tên thư mục. Thư mục thuộc đúng một phạm vi: tạo trong một thư mục thì theo phạm vi thư mục đó;
 * tạo ở gốc Drive thì theo Drive đang đứng; tạo từ trang chủ thì người dùng chọn phạm vi mình được tạo.
 */
export default function FolderDialog({ onClose, caps, editing, parent, scope, unitId }: Props) {
  const { t } = useTranslation('documents')
  const create = useCreateFolder()
  const rename = useRenameFolder()
  const scopes = useMemo(() => creatableScopes(caps), [caps])
  const pickScope = !editing && !parent && !scope

  const [form, setForm] = useState<FormState>(() => ({
    name: editing?.name ?? '',
    scope: scope ?? scopes[0] ?? 'PERSONAL',
    unitId: unitId ?? caps.manageableUnits[0]?.id ?? '',
  }))
  const draft = useStateDraft(form, setForm, {
    key: editing ? `document-folder:${editing.id}` : `document-folder:new:${parent?.id ?? scope ?? 'home'}`,
    enabled: true,
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  const pending = create.isPending || rename.isPending
  const needsUnit = pickScope && form.scope === 'UNIT' && !form.unitId
  const canSubmit = !!form.name.trim() && !needsUnit && !pending && (!editing || form.name.trim() !== editing.name)

  const submit = () => {
    if (blockedByTour()) return
    const name = form.name.trim()
    if (editing) {
      rename.mutate({ id: editing.id, name }, { onSuccess: onClose })
    } else if (parent) {
      create.mutate({ parentId: parent.id, name }, { onSuccess: onClose })
    } else {
      const s = pickScope ? form.scope : scope!
      const u = pickScope ? form.unitId : unitId
      create.mutate({ scope: s, orgUnitId: s === 'UNIT' ? u : null, name }, { onSuccess: onClose })
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size={pickScope ? 'md' : 'sm'}
      dismissible={!pending}
      title={editing ? t('folder.renameTitle') : t('folder.createTitle')}
      description={parent ? t('folder.inside', { name: parent.name }) : undefined}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={pending}>{t('common.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('folder.form.submit')} onClick={submit} disabled={!canSubmit}>
              {pending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {editing ? t('actions.save') : t('folder.create')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (canSubmit) submit() }}>
        <div {...tourAnchor('folder.form.name')} className="space-y-1.5">
          <label className="text-label" htmlFor="folder-name">{t('folder.name')}</label>
          <Input id="folder-name" autoFocus value={form.name} maxLength={255} placeholder={t('folder.namePlaceholder')}
                 onChange={e => set('name', e.target.value)} />
        </div>
        {pickScope && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div {...tourAnchor('folder.form.scope')} className="space-y-1.5">
              <label className="text-label">{t('fields.scope')}</label>
              <Select value={form.scope} onValueChange={v => set('scope', v as DocumentScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {scopes.map(s => <SelectItem key={s} value={s}>{t(`scope.${s}`)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {form.scope === 'UNIT' && (
              <div className="space-y-1.5">
                <label className="text-label">{t('fields.unit')}</label>
                <Select value={form.unitId || undefined} onValueChange={v => set('unitId', v)}>
                  <SelectTrigger aria-invalid={needsUnit}><SelectValue placeholder={t('fields.unitPlaceholder')} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {caps.manageableUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}
      </form>
    </Dialog>
  )
}
