import { intlDateLocale } from '@/i18n/format'
import { useState } from 'react'
import { Award, Pencil, Plus, Star, Trash2 } from 'lucide-react'
import EmptyState from '@/components/common/EmptyState'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { WorkspaceHeaderActions } from '@/components/common/WorkspaceTabs'
import CertificateCanvas from './certificate/CertificateCanvas'
import CertificateTemplateModal from './certificate/CertificateTemplateModal'
import { resolveDesign, type CertificateData } from './certificate/presets'
import { useCertificateTemplates } from '../hooks/useCertificates'
import { CertificateTemplateStatus, type CertificateTemplate } from '../types'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { tourAnchor } from '@/components/common/tours/anchors'
import { useTourModal } from '@/components/common/tours/actions'

/** Dữ liệu giả cho ảnh thu nhỏ trong danh sách. */
const THUMB_DATA = perLanguage((): Omit<CertificateData, 'organizationName' | 'organizationLogoUrl'> => ({
  recipientName: i18n.t('rewards:CertificatesTab.nguyenMinhAnh'),
  points: 500,
  reason: i18n.t('rewards:CertificatesTab.outstandingCompletionOfAssignedTasksThis'),
  dateLabel: new Date().toLocaleDateString(intlDateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  grantorName: i18n.t('rewards:CertificatesTab.tranQuocHung'),
  orgUnitName: i18n.t('rewards:CertificatesTab.salesDepartment'),
}))

/**
 * Quản lý mẫu chứng nhận của tổ chức.
 *
 * <p>Danh sách rỗng KHÔNG phải lỗi: sáu thiết kế dựng sẵn luôn dùng được ngay ở màn hình
 * in. Mẫu ở đây chỉ để công ty ghim lời văn, chữ ký và màu thương hiệu của mình.
 */
export default function CertificatesTab() {
  const { t: tr } = useTranslation('rewards')
  const [editing, setEditing] = useState<CertificateTemplate | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  useTourModal('rewards.certificate', () => { setEditing(null); setFormOpen(true) }, () => setFormOpen(false))
  const [deleting, setDeleting] = useState<CertificateTemplate | null>(null)

  const { data, isLoading, deleteTemplate, isDeleting } = useCertificateTemplates()
  const templates = data?.templates ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div id="tour-certificates-root">
      <div {...tourAnchor('cert.intro')} id="tour-certificates-intro" className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          {tr('CertificatesTab.certificateTemplatesUsedWhenPrintingCertificates')}
        </p>
        <WorkspaceHeaderActions>
          <Button {...tourAnchor('cert.add')} onClick={openCreate}>
            <Plus aria-hidden="true" />
            {tr('CertificatesTab.createTemplate')}
          </Button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="card" rows={3} />
      ) : templates.length === 0 ? (
        <div className="rounded-card border border-dashed border-[var(--color-border)]">
          <EmptyState
            title={tr('CertificatesTab.noCustomTemplatesYet')}
            description={tr('CertificatesTab.createATemplateToFixThe')}
            action={
              <Button onClick={openCreate}>
                <Award aria-hidden="true" />
                {tr('CertificatesTab.createTheFirstTemplate')}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              organizationName={data?.organizationName ?? ''}
              organizationLogoUrl={data?.organizationLogoUrl}
              onEdit={() => {
                setEditing(t)
                setFormOpen(true)
              }}
              onDelete={() => setDeleting(t)}
            />
          ))}
        </div>
      )}

      <CertificateTemplateModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editTemplate={editing}
        organizationName={data?.organizationName ?? ''}
        organizationLogoUrl={data?.organizationLogoUrl}
      />

      <ConfirmDialog
        open={!!deleting}
        title={tr('CertificatesTab.deleteCertificateTemplate')}
        description={
          deleting
            ? tr('CertificatesTab.templateWillNoLongerAppearWhen', { name: deleting.name })
            : ''
        }
        confirmLabel={tr('CertificatesTab.deleteTemplate')}
        loading={isDeleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteTemplate(deleting.id)
          setDeleting(null)
        }}
      />
    </div>
  )
}

function TemplateCard({
  template,
  organizationName,
  organizationLogoUrl,
  onEdit,
  onDelete,
}: {
  template: CertificateTemplate
  organizationName: string
  organizationLogoUrl?: string | null
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation('rewards')
  const design = resolveDesign(template)
  const inactive = template.status !== CertificateTemplateStatus.ACTIVE

  return (
    <div className="overflow-hidden rounded-card border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Ảnh thu nhỏ vẽ bằng chính component in thật, không phải ảnh chụp sẵn — sửa mẫu
          là thấy ngay, không có bước đồng bộ nào ở giữa để mà lệch. */}
      <div className="flex justify-center overflow-hidden bg-[var(--color-muted)] p-3">
        <div className={`overflow-hidden rounded shadow ring-1 ring-black/10 ${inactive ? 'opacity-50' : ''}`}>
          <CertificateCanvas
            design={design}
            data={{ ...THUMB_DATA(), organizationName, organizationLogoUrl }}
            scale={0.26}
          />
        </div>
      </div>

      <div className="flex items-start justify-between gap-2 p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-medium">{template.name}</span>
            {template.isDefault && (
              <span
                title={t('CertificatesTab.defaultTemplateWhenPrinting')}
                className="flex flex-shrink-0 items-center gap-1 rounded-full bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)]"
              >
                <Star size={10} />
                {t('CertificatesTab.default')}
              </span>
            )}
            {inactive && (
              <span className="flex-shrink-0 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-caption">
                {t('CertificatesTab.off')}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
            {design.preset.name} · {template.title}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1">
          <Button {...tourAnchor('cert.edit')} variant="ghost" size="icon-sm" aria-label={t('CertificatesTab.editTemplate')} onClick={onEdit} title={t('CertificatesTab.editTemplate')}>
            <Pencil aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]" aria-label={t('CertificatesTab.deleteTemplate')} onClick={onDelete} title={t('CertificatesTab.deleteTemplate')}>
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
