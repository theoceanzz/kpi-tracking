import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { usePropose } from '../hooks/useDocuments'
import type { KbDocument } from '../types'
import type { PromotionTarget } from '../utils'

/** Radix Select không nhận value="" — công ty dùng hằng riêng. */
const COMPANY = '__company__'

interface FormState { target: string; note: string }

/**
 * Đề xuất đưa tài liệu lên đơn vị / công ty (docs/DOCUMENTS_DESIGN.md §16.2). Người quản lý tài liệu ở nơi đích
 * duyệt; duyệt xong tài liệu được SAO CHÉP lên đó, bản của mình giữ nguyên.
 */
export default function PromoteDialog({ doc, targets, onClose }: { doc: KbDocument; targets: PromotionTarget[]; onClose: () => void }) {
  const { t } = useTranslation('documents')
  const propose = usePropose()
  const [form, setForm] = useState<FormState>(() => ({
    target: targets[0] ? (targets[0].scope === 'COMPANY' ? COMPANY : targets[0].unitId!) : '',
    note: '',
  }))
  const draft = useStateDraft(form, setForm, { key: `document-promote:${doc.id}`, enabled: true })
  const units = targets.filter(x => x.scope === 'UNIT')
  const hasCompany = targets.some(x => x.scope === 'COMPANY')

  const submit = () => {
    const company = form.target === COMPANY
    propose.mutate({
      id: doc.id,
      input: { targetScope: company ? 'COMPANY' : 'UNIT', targetUnitId: company ? null : form.target, note: form.note.trim() || undefined },
    }, { onSuccess: onClose })
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      dismissible={!propose.isPending}
      title={t('promotion.dialogTitle', { title: doc.title })}
      description={t('promotion.dialogDescription')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={propose.isPending}>{t('common.cancel')}</Button>}
          primary={
            <Button onClick={submit} disabled={!form.target || propose.isPending}>
              {propose.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {t('promotion.send')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-label">{t('promotion.target')}</label>
          <Select value={form.target || undefined} onValueChange={v => setForm(p => ({ ...p, target: v }))}>
            <SelectTrigger><SelectValue placeholder={t('promotion.targetPlaceholder')} /></SelectTrigger>
            <SelectContent className="max-h-72">
              {hasCompany && <SelectItem value={COMPANY}>{t('scope.COMPANY')}</SelectItem>}
              {units.length > 0 && (
                <SelectGroup>
                  <SelectLabel>{t('scope.UNIT')}</SelectLabel>
                  {units.map(u => <SelectItem key={u.unitId} value={u.unitId!}>{u.name}</SelectItem>)}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <label className="text-label" htmlFor="promote-note">{t('promotion.note')}</label>
          <Textarea id="promote-note" rows={3} maxLength={2000} value={form.note}
                    onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder={t('promotion.notePlaceholder')} />
        </div>
        <p className="text-caption">{t('promotion.copyHint')}</p>
      </div>
    </Dialog>
  )
}
