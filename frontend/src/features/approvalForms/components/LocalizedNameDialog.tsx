import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import FlagIcon from '@/components/common/FlagIcon'
import DraftNotice from '@/components/common/DraftNotice'
import { useStateDraft } from '@/hooks/useFormDraft'
import { blockedByTour } from '@/components/common/tours/guard'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/i18n/languages'
import type { LocalizedName } from '../types'
import { MAX_DESCRIPTION, MAX_NAME } from '../model/formIssues'

interface Value {
  name: LocalizedName
  description?: LocalizedName
}

/**
 * Tên (và mô tả) theo từng ngôn ngữ hệ thống hỗ trợ — nút quả địa cầu ở dòng nhóm / dòng đơn và cạnh ô Tên.
 * Người xem thấy bản đúng ngôn ngữ của mình; thiếu thì thấy bản còn lại.
 */
export default function LocalizedNameDialog({ open, title, value, withDescription, saving, draftKey, onClose, onSave }: {
  open: boolean
  title: string
  value: Value
  withDescription?: boolean
  saving?: boolean
  draftKey: string
  onClose: () => void
  onSave: (value: Value) => void
}) {
  if (!open) return null
  return (
    <Body title={title} value={value} withDescription={withDescription} saving={saving} draftKey={draftKey}
      onClose={onClose} onSave={onSave} />
  )
}

function Body({ title, value, withDescription, saving, draftKey, onClose, onSave }: {
  title: string; value: Value; withDescription?: boolean; saving?: boolean; draftKey: string
  onClose: () => void; onSave: (value: Value) => void
}) {
  const { t } = useTranslation('approvalForms')
  const [form, setForm] = useState<Value>(() => ({ name: { ...value.name }, description: { ...(value.description ?? {}) } }))
  const [showErrors, setShowErrors] = useState(false)
  const draft = useStateDraft(form, setForm, { key: draftKey, enabled: true })
  const empty = !SUPPORTED_LANGUAGES.some((l) => form.name[l]?.trim())

  const save = () => {
    if (blockedByTour()) return
    if (empty) {
      setShowErrors(true)
      return
    }
    draft.clear()
    onSave(form)
  }

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={title}
      description={t('names.hint')}
      footer={
        <DialogFooter
          note={showErrors && empty ? <span className="text-[var(--color-error)]">{t('names.needOne')}</span> : undefined}
          secondary={<Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>}
          primary={<Button onClick={save} disabled={saving}>{t('common.save')}</Button>}
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="space-y-4">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <fieldset key={lang} className="space-y-2">
            <legend className="mb-1.5 flex items-center gap-2 text-label">
              <FlagIcon language={lang} className="h-3.5 w-5 rounded-sm" />
              {LANGUAGE_NAMES[lang]}
            </legend>
            <Input
              value={form.name[lang] ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, name: { ...f.name, [lang]: e.target.value } }))}
              placeholder={t('names.namePlaceholder')}
              maxLength={MAX_NAME}
              invalid={showErrors && empty}
              aria-label={`${t('names.name')} (${LANGUAGE_NAMES[lang]})`}
            />
            {withDescription && (
              <Textarea
                rows={2}
                value={form.description?.[lang] ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: { ...f.description, [lang]: e.target.value } }))}
                placeholder={t('names.descriptionPlaceholder')}
                maxLength={MAX_DESCRIPTION}
                aria-label={`${t('names.description')} (${LANGUAGE_NAMES[lang]})`}
              />
            )}
          </fieldset>
        ))}
      </div>
    </Dialog>
  )
}
