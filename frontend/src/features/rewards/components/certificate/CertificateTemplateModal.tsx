import { intlDateLocale } from '@/i18n/format'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Upload, Trash2, RotateCcw, Eraser } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { toastUploadError } from '@/lib/upload'
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
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import { perLanguage } from '@/i18n/perLanguage'
import { useFormDraft } from '@/hooks/useFormDraft'
import DraftNotice from '@/components/common/DraftNotice'
import { BackgroundNotRemovableError, removeImageBackground } from './removeImageBackground'
import { tourAnchor } from '@/components/common/tours/anchors'
import { blockedByTour } from '@/components/common/tours/guard'

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
const SAMPLE = perLanguage((): Omit<CertificateData, 'organizationName' | 'organizationLogoUrl'> => ({
  recipientName: i18n.t('rewards:CertificateTemplateModal.nguyenThiMinhAnh'),
  points: 500,
  reason: i18n.t('rewards:CertificateTemplateModal.ledTheTeamToFinishThe'),
  dateLabel: new Date().toLocaleDateString(intlDateLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }),
  grantorName: i18n.t('rewards:CertificateTemplateModal.tranQuocHung'),
  orgUnitName: i18n.t('rewards:CertificateTemplateModal.salesDepartment'),
}))

type ImageSlot = 'signature' | 'logo' | 'background'

export default function CertificateTemplateModal({
  open,
  onClose,
  editTemplate,
  organizationName,
  organizationLogoUrl,
}: CertificateTemplateModalProps) {
  const { t } = useTranslation('rewards')
  const isEdit = !!editTemplate
  const { createTemplate, updateTemplate, isCreating, isUpdating } = useCertificateTemplates()

  const formApi = useForm<CertificateTemplateFormData>({
    resolver: zodResolver(certificateTemplateSchema()),
    defaultValues: {
      name: '', preset: DEFAULT_PRESET().key, orientation: CertificateOrientation.LANDSCAPE,
      eyebrow: '', title: '', subtitle: '', body: '', footnote: '',
      signerName: '', signerTitle: '', signatureUrl: '', logoUrl: '', backgroundUrl: '',
      accentColor: '', inkColor: '', surfaceColor: '',
      showLogo: true, showOrgName: true, showPoints: true, showReason: true, isDefault: false, active: true,
    },
  })
  const { handleSubmit, reset, watch, setValue, formState: { errors } } = formApi
  const draft = useFormDraft(formApi, { key: `certificate-template:${editTemplate?.id ?? 'new'}`, enabled: open })

  // Bản xem trước bên phải vẽ lại theo TỪNG ký tự vừa gõ, và mọi ô ở đây là thành phần
  // tự vẽ (Toggle / ColorField / ImageField) chứ không phải input thuần, nên theo dõi cả
  // form rồi rải giá trị xuống thay vì đăng ký từng ô.
  const {
    name, preset, orientation, eyebrow, title, subtitle, body, footnote,
    signerName, signerTitle, signatureUrl, logoUrl, backgroundUrl,
    accentColor, inkColor, surfaceColor,
    showLogo, showOrgName, showPoints, showReason, isDefault, active,
  } = watch()

  const [uploading, setUploading] = useState<ImageSlot | null>(null)
  // Logo và chữ ký mặc định được tách nền khi tải lên; ảnh nền thì không bao giờ.
  const [autoRemoveBg, setAutoRemoveBg] = useState(true)

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
        showOrgName: editTemplate.showOrgName ?? true,
        showPoints: editTemplate.showPoints,
        showReason: editTemplate.showReason,
        isDefault: editTemplate.isDefault,
        active: editTemplate.status === CertificateTemplateStatus.ACTIVE,
      })
      return
    }

    // Mẫu mới bắt đầu từ nguyên văn của thiết kế dựng sẵn, không phải từ ô trống: người
    // soạn sửa vài chữ là xong, thay vì phải tự nghĩ ra toàn bộ lời chứng nhận.
    const base = DEFAULT_PRESET()
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
      showLogo: true, showOrgName: true, showPoints: true, showReason: true, isDefault: false, active: true,
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
        showOrgName,
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
      showOrgName,
      showPoints,
      showReason,
      isDefault,
      active,
    ]
  )

  if (!open) return null

  const setSlotUrl = (slot: ImageSlot, url: string) => {
    if (slot === 'signature') setValue('signatureUrl', url)
    if (slot === 'logo') setValue('logoUrl', url)
    if (slot === 'background') setValue('backgroundUrl', url)
  }

  /**
   * Tách nền rồi trả về tệp đã xử lý. Không tách được (ảnh đã trong suốt, ảnh chụp nhiều
   * màu) thì dùng nguyên ảnh gốc — tách nền là phần phụ, không được chặn việc tải ảnh.
   */
  const stripBackground = async (slot: ImageSlot, source: File | string, notifyUnchanged: boolean) => {
    try {
      return await removeImageBackground(source, slot === 'signature' ? 'signature' : 'logo')
    } catch (e) {
      if (notifyUnchanged) {
        toast.info(
          e instanceof BackgroundNotRemovableError && e.reason === 'ALREADY_TRANSPARENT'
            ? t('CertificateTemplateModal.backgroundAlreadyTransparent')
            : t('CertificateTemplateModal.backgroundNotRemovable')
        )
      }
      return null
    }
  }

  const handleUpload = async (slot: ImageSlot, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(t('CertificateTemplateModal.onlyImageFilesAreAccepted'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('CertificateTemplateModal.theImageMustNotExceed5mb'))
      return
    }
    setUploading(slot)
    let toSend: File = file
    try {
      const processed =
        slot !== 'background' && autoRemoveBg ? await stripBackground(slot, file, false) : null
      toSend = processed ?? file
      setSlotUrl(slot, await certificateApi.uploadImage(toSend))
    } catch (e) {
      toastUploadError(e, () => void resendImage(slot, toSend), t('CertificateTemplateModal.imageUploadFailed'))
    } finally {
      setUploading(null)
    }
  }

  /** Gửi lại đúng ảnh vừa hỏng (đã tách nền nếu có) — nút Thử lại trên toast. */
  const resendImage = async (slot: ImageSlot, image: File) => {
    setUploading(slot)
    try {
      setSlotUrl(slot, await certificateApi.uploadImage(image))
    } catch (e) {
      toastUploadError(e, () => void resendImage(slot, image), t('CertificateTemplateModal.imageUploadFailed'))
    } finally {
      setUploading(null)
    }
  }

  /** Tách nền cho ảnh ĐÃ tải lên từ trước (mẫu cũ có chữ ký nền trắng). */
  const handleRemoveBackground = async (slot: ImageSlot, url: string) => {
    setUploading(slot)
    try {
      const processed = await stripBackground(slot, url, true)
      if (processed) {
        setSlotUrl(slot, await certificateApi.uploadImage(processed))
        toast.success(t('CertificateTemplateModal.backgroundRemoved'))
      }
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('CertificateTemplateModal.imageUploadFailed')))
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
    if (blockedByTour()) return
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
      showOrgName: data.showOrgName,
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
    <Dialog {...tourAnchor('cert.form')}
      open
      onClose={onClose}
      size="full"
      flush
      dismissible={!saving}
      title={isEdit ? t('CertificateTemplateModal.editCertificateTemplate') : t('CertificateTemplateModal.createCertificateTemplate')}
      footer={
        <DialogFooter
          secondary={<Button variant="outline" onClick={onClose} disabled={saving}>{t('CertificateTemplateModal.cancel')}</Button>}
          primary={
            <Button {...tourAnchor('cert.form.submit')} onClick={handleSubmit(onSubmit)} disabled={saving}>
              {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
              {isEdit ? t('CertificateTemplateModal.saveChanges') : t('CertificateTemplateModal.createTemplate')}
            </Button>
          }
        />
      }
    >
      <DraftNotice draft={draft} className="mb-4" />
      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Cột trái: biểu mẫu ── */}
        <div className="space-y-6 border-b border-[var(--color-border)] p-5 lg:border-b-0 lg:border-r">
          <Field {...tourAnchor('cert.form.name')} label={t('CertificateTemplateModal.templateName')} hint={t('CertificateTemplateModal.onlyShownInTheSelectionList')}>
            <input
              value={name}
              onChange={(e) => setValue('name', e.target.value, { shouldValidate: true })}
              placeholder={t('CertificateTemplateModal.eGEmployeeOfTheWeek')}
              className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
            />
            {errors.name && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.name.message}</p>}
          </Field>

          <div {...tourAnchor('cert.form.style')}>
            <div className="mb-2 text-sm font-medium">{t('CertificateTemplateModal.designStyle')}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CERTIFICATE_PRESETS().map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePresetChange(p.key)}
                  title={p.tagline}
                  className={`rounded-card border p-2 text-left transition-colors ${preset === p.key
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

          <Field {...tourAnchor('cert.form.paper')} label={t('CertificateTemplateModal.paperSize')}>
            <div className="flex gap-1.5">
              {[
                { key: CertificateOrientation.LANDSCAPE, label: 'Ngang (A4)' },
                { key: CertificateOrientation.PORTRAIT, label: t('CertificateTemplateModal.portraitA4') },
              ].map((o) => (
                <ChoiceChip selected={orientation === o.key} variant="solid" className="flex-1 py-2" key={o.key} onClick={() => setValue('orientation', o.key)}>
                  {o.label}
                </ChoiceChip>
              ))}
            </div>
          </Field>

          <div {...tourAnchor('cert.form.content')} className="space-y-4 border-t border-[var(--color-border)] pt-5">
            <div className="text-sm font-semibold">{t('CertificateTemplateModal.contentPrintedOnPaper')}</div>

            <PlaceholderHelp />

            <Field label={t('CertificateTemplateModal.leadInLine')} hint={t('CertificateTemplateModal.smallTextAboveTheTitle')}>
              <input
                value={eyebrow}
                onChange={(e) => setValue('eyebrow', e.target.value)}
                className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label={t('CertificateTemplateModal.title')}>
              <input
                value={title}
                onChange={(e) => setValue('title', e.target.value, { shouldValidate: true })}
                className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm font-medium"
              />
              {errors.title && <p className="mt-1 text-xs text-[var(--color-error)]">{errors.title.message}</p>}
            </Field>

            <Field label={t('CertificateTemplateModal.subtitle')} hint={t('CertificateTemplateModal.theLineJustAboveTheRecipients')}>
              <input
                value={subtitle}
                onChange={(e) => setValue('subtitle', e.target.value)}
                className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label={t('CertificateTemplateModal.bodyParagraph')}>
              <textarea
                value={body}
                onChange={(e) => setValue('body', e.target.value)}
                rows={3}
                className="w-full resize-none rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            </Field>

            <Field label={t('CertificateTemplateModal.footerLine')} hint={t('CertificateTemplateModal.leaveEmptyIfNotNeededE')}>
              <input
                value={footnote}
                onChange={(e) => setValue('footnote', e.target.value)}
                className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
              />
            </Field>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Toggle
                checked={showLogo}
                onChange={v => setValue('showLogo', v)}
                label={t('CertificateTemplateModal.showLogo')}
              />
              <Toggle
                checked={showOrgName}
                onChange={v => setValue('showOrgName', v)}
                label={t('CertificateTemplateModal.showOrgName')}
                hint={t('CertificateTemplateModal.showOrgNameHint')}
              />
              <Toggle
                checked={showPoints}
                onChange={v => setValue('showPoints', v)}
                label={t('CertificateTemplateModal.showPoints')}
              />
              <Toggle
                checked={showReason}
                onChange={v => setValue('showReason', v)}
                label={t('CertificateTemplateModal.showReason')}
              />
            </div>
          </div>

          <div {...tourAnchor('cert.form.signer')} className="space-y-4 border-t border-[var(--color-border)] pt-5">
            <div className="text-sm font-semibold">{t('CertificateTemplateModal.signer')}</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('CertificateTemplateModal.signerName')} hint={t('CertificateTemplateModal.emptyTheNameOfThePerson')}>
                <input
                  value={signerName}
                  onChange={(e) => setValue('signerName', e.target.value)}
                  placeholder={t('CertificateTemplateModal.eGTranQuocHung')}
                  className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>
              <Field label={t('CertificateTemplateModal.title2')}>
                <input
                  value={signerTitle}
                  onChange={(e) => setValue('signerTitle', e.target.value)}
                  placeholder={t('CertificateTemplateModal.eGChiefExecutiveOfficer')}
                  className="w-full rounded-control border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ImageField
                label={t('CertificateTemplateModal.signatureSeal')}
                value={signatureUrl}
                onChange={v => setValue('signatureUrl', v)}
                onUpload={(f) => handleUpload('signature', f)}
                onRemoveBackground={() => handleRemoveBackground('signature', signatureUrl)}
                uploading={uploading === 'signature'}
              />
              <ImageField
                label={t('CertificateTemplateModal.customLogo')}
                hint={t('CertificateTemplateModal.emptyCompanyLogo')}
                value={logoUrl}
                onChange={v => setValue('logoUrl', v)}
                onUpload={(f) => handleUpload('logo', f)}
                onRemoveBackground={() => handleRemoveBackground('logo', logoUrl)}
                uploading={uploading === 'logo'}
              />
              <ImageField
                label={t('CertificateTemplateModal.backgroundImage')}
                value={backgroundUrl}
                onChange={v => setValue('backgroundUrl', v)}
                onUpload={(f) => handleUpload('background', f)}
                uploading={uploading === 'background'}
              />
            </div>
            <Toggle
              checked={autoRemoveBg}
              onChange={setAutoRemoveBg}
              label={t('CertificateTemplateModal.autoRemoveBackground')}
              hint={t('CertificateTemplateModal.autoRemoveBackgroundHint')}
            />
          </div>

          <div {...tourAnchor('cert.form.colors')} className="space-y-3 border-t border-[var(--color-border)] pt-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">{t('CertificateTemplateModal.color')}</div>
              {(accentColor || inkColor || surfaceColor) && (
                <Button variant="ghost" size="sm" onClick={() => {
                    setValue('accentColor', '')
                    setValue('inkColor', '')
                    setValue('surfaceColor', '')
                  }}>
                  <RotateCcw aria-hidden="true" />
                  {t('CertificateTemplateModal.backToTheTemplatesOriginalColors')}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ColorField
                label={t('CertificateTemplateModal.accentColor')}
                value={accentColor}
                fallback={getPreset(preset).colors.accent}
                onChange={v => setValue('accentColor', v)}
              />
              <ColorField
                label={t('CertificateTemplateModal.textColor')}
                value={inkColor}
                fallback={getPreset(preset).colors.ink}
                onChange={v => setValue('inkColor', v)}
              />
              <ColorField
                label={t('CertificateTemplateModal.backgroundColor')}
                value={surfaceColor}
                fallback={getPreset(preset).colors.surface}
                onChange={v => setValue('surfaceColor', v)}
              />
            </div>
          </div>

          <div {...tourAnchor('cert.form.flags')} className="space-y-3 border-t border-[var(--color-border)] pt-5">
            <Toggle
              checked={isDefault}
              onChange={v => setValue('isDefault', v)}
              label={t('CertificateTemplateModal.makeDefaultTemplate')}
              hint={t('CertificateTemplateModal.preselectedWhenOpeningThePrintScreen')}
            />
            <Toggle
              checked={active}
              onChange={v => setValue('active', v)}
              label={t('CertificateTemplateModal.inUse')}
              hint={t('CertificateTemplateModal.turnOffToKeepTheTemplate')}
            />
          </div>
        </div>

        {/* ── Cột phải: xem trước ── */}
        <div {...tourAnchor('cert.form.preview')} className="bg-[var(--color-muted)] p-5">
          <div className="mb-3 text-xs text-[var(--color-muted-foreground)]">
            {t('CertificateTemplateModal.previewWithSampleDataRealFigures')}
          </div>
          <EditorPreview
            design={design}
            data={{ ...SAMPLE(), organizationName, organizationLogoUrl }}
          />
        </div>
      </div>

    </Dialog>
  )
}

// ── Các mảnh nhỏ của biểu mẫu ────────────────────────────────────

function Field({
  label,
  hint,
  children,
  ...rest
}: {
  label: string
  hint?: string
  children: React.ReactNode
  'data-tour'?: string
}) {
  return (
    <div {...rest}>
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
  const { t } = useTranslation('rewards')
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-control border border-[var(--color-border)] bg-transparent p-0.5"
        />
        <span className="min-w-0 truncate font-mono text-xs text-[var(--color-muted-foreground)]">
          {value || t('CertificateTemplateModal.default')}
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
  onRemoveBackground,
  uploading,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  onUpload: (file: File) => void
  /** Có = hiện nút tách nền cho ảnh đã tải lên. */
  onRemoveBackground?: () => void
  uploading: boolean
}) {
  const { t } = useTranslation('rewards')
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium">
        {label}
        {hint && <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">· {hint}</span>}
      </div>
      <div
        className="relative flex h-20 items-center justify-center overflow-hidden rounded-control border border-dashed border-[var(--color-border)] bg-[var(--color-background)]"
        // Nền ô ca-rô khi đã có ảnh: nhìn là biết ảnh đã trong suốt hay còn khối nền trắng.
        style={
          value && !uploading
            ? {
                backgroundImage:
                  'repeating-conic-gradient(rgba(128,128,128,0.18) 0% 25%, transparent 0% 50%)',
                backgroundSize: '12px 12px',
              }
            : undefined
        }
      >
        {uploading ? (
          <Loader2 size={18} className="animate-spin text-[var(--color-muted-foreground)]" />
        ) : value ? (
          <>
            <img src={value} alt="" className="max-h-full max-w-full object-contain p-1.5" />
            {onRemoveBackground && (
              <button
                onClick={onRemoveBackground}
                title={t('CertificateTemplateModal.removeBackground')}
                aria-label={t('CertificateTemplateModal.removeBackground')}
                className="absolute left-1 top-1 rounded-md bg-black/55 p-1 text-white hover:bg-black/75"
              >
                <Eraser size={12} />
              </button>
            )}
            <button
              onClick={() => onChange('')}
              title={t('CertificateTemplateModal.removeImage')}
              className="absolute right-1 top-1 rounded-md bg-black/55 p-1 text-white hover:bg-black/75"
            >
              <Trash2 size={12} />
            </button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" />
            {t('CertificateTemplateModal.uploadImage')}
          </Button>
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
  const { t } = useTranslation('rewards')
  return (
    <div className="rounded-card bg-[var(--color-muted)] p-3">
      <div className="mb-2 text-xs font-medium">
        {t('CertificateTemplateModal.insertAutomaticDataClickToCopy')}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CERTIFICATE_PLACEHOLDERS().map((p) => (
          <Button variant="outline" size="sm" key={p.token} onClick={() => {
              navigator.clipboard
                ?.writeText(p.token)
                .then(() => toast.success(t('CertificateTemplateModal.copied', { token: p.token })))
                // Trình duyệt chặn clipboard (thường vì không chạy HTTPS) — chỗ giữ vẫn
                // hiện rõ trên nút nên người dùng gõ tay được, không cần doạ bằng lỗi đỏ.
                .catch(() => toast.info(t('CertificateTemplateModal.pleaseTypeItManually', { token: p.token })))
            }} title={p.label}>
            {p.token}
          </Button>
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
      className="flex h-10 w-full items-center justify-center gap-1 rounded-control border border-black/5"
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
      <div className="overflow-hidden rounded-control shadow-lg ring-1 ring-black/10">
        <CertificateCanvas design={design} data={data} scale={scale} />
      </div>
    </div>
  )
}
