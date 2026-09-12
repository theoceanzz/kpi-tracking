import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmailTemplateSchema, type EmailTemplateFormData } from '../schemas/integrationSchema'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { emailTemplateApi, type EmailTemplate } from '../api/emailTemplateApi'
import EmailEditor from './EmailEditor'
import {
  Mail, Save, RotateCcw, Eye, Loader2, Code2, Info, X, AlertTriangle, Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

const serverMessage = (error: unknown, fallback: string) =>
  getApiErrorMessage(error, fallback)

/**
 * Cấu hình template email của tổ chức. Danh mục loại mail do backend trả về
 * (EmailTemplateCatalog) nên thêm loại mail mới không phải sửa gì ở đây.
 */
export default function EmailTemplateSettingsTab({ onOpenNotificationSettings }: {
  /** Chuyển sang tab Thiết lập thông báo — nơi quản việc bật/tắt gửi cho sự kiện KPI. */
  onOpenNotificationSettings?: () => void
} = {}) {
  const qc = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: emailTemplateApi.list,
  })

  const [activeCode, setActiveCode] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const active = useMemo(
    () => templates.find(t => t.code === activeCode) || templates[0],
    [templates, activeCode],
  )

  // Mỗi loại email đòi bộ biến bắt buộc riêng nên schema dựng theo template đang mở.
  const schema = useMemo(
    () => createEmailTemplateSchema(active?.requiredVariables ?? []),
    [active?.requiredVariables],
  )

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<EmailTemplateFormData>({
    resolver: zodResolver(schema),
    defaultValues: { subject: '', body: '', fullHtml: false, enabled: true },
  })

  // Trình soạn trực quan và bản xem trước đọc theo từng ký tự vừa gõ.
  const subject = watch('subject')
  const body = watch('body')
  const fullHtml = watch('fullHtml')
  const enabled = watch('enabled')

  // Nạp nội dung của template đang chọn. Mốc là `code` chứ không phải cả object, nếu
  // không mỗi lần refetch sẽ ghi đè những gì người dùng đang gõ dở.
  const loadedCode = useRef<string | null>(null)
  useEffect(() => {
    if (!active || active.code === loadedCode.current) return
    loadedCode.current = active.code
    reset({
      subject: active.subject,
      body: active.body,
      fullHtml: active.fullHtml,
      enabled: active.enabled,
    })
    setPreview(null)
  }, [active, reset])

  const payload = () => ({ subject, body, fullHtml, enabled })

  /**
   * Hai chế độ dùng chung một chuỗi HTML nên chuyển qua lại không mất gì:
   * trình soạn trực quan đọc lại được HTML nhờ các thuộc tính data-email.
   */
  const toggleAdvanced = () => {
    setValue('fullHtml', !fullHtml)
    setPreview(null)
  }

  const groups = useMemo(() => {
    const map = new Map<string, EmailTemplate[]>()
    templates.forEach(t => {
      if (!map.has(t.group)) map.set(t.group, [])
      map.get(t.group)!.push(t)
    })
    return [...map.entries()]
  }, [templates])

  const saveMutation = useMutation({
    mutationFn: (data: EmailTemplateFormData) => emailTemplateApi.save(active!.code, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['emailTemplates'] })
      toast.success('Đã lưu template email')
    },
    onError: (e) => toast.error(serverMessage(e, 'Lưu template thất bại')),
  })

  const resetMutation = useMutation({
    mutationFn: () => emailTemplateApi.reset(active!.code),
    onSuccess: (fresh) => {
      qc.invalidateQueries({ queryKey: ['emailTemplates'] })
      reset({
        subject: fresh.subject,
        body: fresh.body,
        fullHtml: fresh.fullHtml,
        enabled: fresh.enabled,
      })
      setPreview(null)
      toast.success('Đã khôi phục nội dung mặc định')
    },
    onError: (e) => toast.error(serverMessage(e, 'Khôi phục thất bại')),
  })

  const previewMutation = useMutation({
    mutationFn: () => emailTemplateApi.preview(active!.code, payload()),
    onSuccess: (result) => setPreview(result.html),
    onError: (e) => toast.error(serverMessage(e, 'Không tạo được bản xem trước')),
  })

  // Biến bắt buộc phải xuất hiện trong tiêu đề hoặc nội dung đang soạn. Cảnh báo hiện
  // ngay khi gõ chứ không đợi bấm Lưu; schema chặn lần cuối bằng đúng luật này.
  const missingRequired = active
    ? active.requiredVariables.filter(v => !`${subject} ${body}`.includes(`{{${v}}}`))
    : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={28} className="animate-spin text-[var(--color-subtle-foreground)]" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Danh sách loại mail */}
      {/* Danh sách vài chục loại mail: khoá chiều cao theo khung nhìn và cuộn bên trong, dính khi
          cuộn trang — để cột trái không kéo cả trang dài gấp ba lần khung soạn thảo bên phải. */}
      <div id="tour-email-list" className="custom-scrollbar max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-card border border-[var(--color-border)] bg-[var(--color-card)] p-3 lg:sticky lg:top-4">
        {groups.map(([group, items]) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="px-2 py-1.5 text-eyebrow">{group}</p>
            <div className="space-y-0.5">
              {items.map(t => (
                <ChoiceChip selected={active?.code === t.code} className="w-full text-left" key={t.code} onClick={() => setActiveCode(t.code)}>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm font-medium">{t.label}</span>
                  </span>
                  {t.enabledControl === 'self' && !t.enabled && (
                    <span title="Đang tắt gửi" className="shrink-0">
                      <X className="text-[var(--color-subtle-foreground)]" />
                    </span>
                  )}
                  {t.customized && t.enabled && (
                    <span title="Đã tuỳ chỉnh" className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] shrink-0" />
                  )}
                </ChoiceChip>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trình soạn thảo */}
      {active && (
        <div id="tour-email-editor" className="bg-[var(--color-card)] rounded-card border border-[var(--color-border)] p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-card bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0">
                <Mail size={18} className="text-[var(--color-primary)]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-section-title text-[var(--color-foreground)] tracking-tight">{active.label}</h3>
                <p className="text-xs text-[var(--color-muted-foreground)] font-medium mt-0.5">{active.description}</p>
                <p className="text-caption font-medium mt-1">Mã: {active.code}</p>
              </div>
            </div>

            {/* Công tắc chỉ hiện với loại mail tự quản việc bật/tắt. Xem enabledControl. */}
            {active.enabledControl === 'self' && (
              <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                <span className="text-eyebrow">Bật gửi</span>
                <button
                  onClick={() => setValue('enabled', !enabled)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative',
                    enabled ? 'bg-[var(--color-success-solid)]' : 'bg-[var(--color-border)]',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                    enabled ? 'left-[22px]' : 'left-0.5',
                  )} />
                </button>
              </label>
            )}

            {active.enabledControl === 'locked' && (
              <span
                title="Tắt loại mail này sẽ khiến người dùng không nhận được mã xác thực và mất quyền truy cập hệ thống"
                className="text-eyebrow flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]"
              >
                <Lock size={12} /> Luôn bật
              </span>
            )}
          </div>

          {active.enabledControl === 'notification_settings' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
              <Info size={15} className="text-[var(--color-subtle-foreground)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-muted-foreground)] font-medium leading-relaxed">
                Ở đây chỉ sửa <b>nội dung</b> email. Việc bật/tắt gửi cho sự kiện này — cả qua email lẫn
                chuông thông báo trong hệ thống — nằm ở tab{' '}
                {onOpenNotificationSettings ? (
                  <Button variant="ghost" onClick={onOpenNotificationSettings}>
                    Thiết lập thông báo
                  </Button>
                ) : <b>Thiết lập thông báo</b>}.
              </p>
            </div>
          )}

          {active.enabledControl === 'locked' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-[var(--color-warning-bg)] border border-[var(--color-warning-border)]">
              <Lock size={15} className="text-[var(--color-warning)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-warning)] font-medium leading-relaxed">
                Đây là email bảo mật nên <b>không thể tắt</b>. Nội dung vẫn sửa được, nhưng nếu ngừng gửi
                thì không ai lấy được mã xác thực để đăng nhập hay khôi phục mật khẩu.
              </p>
            </div>
          )}

          {active.enabledControl === 'self' && !enabled && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-[var(--color-muted)] border border-[var(--color-border)]">
              <Info size={15} className="text-[var(--color-subtle-foreground)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-muted-foreground)] font-medium">
                Loại email này đang <b>tắt</b> — hệ thống sẽ không gửi. Thông báo trong hệ thống vẫn hoạt động bình thường.
              </p>
            </div>
          )}

          {/* Tiêu đề */}
          <div id="tour-email-subject">
            <label className="text-label">Tiêu đề email</label>
            <input
              {...register('subject')}
              className="w-full mt-2 px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-sm font-medium outline-none focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all"
            />
            {errors.subject && <p className="mt-1 text-xs font-medium text-[var(--color-error)]">{errors.subject.message}</p>}
          </div>

          {/* Nội dung */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-label">
                {fullHtml ? 'Toàn bộ HTML' : 'Nội dung email'}
              </label>
              <button
                onClick={toggleAdvanced}
                title="Chế độ nâng cao dành cho người biết HTML: tự viết toàn bộ tài liệu, hệ thống không bọc khung header/footer"
                className={cn(
                  'text-eyebrow flex items-center gap-1.5 px-2.5 py-1 rounded-control transition-colors',
                  fullHtml
                    ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                    : 'text-[var(--color-subtle-foreground)] hover:bg-[var(--color-muted)]',
                )}
              >
                <Code2 size={12} /> {fullHtml ? 'Nâng cao: bật' : 'Nâng cao'}
              </button>
            </div>

            {fullHtml ? (
              <>
                <textarea
                  {...register('body')}
                  rows={16}
                  spellCheck={false}
                  className="w-full px-4 py-3 rounded-card border border-[var(--color-border)] bg-[var(--color-muted)] text-[13px] font-mono leading-relaxed outline-none focus:ring-4 focus:ring-[var(--color-ring)] focus:border-[var(--color-primary)] transition-all resize-y"
                />
                <p className="text-caption font-medium mt-1.5 leading-relaxed">
                  Bạn đang tự viết toàn bộ tài liệu HTML. Thẻ script, iframe và các handler onclick sẽ bị loại bỏ khi lưu.
                  Tắt chế độ nâng cao để quay lại trình soạn trực quan.
                </p>
              </>
            ) : (
              <EmailEditor value={body} onChange={v => setValue('body', v, { shouldValidate: true })} variables={active.variables} />
            )}
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-[var(--color-error-bg)] border border-[var(--color-error-border)]">
              <AlertTriangle size={15} className="text-[var(--color-error)] shrink-0 mt-0.5" />
              <p className="text-xs text-[var(--color-error)] font-medium leading-relaxed">
                Thiếu biến bắt buộc: <b className="font-mono">{missingRequired.map(v => `{{${v}}}`).join(', ')}</b>.
                Không có biến này email sẽ vô dụng với người nhận nên hệ thống sẽ từ chối lưu.
              </p>
            </div>
          )}

          {/* Hành động */}
          <div id="tour-email-actions" className="flex flex-wrap items-center gap-3 pt-2 border-t border-[var(--color-border)]">
            <Button variant="outline" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending}>
              {previewMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Eye aria-hidden="true" />}
              Xem trước
            </Button>
            <Button variant="outline" onClick={() => resetMutation.mutate()} disabled={!active.customized || resetMutation.isPending} title={active.customized ? undefined : 'Template này đang dùng nội dung mặc định'}>
              <RotateCcw aria-hidden="true" /> Khôi phục mặc định
            </Button>
            <Button className="ml-auto" onClick={handleSubmit(data => saveMutation.mutate(data))} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
              Lưu template
            </Button>
          </div>

          {/* Xem trước — dựng trong iframe sandbox để HTML người dùng nhập
              không chạm được vào trang cấu hình. */}
          {preview !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-label">Bản xem trước</label>
                <button onClick={() => setPreview(null)} className="p-1.5 text-[var(--color-subtle-foreground)] hover:text-[var(--color-muted-foreground)] rounded-control">
                  <X size={14} />
                </button>
              </div>
              <iframe
                title="Xem trước email"
                sandbox=""
                srcDoc={preview}
                className="w-full h-[500px] rounded-card border border-[var(--color-border)] bg-[var(--color-card)]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
