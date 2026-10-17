import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, LayoutTemplate, Plus, Search } from 'lucide-react'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { useFormat } from '@/i18n/useFormat'
import { tourAnchor } from '@/components/common/tours/anchors'
import { cn } from '@/lib/utils'
import { useFormLibrary } from '../../hooks/useApprovalForms'
import { pickName } from '../../model/formState'
import type { LibraryTemplate } from '../../types'
import FormIcon from '../FormIcon'
import FormPreview from '../FormPreview'

const ALL = '__all__'

/**
 * "Thư viện mẫu": danh mục bên trái, thẻ mẫu bên phải (Xem trước / Dùng), ô "Tạo đơn tuỳ chỉnh" đầu mục Đề xuất.
 * Xem trước mở ngay trong hộp (không chồng thêm hộp thoại).
 */
export default function TemplateLibraryDialog({ open, onClose, onUse, onCustom }: {
  open: boolean
  onClose: () => void
  onUse: (code: string) => void
  onCustom: () => void
}) {
  const { t } = useTranslation('approvalForms')
  const { lang } = useFormat()
  const { data, isLoading } = useFormLibrary(lang, open)
  const [category, setCategory] = useState(ALL)
  const [keyword, setKeyword] = useState('')
  const [previewing, setPreviewing] = useState<LibraryTemplate | null>(null)

  const k = keyword.trim().toLowerCase()
  const sections = useMemo(() => {
    const templates = data?.templates ?? []
    const name = (tpl: LibraryTemplate) => `${pickName(tpl.name, lang)} ${pickName(tpl.description, lang)}`.toLowerCase()
    if (k) return [{ key: 'search', title: t('library.results'), items: templates.filter((tpl) => name(tpl).includes(k)), custom: false }]
    const byCategory = (data?.categories ?? []).map((c) => ({
      key: c.code, title: pickName(c.name, lang), items: templates.filter((tpl) => tpl.category === c.code), custom: false,
    }))
    if (category !== ALL) return byCategory.filter((s) => s.key === category)
    return [{ key: 'recommended', title: t('library.recommended'), items: templates.filter((tpl) => tpl.recommended), custom: true }, ...byCategory]
  }, [data, k, category, lang, t])

  const close = () => {
    setPreviewing(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      size="full"
      flush
      title={previewing ? pickName(previewing.name, lang) : t('library.title')}
      description={previewing ? pickName(previewing.description, lang) : t('library.subtitle')}
      headerExtra={!previewing && (
        <div className="w-full sm:w-72">
          <Input type="search" size="sm" value={keyword} onChange={(e) => setKeyword(e.target.value)}
            placeholder={t('library.search')} aria-label={t('library.search')} prefix={<Search size={14} aria-hidden="true" />} />
        </div>
      )}
      {...tourAnchor('forms.library')}
    >
      {previewing ? (
        <div className="p-4 sm:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => setPreviewing(null)}>
              <ArrowLeft aria-hidden="true" /> {t('library.back')}
            </Button>
            <Button onClick={() => onUse(previewing.code)}>{t('library.use')}</Button>
          </div>
          <FormPreview icon={previewing.icon} color={previewing.color} name={pickName(previewing.name, lang)}
            description={pickName(previewing.description, lang)} schema={previewing.schema} process={previewing.process} />
        </div>
      ) : (
        <div className="flex min-h-[60vh] flex-col md:flex-row">
          <nav aria-label={t('library.categories')}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-border)] p-2 md:w-56 md:flex-col md:overflow-visible md:border-b-0 md:border-r">
            {[{ code: ALL, name: t('library.all') }, ...(data?.categories ?? []).map((c) => ({ code: c.code, name: pickName(c.name, lang) }))]
              .map((c) => (
                <button key={c.code} type="button" onClick={() => { setCategory(c.code); setKeyword('') }}
                  aria-current={category === c.code && !k ? 'true' : undefined}
                  className={cn('shrink-0 rounded-control px-3 py-2 text-left text-sm transition-colors',
                    category === c.code && !k ? 'bg-[var(--color-primary-soft)] font-medium text-[var(--color-primary)]' : 'hover:bg-[var(--color-muted)]')}>
                  {c.name}
                </button>
              ))}
          </nav>
          <div className="min-w-0 flex-1 space-y-6 bg-[var(--color-muted)]/40 p-4 sm:p-5">
            {isLoading ? <LoadingSkeleton type="card" rows={6} /> : sections.map((s) => (
              <section key={s.key}>
                <h3 className="mb-3 text-section-title">{s.title}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {s.custom && (
                    <button type="button" onClick={onCustom} {...tourAnchor('forms.customForm')}
                      className="flex min-h-[72px] items-center justify-center gap-2 rounded-card border border-dashed border-[var(--color-border-strong)] bg-[var(--color-card)] text-sm font-medium text-[var(--color-primary)] hover:border-[var(--color-primary)]">
                      <Plus size={16} aria-hidden="true" /> {t('library.custom')}
                    </button>
                  )}
                  {s.items.map((tpl) => (
                    <TemplateCard key={tpl.code} template={tpl} lang={lang}
                      onPreview={() => setPreviewing(tpl)} onUse={() => onUse(tpl.code)} />
                  ))}
                </div>
                {s.items.length === 0 && !s.custom && <p className="text-caption">{t('library.noTemplates')}</p>}
              </section>
            ))}
            {!isLoading && (
              <p className="flex items-center justify-center gap-1.5 text-center text-caption">
                <LayoutTemplate size={14} aria-hidden="true" /> {t('library.notFoundHint')}
                <button type="button" onClick={onCustom} className="text-[var(--color-primary)] hover:underline">{t('library.custom')}</button>
              </p>
            )}
          </div>
        </div>
      )}
    </Dialog>
  )
}

function TemplateCard({ template, lang, onPreview, onUse }: {
  template: LibraryTemplate; lang: string; onPreview: () => void; onUse: () => void
}) {
  const { t } = useTranslation('approvalForms')
  return (
    <div className="group relative flex min-h-[72px] items-center gap-3 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
      <FormIcon icon={template.icon} color={template.color} size="sm" />
      <div className="min-w-0 flex-1 transition-opacity group-hover:opacity-30 group-focus-within:opacity-30">
        <p className="truncate text-sm font-medium">{pickName(template.name, lang)}</p>
        <p className="truncate text-caption">{pickName(template.description, lang)}</p>
      </div>
      <div className="absolute inset-y-0 right-3 flex items-center gap-2 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-md:static max-md:opacity-100">
        <Button variant="outline" size="sm" onClick={onPreview}>{t('library.preview')}</Button>
        <Button size="sm" onClick={onUse}>{t('library.use')}</Button>
      </div>
    </div>
  )
}
