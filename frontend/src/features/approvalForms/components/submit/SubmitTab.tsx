import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FileText, Search } from 'lucide-react'
import WorkspaceHeader from '@/components/common/WorkspaceHeader'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { Input } from '@/components/ui/input'
import { useTourModal } from '@/components/common/tours/actions'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useFormat } from '@/i18n/useFormat'
import { cn } from '@/lib/utils'
import { useFormCatalog } from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import type { LocalizedName } from '../../types'
import FormIcon from '../FormIcon'
import SubmitRequestDialog from './SubmitRequestDialog'
import AiShortcutButton from '@/features/ai/chat/components/AiShortcutButton'
import { aiShortcuts } from '@/features/ai/chat/aiShortcuts'

const matches = (name: LocalizedName, k: string) => Object.values(name).some((v) => v?.toLowerCase().includes(k))

/**
 * "Nộp đơn": ô tìm phía trên, danh sách nhóm bên trái (bấm để cuộn tới nhóm), thẻ đơn theo nhóm bên phải. Bấm thẻ mở
 * hộp nộp đơn.
 */
export default function SubmitTab({ onSubmitted }: { onSubmitted: () => void }) {
  const { t } = useTranslation('approvalForms')
  const { lang } = useFormat()
  const { data, isLoading } = useFormCatalog()
  const [keyword, setKeyword] = useState('')
  const [openFormId, setOpenFormId] = useState<string | null>(null)
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const sectionRefs = useRef(new Map<string, HTMLElement>())
  // ?form=<id>: mở thẳng hộp nộp đơn (thẻ "Mở đơn để nộp" của K.AI dẫn tới đây). Đóng hộp thì bỏ tham số khỏi URL.
  const [params, setParams] = useSearchParams()
  const shownFormId = openFormId ?? params.get('form')
  const closeForm = () => {
    setOpenFormId(null)
    if (params.has('form')) setParams(p => { p.delete('form'); return p }, { replace: true })
  }

  const firstFormId = data?.groups[0]?.forms[0]?.id ?? null
  useTourModal('submitRequest', () => setOpenFormId(firstFormId), () => setOpenFormId(null))

  const k = keyword.trim().toLowerCase()
  const groups = useMemo(() => (data?.groups ?? []).flatMap((g) => {
    if (!k || matches(g.name, k)) return [g]
    const forms = g.forms.filter((f) => matches(f.name, k) || matches(f.description, k))
    return forms.length ? [{ ...g, forms }] : []
  }), [data, k])

  const jump = (id: string) => {
    setActiveGroup(id)
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="space-y-4">
      <WorkspaceHeader title={t('submit.title')} description={t('submit.description')}
        actions={<AiShortcutButton {...tourAnchor('requests.ai')} label={t('aiDraft.shortcut')}
          title={t('aiDraft.shortcutHint')} prompt={aiShortcuts.createRequest()} />} />
      <div className="max-w-xl" {...tourAnchor('requests.search')}>
        <Input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder={t('submit.search')}
          aria-label={t('submit.search')} prefix={<Search size={16} aria-hidden="true" />} />
      </div>

      {isLoading ? (
        <LoadingSkeleton type="card" rows={6} />
      ) : groups.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState icon={FileText} title={k ? t('submit.noMatch') : t('submit.empty')} description={k ? undefined : t('submit.emptyHint')} />
        </div>
      ) : (
        <div className="grid gap-4 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] md:grid-cols-[220px_minmax(0,1fr)]">
          <nav aria-label={t('submit.groups')} {...tourAnchor('requests.groups')}
            className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)] p-3 md:sticky md:top-0 md:max-h-[calc(100vh-180px)] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r">
            {groups.map((g) => (
              <button key={g.id} type="button" onClick={() => jump(g.id)}
                className={cn('shrink-0 rounded-control px-3 py-2 text-left text-sm transition-colors',
                  activeGroup === g.id ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]')}>
                {pickName(g.name, lang)}
              </button>
            ))}
          </nav>
          <div className="space-y-6 p-3 sm:p-4" {...tourAnchor('requests.forms')}>
            {groups.map((g) => (
              <section key={g.id} ref={(el) => { if (el) sectionRefs.current.set(g.id, el); else sectionRefs.current.delete(g.id) }}
                className="scroll-mt-4">
                <h2 className="mb-3 text-section-title">{pickName(g.name, lang)}</h2>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.forms.map((f) => (
                    <button key={f.id} type="button" onClick={() => setOpenFormId(f.id)}
                      className="flex items-center gap-3 rounded-card border border-[var(--color-border)] px-4 py-3 text-left transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-muted)]">
                      <FormIcon icon={f.icon} color={f.color} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{pickName(f.name, lang)}</span>
                        {pickName(f.description, lang) && <span className="block truncate text-caption">{pickName(f.description, lang)}</span>}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}

      <SubmitRequestDialog formId={shownFormId} onClose={closeForm}
        onSubmitted={() => { closeForm(); onSubmitted() }} />
    </div>
  )
}
