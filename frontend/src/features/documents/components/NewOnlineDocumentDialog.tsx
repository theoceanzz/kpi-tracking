import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useCreateOnlineDocument } from '../hooks/useDocuments'
import type { DocumentCapabilities, DocumentFolder, DocumentScope } from '../types'
import { creatableScopes, editorPath } from '../utils'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'

interface FormState {
  title: string
  scope: DocumentScope
  unitId: string
}

interface Props {
  onClose: () => void
  caps: DocumentCapabilities
  /** Tạo trong thư mục này (phạm vi theo thư mục). */
  folder?: DocumentFolder | null
  /** Tạo ở gốc của Drive đang đứng; không truyền thì người dùng chọn phạm vi. */
  scope?: DocumentScope
  unitId?: string | null
  /** Tài liệu (mặc định) hay bảng tính. */
  kind?: 'doc' | 'sheet'
}

/**
 * Tạo tài liệu soạn trực tuyến (kiểu "Tài liệu mới" của Lark): đặt tên, chọn chỗ để, rồi mở thẳng trình soạn. Chỗ để
 * theo cùng luật với tạo thư mục — trong thư mục / Drive đang đứng thì theo đó, từ trang chủ thì người dùng chọn.
 */
export default function NewOnlineDocumentDialog({ onClose, caps, folder, scope, unitId, kind = 'doc' }: Props) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const create = useCreateOnlineDocument()
  const scopes = useMemo(() => creatableScopes(caps), [caps])
  const pickScope = !folder && !scope

  const [form, setForm] = useState<FormState>(() => ({
    title: '',
    scope: scope ?? scopes[0] ?? 'PERSONAL',
    unitId: unitId ?? caps.manageableUnits[0]?.id ?? '',
  }))
  const draft = useStateDraft(form, setForm, {
    key: `document-online:new:${kind}:${folder?.id ?? scope ?? 'home'}`,
    enabled: true,
  })
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(prev => ({ ...prev, [k]: v }))

  const needsUnit = pickScope && form.scope === 'UNIT' && !form.unitId
  const canSubmit = !needsUnit && !create.isPending

  const submit = () => {
    if (blockedByTour()) return
    const s = folder ? undefined : pickScope ? form.scope : scope
    const u = folder ? undefined : pickScope ? form.unitId : unitId
    create.mutate({
      folderId: folder?.id ?? null,
      scope: s,
      orgUnitId: s === 'UNIT' ? u : null,
      title: form.title.trim() || undefined,
      kind,
    }, {
      onSuccess: doc => {
        onClose()
        navigate(editorPath(doc.id))
      },
    })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size={pickScope ? 'md' : 'sm'}
      dismissible={!create.isPending}
      title={t(kind === 'sheet' ? 'online.createSheetTitle' : 'online.createTitle')}
      description={folder ? t('folder.inside', { name: folder.name }) : t(kind === 'sheet' ? 'online.createSheetDescription' : 'online.createDescription')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={create.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('online.form.submit')} onClick={submit} disabled={!canSubmit}>
              {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('online.create')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (canSubmit) submit() }}>
        <div {...tourAnchor('online.form.title')} className="space-y-1.5">
          <label className="text-label" htmlFor="online-doc-title">{t('fields.title')}</label>
          <Input id="online-doc-title" autoFocus value={form.title} maxLength={255} placeholder={t(kind === 'sheet' ? 'editor.sheetTitlePlaceholder' : 'editor.titlePlaceholder')}
                 onChange={e => set('title', e.target.value)} />
        </div>
        {pickScope && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div {...tourAnchor('online.form.scope')} className="space-y-1.5">
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
