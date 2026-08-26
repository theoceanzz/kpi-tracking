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

/** Dữ liệu giả cho ảnh thu nhỏ trong danh sách. */
const THUMB_DATA: Omit<CertificateData, 'organizationName' | 'organizationLogoUrl'> = {
  recipientName: 'Nguyễn Minh Anh',
  points: 500,
  reason: 'Hoàn thành xuất sắc nhiệm vụ được giao trong tháng.',
  dateLabel: new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  grantorName: 'Trần Quốc Hưng',
  orgUnitName: 'Phòng Kinh doanh',
}

/**
 * Quản lý mẫu chứng nhận của tổ chức.
 *
 * <p>Danh sách rỗng KHÔNG phải lỗi: sáu thiết kế dựng sẵn luôn dùng được ngay ở màn hình
 * in. Mẫu ở đây chỉ để công ty ghim lời văn, chữ ký và màu thương hiệu của mình.
 */
export default function CertificatesTab() {
  const [editing, setEditing] = useState<CertificateTemplate | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<CertificateTemplate | null>(null)

  const { data, isLoading, deleteTemplate, isDeleting } = useCertificateTemplates()
  const templates = data?.templates ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="max-w-2xl text-sm text-[var(--color-muted-foreground)]">
          Mẫu giấy khen dùng khi in chứng nhận cho nhân viên được thưởng. Chưa tạo mẫu nào thì
          màn hình in vẫn có sẵn sáu thiết kế đẹp để chọn — mẫu ở đây là bản riêng của công ty
          bạn, có logo, chữ ký và lời văn cố định.
        </p>
        <WorkspaceHeaderActions>
          <button
            onClick={openCreate}
            className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 h-10 text-sm font-bold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <Plus size={16} />
            Tạo mẫu
          </button>
        </WorkspaceHeaderActions>
      </div>

      {isLoading ? (
        <LoadingSkeleton type="card" rows={3} />
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)]">
          <EmptyState
            title="Chưa có mẫu riêng nào"
            description="Tạo một mẫu để cố định logo, chữ ký của giám đốc và lời chứng nhận — lần sau ai in cũng ra đúng một kiểu."
            action={
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white"
              >
                <Award size={16} />
                Tạo mẫu đầu tiên
              </button>
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
        title="Xoá mẫu chứng nhận?"
        description={
          deleting
            ? `Mẫu "${deleting.name}" sẽ không còn hiện ra khi in. Chứng nhận đã in trước đó không bị ảnh hưởng.`
            : ''
        }
        confirmLabel="Xoá mẫu"
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
  const design = resolveDesign(template)
  const inactive = template.status !== CertificateTemplateStatus.ACTIVE

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Ảnh thu nhỏ vẽ bằng chính component in thật, không phải ảnh chụp sẵn — sửa mẫu
          là thấy ngay, không có bước đồng bộ nào ở giữa để mà lệch. */}
      <div className="flex justify-center overflow-hidden bg-[var(--color-muted)] p-3">
        <div className={`overflow-hidden rounded shadow ring-1 ring-black/10 ${inactive ? 'opacity-50' : ''}`}>
          <CertificateCanvas
            design={design}
            data={{ ...THUMB_DATA, organizationName, organizationLogoUrl }}
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
                title="Mẫu mặc định khi in"
                className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700"
              >
                <Star size={10} />
                Mặc định
              </span>
            )}
            {inactive && (
              <span className="flex-shrink-0 rounded-full bg-[var(--color-muted)] px-2 py-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                Đang tắt
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
            {design.preset.name} · {template.title}
          </div>
        </div>

        <div className="flex flex-shrink-0 gap-1">
          <button
            onClick={onEdit}
            title="Sửa mẫu"
            className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={onDelete}
            title="Xoá mẫu"
            className="rounded-lg p-1.5 text-[var(--color-muted-foreground)] hover:bg-rose-500/10 hover:text-rose-600"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
