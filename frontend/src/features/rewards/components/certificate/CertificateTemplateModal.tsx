import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, X, Trash2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { certificateTemplateSchema, type CertificateTemplateFormData } from '../../schemas/certificateTemplateSchema'
import { certificateApi } from '../../api/certificateApi'
import { useCertificateTemplates } from '../../hooks/useCertificates'
import {
  CertificateOrientation,
  CertificateTemplateStatus,
  type CertificateTemplate,
} from '../../types'
import CertificateCanvas from './CertificateCanvas'
import {
  CERTIFICATE_PAGE,
  CERTIFICATE_PLACEHOLDERS,
  CERTIFICATE_PRESETS,
  DEFAULT_PRESET,
  getPreset,
  resolveDesign,
  type CertificateData,
} from './presets'

interface CertificateTemplateModalProps {
  open: boolean
  onClose: () => void
  /** Có = sửa, không có = tạo mới. */
  editTemplate?: CertificateTemplate | null
  /** Tên và logo công ty, để bản xem trước giống hệt lúc in thật. */
  organizationName: string
  organizationLogoUrl?: string | null
}

/**
 * Dữ liệu giả cho bản xem trước.
 *
 * <p>Phải là dữ liệu ĐẦY ĐỦ và dài gần bằng thực tế: soạn mẫu với tên ba chữ rồi mang in
 * cho người tên bảy chữ là cách chắc chắn nhất để phát hiện lỗi tràn chữ sau khi đã in.
 */
const SAMPLE: Omit<CertificateData, 'organizationName' | 'organizationLogoUrl'> = {
  recipientName: 'Nguyễn Thị Minh Anh',
  points: 500,
  reason: 'Dẫn dắt nhóm hoàn thành dự án trước hạn hai tuần và chủ động kèm cặp thành viên mới.',
  dateLabel: new Date().toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  grantorName: 'Trần Quốc Hưng',
  orgUnitName: 'Phòng Kinh doanh',
}

type ImageSlot = 'signature' | 'logo' | 'background'

export default function CertificateTemplateModal({
  open,
  onClose,
  editTemplate,
  organizationName,
  organizationLogoUrl,
}: CertificateTemplateModalProps) {
  const isEdit = !!editTemplate
  const { createTemplate, updateTemplate, isCreating, isUpdating } = useCertificateTemplates()

  const { handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<CertificateTemplateFormData>({
    resolver: zodResolver(certificateTemplateSchema),
    defaultValues: {
      name: '', preset: DEFAULT_PRESET.key, orientation: CertificateOrientation.LANDSCAPE,
      eyebrow: '', title: '', subtitle: '', body: '', footnote: '',
      signerName: '', signerTitle: '', signatureUrl: '', logoUrl: '', backgroundUrl: '',
      accentColor: '', inkColor: '', surfaceColor: '',
      showLogo: true, showPoints: true, showReason: true, isDefault: false, active: true,
    },
  })

  // Bản xem trước bên phải vẽ lại theo TỪNG ký tự vừa gõ, và mọi ô ở đây là thành phần
  // tự vẽ (Toggle / ColorField / ImageField) chứ không phải input thuần, nên theo dõi cả
  // form rồi rải giá trị xuống thay vì đăng ký từng ô.
  const {
    name, preset, orientation, eyebrow, title, subtitle, body, footnote,
    signerName, signerTitle, signatureUrl, logoUrl, backgroundUrl,
    accentColor, inkColor, surfaceColor,
    showLogo, showPoints, showReason, isDefault, active,
  } = watch()

  const [uploading, setUploading] = useState<ImageSlot | null>(null)

  useEffect(() => {
    if (!open) return

    if (editTemplate) {
      reset({
        name: editTemplate.name,
        preset: editTemplate.preset,
        orientation: editTemplate.orientation,
        eyebrow: editTemplate.eyebrow ?? '',
        title: editTemplate.title,
        subtitle: editTemplate.subtitle ?? '',
        body: editTemplate.body ?? '',
        footnote: editTemplate.footnote ?? '',
        signerName: editTemplate.signerName ?? '',
        signerTitle: editTemplate.signerTitle ?? '',
        signatureUrl: editTemplate.signatureUrl ?? '',
        logoUrl: editTemplate.logoUrl ?? '',
        backgroundUrl: editTemplate.backgroundUrl ?? '',
        accentColor: editTemplate.accentColor ?? '',
        inkColor: editTemplate.inkColor ?? '',
        surfaceColor: editTemplate.surfaceColor ?? '',
        showLogo: editTemplate.showLogo,
        showPoints: editTemplate.showPoints,
        showReason: editTemplate.showReason,
        isDefault: editTemplate.isDefault,
        active: editTemplate.status === CertificateTemplateStatus.ACTIVE,
      })
      return
    }

    // Mẫu mới bắt đầu từ nguyên văn của thiết kế dựng sẵn, không phải từ ô trống: người
    // soạn sửa vài chữ là xong, thay vì phải tự nghĩ ra toàn bộ lời chứng nhận.
    const base = DEFAULT_PRESET
    reset({
      name: '',
      preset: base.key,
      orientation: CertificateOrientation.LANDSCAPE,
      eyebrow: base.content.eyebrow,
      title: base.content.title,
      subtitle: base.content.subtitle,
      body: base.content.body,
      footnote: base.content.footnote,
      signerName: '', signerTitle: '', signatureUrl: '', logoUrl: '', backgroundUrl: '',
      accentColor: '', inkColor: '', surfaceColor: '',
      showLogo: true, showPoints: true, showReason: true, isDefault: false, active: true,
    })
  }, [open, editTemplate, reset])

  const design = useMemo(
    () =>
      resolveDesign({
        id: editTemplate?.id ?? 'preview',
        name,
        preset,
        orientation,
        eyebrow,
        title,
        subtitle,
        body,
        footnote,
        // Ô trống phải đi xuống thành `null` ĐÚNG như lúc lưu, không phải chuỗi rỗng:
        // `resolveDesign` chỉ điền giá trị mặc định ("Người trao thưởng") khi gặp null,
        // nên chuỗi rỗng sẽ cho ra bản xem trước khác với tờ giấy in ra thật.
        signerName: signerName || null,
        signerTitle: signerTitle || null,
        signatureUrl: signatureUrl || null,
        logoUrl: logoUrl || null,
        backgroundUrl: backgroundUrl || null,
        accentColor: accentColor || null,
        inkColor: inkColor || null,
        surfaceColor: surfaceColor || null,
        showLogo,
        showPoints,
        showReason,
        isDefault,
        status: active ? CertificateTemplateStatus.ACTIVE : CertificateTemplateStatus.INACTIVE,
        displayOrder: editTemplate?.displayOrder ?? 0,
      } as CertificateTemplate),
    [
      editTemplate,
      name,
      preset,
      orientation,
      eyebrow,
      title,
      subtitle,
      body,
      footnote,
      signerName,
      signerTitle,
      signatureUrl,
      logoUrl,
      backgroundUrl,
      accentColor,
      inkColor,
      surfaceColor,
      showLogo,
      showPoints,
      showReason,
      isDefault,
      active,
    ]
  )

  if (!open) return null

  const handleUpload = async (slot: ImageSlot, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Chỉ chấp nhận tệp ảnh')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Ảnh không được vượt quá 5MB')
      return
    }
    setUploading(slot)
    try {
      const url = await certificateApi.uploadImage(file)
      if (slot === 'signature') setValue('signatureUrl', url)
      if (slot === 'logo') setValue('logoUrl', url)
      if (slot === 'background') setValue('backgroundUrl', url)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Tải ảnh thất bại')
    } finally {
      setUploading(null)
    }
  }

  /**
   * Đổi kiểu thiết kế.
   *
   * <p>Chỉ chép lời của thiết kế mới xuống khi người soạn CHƯA sửa gì so với thiết kế cũ.
   * Ghi đè vô điều kiện sẽ xoá sạch đoạn văn họ vừa ngồi viết chỉ vì bấm thử một mẫu khác.
   */
  const handlePresetChange = (nextKey: string) => {
    const current = getPreset(preset)
    const next = getPreset(nextKey)
    const untouched =
      eyebrow === current.content.eyebrow &&
      title === current.content.title &&
      subtitle === current.content.subtitle &&
      body === current.content.body

    setValue('preset', nextKey)
    if (untouched) {
      setValue('eyebrow', next.content.eyebrow)
      setValue('title', next.content.title, { shouldValidate: true })
      setValue('subtitle', next.content.subtitle)
      setValue('body', next.content.body)
    }
    // Màu tuỳ biến vốn được chọn cho bảng màu cũ; giữ lại thường ra một mẫu chỏi màu.
    setValue('accentColor', '')
    setValue('inkColor', '')
    setValue('surfaceColor', '')
  }

  const saving = isCreating || isUpdating

  const onSubmit = async (data: CertificateTemplateFormData) => {
    const payload = {
      name: data.name.trim(),
      preset: data.preset,
      orientation: data.orientation,
      eyebrow: data.eyebrow.trim() || null,
      title: data.title.trim(),
      subtitle: data.subtitle.trim() || null,
      body: data.body.trim() || null,
      footnote: data.footnote.trim() || null,
      signerName: data.signerName.trim() || null,
      signerTitle: data.signerTitle.trim() || null,
      signatureUrl: data.signatureUrl || null,
      logoUrl: data.logoUrl || null,
      backgroundUrl: data.backgroundUrl || null,
      accentColor: data.accentColor || null,
      inkColor: data.inkColor || null,
      surfaceColor: data.surfaceColor || null,
      showLogo: data.showLogo,
      showPoints: data.showPoints,
      showReason: data.showReason,
      isDefault: data.isDefault,
      status: data.active ? CertificateTemplateStatus.ACTIVE : CertificateTemplateStatus.INACTIVE,
    }

    try {
      if (isEdit && editTemplate) {
        await updateTemplate({ id: editTemplate.id, data: payload })
      } else {
        await createTemplate(payload)
      }
      onClose()
    } catch {
      // Hook đã hiện toast lỗi; giữ modal mở để người dùng sửa lại chứ không mất dữ liệu.
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <h2 className="text-lg font-semibold">
            {isEdit ? 'Sửa mẫu chứng nhận' : 'Tạo mẫu chứng nhận'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* ── Cột trái: biểu mẫu ── */}
          <div className="space-y-6 overflow-y-auto border-b border-[var(--color-border)] p-5 lg:border-b-0 lg:border-r">
            <Field label="Tên mẫu" hint="Chỉ hiện trong danh sách chọn, không in lên giấy">
              <input
                value={name}
                onChange={(e) => setValue('name', e.target.value, { shouldValidate: true })}
                placeholder="VD: Nhân viên của tuần"
                className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
              {errors.name && <p className="mt-1 text-xs text-rose-600">{errors.name.message}</p>}
            </Field>

            <div>
              <div className="mb-2 text-sm font-medium">Kiểu thiết kế</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {CERTIFICATE_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    onClick={() => handlePresetChange(p.key)}
                    title={p.tagline}
                    className={`rounded-xl border p-2 text-left transition-colors ${preset === p.key
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/25'
                        : 'border-[var(--color-border)] hover:bg-[var(--color-accent)]'
                      }`}
                  >
                    <PresetSwatch presetKey={p.key} />
                    <div className="mt-1.5 truncate text-xs font-medium">{p.name}</div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                {getPreset(preset).tagline}
              </p>
            </div>

            <Field label="Khổ giấy">
              <div className="flex gap-1.5">
                {[
                  { key: CertificateOrientation.LANDSCAPE, label: 'Ngang (A4)' },
                  { key: CertificateOrientation.PORTRAIT, label: 'Dọc (A4)' },
                ].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setValue('orientation', o.key)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${orientation === o.key
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'
                      }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="space-y-4 border-t border-[var(--color-border)] pt-5">
              <div className="text-sm font-semibold">Nội dung in trên giấy</div>

              <PlaceholderHelp />

              <Field label="Dòng dẫn" hint="Chữ nhỏ phía trên tiêu đề">
                <input
                  value={eyebrow}
                  onChange={(e) => setValue('eyebrow', e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Tiêu đề">
                <input
                  value={title}
                  onChange={(e) => setValue('title', e.target.value, { shouldValidate: true })}
                  className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm font-medium"
                />
                {errors.title && <p className="mt-1 text-xs text-rose-600">{errors.title.message}</p>}
              </Field>

              <Field label="Phụ đề" hint="Dòng ngay trên tên người nhận">
                <input
                  value={subtitle}
                  onChange={(e) => setValue('subtitle', e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Đoạn nội dung">
                <textarea
                  value={body}
                  onChange={(e) => setValue('body', e.target.value)}
                  rows={3}
                  className="w-full resize-none rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>

              <Field label="Dòng chân trang" hint="Để trống nếu không cần, VD: số quyết định">
                <input
                  value={footnote}
                  onChange={(e) => setValue('footnote', e.target.value)}
                  className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Toggle
                  checked={showLogo}
                  onChange={v => setValue('showLogo', v)}
                  label="Hiện logo"
                />
                <Toggle
                  checked={showPoints}
                  onChange={v => setValue('showPoints', v)}
                  label="Hiện số điểm"
                />
                <Toggle
                  checked={showReason}
                  onChange={v => setValue('showReason', v)}
                  label="Hiện lý do"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-[var(--color-border)] pt-5">
              <div className="text-sm font-semibold">Người ký</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Tên người ký" hint="Để trống = tên người trao thưởng">
                  <input
                    value={signerName}
                    onChange={(e) => setValue('signerName', e.target.value)}
                    placeholder="VD: Trần Quốc Hưng"
                    className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                  />
                </Field>
                <Field label="Chức danh">
                  <input
                    value={signerTitle}
                    onChange={(e) => setValue('signerTitle', e.target.value)}
                    placeholder="VD: Giám đốc điều hành"
                    className="w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-background)] px-3 py-2 text-sm"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ImageField
                  label="Chữ ký / con dấu"
                  value={signatureUrl}
                  onChange={v => setValue('signatureUrl', v)}
                  onUpload={(f) => handleUpload('signature', f)}
                  uploading={uploading === 'signature'}
                />
                <ImageField
                  label="Logo riêng"
                  hint="Trống = logo công ty"
                  value={logoUrl}
                  onChange={v => setValue('logoUrl', v)}
                  onUpload={(f) => handleUpload('logo', f)}
                  uploading={uploading === 'logo'}
                />
                <ImageField
                  label="Ảnh nền"
                  value={backgroundUrl}
                  onChange={v => setValue('backgroundUrl', v)}
                  onUpload={(f) => handleUpload('background', f)}
                  uploading={uploading === 'background'}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--color-border)] pt-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">Màu sắc</div>
                {(accentColor || inkColor || surfaceColor) && (
                  <button
                    onClick={() => {
                      setValue('accentColor', '')
                      setValue('inkColor', '')
                      setValue('surfaceColor', '')
                    }}
                    className="flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
                  >
                    <RotateCcw size={12} />
                    Về màu gốc của mẫu
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <ColorField
                  label="Màu nhấn"
                  value={accentColor}
                  fallback={getPreset(preset).colors.accent}
                  onChange={v => setValue('accentColor', v)}
                />
                <ColorField
                  label="Màu chữ"
                  value={inkColor}
                  fallback={getPreset(preset).colors.ink}
                  onChange={v => setValue('inkColor', v)}
                />
                <ColorField
                  label="Màu nền"
                  value={surfaceColor}
                  fallback={getPreset(preset).colors.surface}
                  onChange={v => setValue('surfaceColor', v)}
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-[var(--color-border)] pt-5">
              <Toggle
                checked={isDefault}
                onChange={v => setValue('isDefault', v)}
                label="Đặt làm mẫu mặc định"
                hint="Được chọn sẵn khi mở màn hình in. Mỗi công ty chỉ một mẫu."
              />
              <Toggle
                checked={active}
                onChange={v => setValue('active', v)}
                label="Đang dùng"
                hint="Tắt để giữ lại mẫu nhưng không cho chọn khi in."
              />
            </div>
          </div>

          {/* ── Cột phải: xem trước ── */}
          <div className="overflow-y-auto bg-[var(--color-muted)] p-5">
            <div className="mb-3 text-xs text-[var(--color-muted-foreground)]">
              Xem trước với dữ liệu mẫu — số liệu thật sẽ được điền lúc in.
            </div>
            <EditorPreview
              design={design}
              data={{ ...SAMPLE, organizationName, organizationLogoUrl }}
            />
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium hover:bg-[var(--color-accent)]"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit(onSubmit)}
            disabled={saving}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Tạo mẫu'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Các mảnh nhỏ của biểu mẫu ────────────────────────────────────

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">
        {label}
        {hint && (
          <span className="ml-2 font-normal text-xs text-[var(--color-muted-foreground)]">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]"
      />
      <span className="min-w-0">
        <span className="font-medium">{label}</span>
        {hint && (
          <span className="block text-xs text-[var(--color-muted-foreground)]">{hint}</span>
        )}
      </span>
    </label>
  )
}

/**
 * Ô chọn màu.
 *
 * <p>Ô rỗng hiển thị màu GỐC của thiết kế chứ không phải màu đen — nếu không, mọi mẫu
 * chưa tuỳ biến sẽ trông như đang đặt màu đen và người dùng bấm sửa một cách vô ích.
 */
function ColorField({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string
  value: string
  fallback: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-[var(--color-input)] bg-transparent p-0.5"
        />
        <span className="min-w-0 truncate font-mono text-xs text-[var(--color-muted-foreground)]">
          {value || 'Mặc định'}
        </span>
      </div>
    </div>
  )
}

function ImageField({
  label,
  hint,
  value,
  onChange,
  onUpload,
  uploading,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  onUpload: (file: File) => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">· {hint}</span>}
      </div>
      <div className="relative flex h-20 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-background)]">
        {uploading ? (
          <Loader2 size={18} className="animate-spin text-[var(--color-muted-foreground)]" />
        ) : value ? (
          <>
            {/* Nền ô ca-rô để chữ ký PNG nền trong không lẫn vào nền trắng của khung. */}
            <img src={value} alt="" className="max-h-full max-w-full object-contain p-1.5" />
            <button
              onClick={() => onChange('')}
              title="Gỡ ảnh"
              className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white hover:bg-black/75"
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <button
            onClick={() => inputRef.current?.click()}
            className="flex flex-col items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            <Upload size={16} />
            Tải ảnh
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

/** Bảng chỗ giữ, bấm để chép nhanh. */
function PlaceholderHelp() {
  return (
    <div className="rounded-xl bg-[var(--color-muted)] p-3">
      <div className="mb-2 text-xs font-medium">
        Chèn dữ liệu tự động — bấm để sao chép, rồi dán vào ô bất kỳ bên dưới
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CERTIFICATE_PLACEHOLDERS.map((p) => (
          <button
            key={p.token}
            onClick={() => {
              navigator.clipboard
                ?.writeText(p.token)
                .then(() => toast.success(`Đã sao chép ${p.token}`))
                // Trình duyệt chặn clipboard (thường vì không chạy HTTPS) — chỗ giữ vẫn
                // hiện rõ trên nút nên người dùng gõ tay được, không cần doạ bằng lỗi đỏ.
                .catch(() => toast.info(`Hãy gõ tay: ${p.token}`))
            }}
            title={p.label}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 font-mono text-[11px] hover:bg-[var(--color-accent)]"
          >
            {p.token}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Ô vuông nhỏ gợi ý bảng màu của từng thiết kế. */
function PresetSwatch({ presetKey }: { presetKey: string }) {
  const p = getPreset(presetKey)
  return (
    <div
      className="flex h-10 w-full items-center justify-center gap-1 rounded-lg border border-black/5"
      style={{ backgroundColor: p.colors.surface }}
    >
      <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.colors.accent }} />
      <span className="h-1.5 w-8 rounded-full" style={{ backgroundColor: p.colors.ink, opacity: 0.5 }} />
    </div>
  )
}

/** Bản xem trước co theo bề rộng cột phải. */
function EditorPreview({
  design,
  data,
}: {
  design: ReturnType<typeof resolveDesign>
  data: CertificateData
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.4)
  const page = CERTIFICATE_PAGE[design.orientation]

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return

    const measure = () => {
      const width = box.clientWidth
      if (width > 0) setScale(Math.min(width / page.width, 0.9))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [page.width])

  return (
    <div ref={boxRef} className="flex w-full justify-center">
      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10">
        <CertificateCanvas design={design} data={data} scale={scale} />
      </div>
    </div>
  )
}
