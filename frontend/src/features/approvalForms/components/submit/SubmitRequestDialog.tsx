import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { GitBranch, Loader2, Send, UserRound } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import DraftNotice from '@/components/common/DraftNotice'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { blockedByTour } from '@/components/common/tours/guard'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useStateDraft } from '@/hooks/useFormDraft'
import { useDebounce } from '@/hooks/useDebounce'
import { useFormat } from '@/i18n/useFormat'
import { useAuthStore } from '@/store/authStore'
import { useRequestDraftStore } from '@/store/requestDraftStore'
import { approvalFormsApi } from '../../api/approvalFormsApi'
import { useSubmitRequest, useSubmitView } from '../../hooks/useApprovalForms'
import { initialValues, pickName, requiredErrors, submittableValues } from '../../model/formState'
import type { FormValues, SubmitView } from '../../types'
import FormIcon from '../FormIcon'
import FormRenderer from '../renderer/FormRenderer'

/** Hộp nộp đơn: form, đơn vị nộp (khi thuộc nhiều đơn vị), xem trước người duyệt theo giá trị đang điền. */
export default function SubmitRequestDialog({ formId, onClose, onSubmitted }: {
  formId: string | null
  onClose: () => void
  onSubmitted: () => void
}) {
  const { t } = useTranslation('approvalForms')
  const { data, isLoading } = useSubmitView(formId)
  if (!formId) return null
  return (
    <Dialog open onClose={onClose} size="lg" title={data ? <Title view={data} /> : t('submit.loading')}
      {...tourAnchor('requests.submitDialog')}
      footer={data ? undefined : <DialogFooter secondary={<Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>} />}>
      {isLoading || !data ? <LoadingSkeleton type="form" rows={5} /> : (
        <Body key={data.id} view={data} onClose={onClose} onSubmitted={onSubmitted} />
      )}
    </Dialog>
  )
}

function Title({ view }: { view: SubmitView }) {
  const { lang } = useFormat()
  return (
    <span className="flex items-center gap-2.5">
      <FormIcon icon={view.icon} color={view.color} size="sm" />
      <span className="truncate">{pickName(view.name, lang)}</span>
    </span>
  )
}

interface Draft {
  values: FormValues
  unitId: string | null
}

function Body({ view, onClose, onSubmitted }: { view: SubmitView; onClose: () => void; onSubmitted: () => void }) {
  const { t } = useTranslation('approvalForms')
  const { lang } = useFormat()
  const me = useAuthStore((s) => s.user)
  const submit = useSubmitRequest()
  // Bản nháp K.AI điền hộ cho đúng mẫu này (thẻ "Mở đơn để nộp" trong khung chat) — đè lên giá trị mặc định.
  const [aiDraft] = useState(() => useRequestDraftStore.getState().peek(view.id))
  useEffect(() => { if (aiDraft) useRequestDraftStore.getState().clear() }, [aiDraft])
  const [state, setState] = useState<Draft>(() => {
    const unit = view.units[0] ?? null
    return {
      unitId: unit?.id ?? null,
      values: {
        ...initialValues(view.schema, {
          me: me ? { id: me.id, name: me.fullName } : null,
          myUnit: unit,
          today: format(new Date(), 'yyyy-MM-dd'),
          now: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        }),
        ...(aiDraft?.values ?? {}),
      },
    }
  })
  const [showErrors, setShowErrors] = useState(false)
  // Có bản K.AI thì không khôi phục bản nháp cũ đè lên nó.
  const draft = useStateDraft(state, setState, { key: `approval-request:${view.id}`, enabled: !aiDraft })

  const errors = useMemo(() => (showErrors ? requiredErrors(view.schema, state.values, t('submit.required')) : {}),
    [showErrors, view.schema, state.values, t])

  // Người duyệt phụ thuộc giá trị (điều kiện theo số tiền, số ngày…) ⇒ hỏi lại backend khi người dùng ngừng gõ.
  const debounced = useDebounce(JSON.stringify(submittableValues(view.schema, state.values)), 500)
  const preview = useQuery({
    queryKey: ['approval-requests', 'preview-flow', view.id, state.unitId, debounced],
    queryFn: () => approvalFormsApi.previewFlow({ formId: view.id, orgUnitId: state.unitId!, values: JSON.parse(debounced) }),
    enabled: !!state.unitId,
    staleTime: 30_000,
  })

  useEffect(() => {
    if (!showErrors) return
    const first = Object.keys(errors)[0]
    if (first) document.querySelector(`[data-widget-id="${first.split('.')[0]}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [showErrors, errors])

  const send = () => {
    if (blockedByTour()) return
    setShowErrors(true)
    if (Object.keys(requiredErrors(view.schema, state.values, '')).length) return
    if (!state.unitId) return
    submit.mutate(
      { formId: view.id, orgUnitId: state.unitId, values: submittableValues(view.schema, state.values) },
      { onSuccess: () => { draft.clear(); onSubmitted() } },
    )
  }

  return (
    <>
      <DraftNotice draft={draft} className="mb-4" />
      {aiDraft && (
        <p className="mb-4 rounded-card border border-[var(--color-ai-line)] bg-[var(--color-ai-soft)] px-3 py-2 text-sm text-[var(--color-foreground)]">
          {t('aiDraft.prefilled')}
          {aiDraft.missing.length > 0 && <> {t('aiDraft.missing', { fields: aiDraft.missing.join(', ') })}</>}
        </p>
      )}
      {pickName(view.description, lang) && <p className="mb-4 text-sm text-[var(--color-muted-foreground)]">{pickName(view.description, lang)}</p>}
      {view.units.length > 1 && (
        <div className="mb-4">
          <span className="mb-1.5 block text-label">{t('submit.unit')}</span>
          <Select value={state.unitId ?? undefined} onValueChange={(unitId) => setState((s) => ({ ...s, unitId }))}>
            <SelectTrigger aria-label={t('submit.unit')}><SelectValue /></SelectTrigger>
            <SelectContent>{view.units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      {view.units.length === 0 && (
        <p className="mb-4 rounded-card bg-[var(--color-warning-bg)] px-3 py-2 text-sm text-[var(--color-warning)]">{t('submit.noUnit')}</p>
      )}

      <FormRenderer schema={view.schema} values={state.values} mode="edit" errors={errors}
        onChange={(values) => setState((s) => ({ ...s, values }))} />

      <section className="mt-6 border-t border-[var(--color-border)] pt-4" {...tourAnchor('requests.flowPreview')}>
        <h3 className="mb-2 flex items-center gap-2 text-section-title"><GitBranch size={16} aria-hidden="true" /> {t('submit.process')}</h3>
        {preview.isLoading ? <p className="text-caption">{t('submit.loadingFlow')}</p> : preview.data && (
          <ol className="space-y-2">
            {preview.data.steps.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-primary-soft)] px-1.5 text-xs font-semibold text-[var(--color-primary)]">
                  {s.code ?? i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block font-medium">{s.name}</span>
                  <span className="flex items-center gap-1 text-caption">
                    <UserRound size={12} aria-hidden="true" />
                    {s.skipped ? t('submit.stepSkipped') : s.approvers.join(', ')}
                  </span>
                </span>
              </li>
            ))}
            {preview.data.adminFallback && <li className="text-caption">{t('submit.adminFallback')}</li>}
          </ol>
        )}
      </section>

      <div className="sticky -bottom-5 -mx-5 mt-6 flex justify-end gap-2 border-t border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3">
        <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
        <Button onClick={send} disabled={submit.isPending || !state.unitId} {...tourAnchor('requests.submitButton')}>
          {submit.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {t('submit.send')}
        </Button>
      </div>
    </>
  )
}
