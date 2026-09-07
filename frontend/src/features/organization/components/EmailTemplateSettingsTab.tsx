import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createEmailTemplateSchema, type EmailTemplateFormData } from '../schemas/integrationSchema'
import type { AxiosError } from 'axios'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { emailTemplateApi, type EmailTemplate } from '../api/emailTemplateApi'
import EmailEditor from './EmailEditor'
import {
  Mail, Save, RotateCcw, Eye, Loader2, Code2, Info, X, AlertTriangle, Lock,
} from 'lucide-react'

const serverMessage = (error: unknown, fallback: string) =>
  (error as AxiosError<{ message?: string }>)?.response?.data?.message || fallback

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
        <Loader2 size={28} className="animate-spin text-slate-300" />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      {/* Danh sách loại mail */}
      <div id="tour-email-list" className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 p-4 h-fit lg:sticky lg:top-4">
        {groups.map(([group, items]) => (
          <div key={group} className="mb-4 last:mb-0">
            <p className="px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{group}</p>
            <div className="space-y-0.5">
              {items.map(t => (
                <button
                  key={t.code}
                  onClick={() => setActiveCode(t.code)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors',
                    active?.code === t.code
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60',
                  )}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-bold truncate">{t.label}</span>
                  </span>
                  {t.enabledControl === 'self' && !t.enabled && (
                    <span title="Đang tắt gửi" className="shrink-0">
                      <X size={12} className="text-slate-400" />
                    </span>
                  )}
                  {t.customized && t.enabled && (
                    <span title="Đã tuỳ chỉnh" className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Trình soạn thảo */}
      {active && (
        <div id="tour-email-editor" className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
                <Mail size={18} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">{active.label}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">{active.description}</p>
                <p className="text-[10px] text-slate-400 font-medium mt-1">Mã: {active.code}</p>
              </div>
            </div>

            {/* Công tắc chỉ hiện với loại mail tự quản việc bật/tắt. Xem enabledControl. */}
            {active.enabledControl === 'self' && (
              <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Bật gửi</span>
                <button
                  onClick={() => setValue('enabled', !enabled)}
                  className={cn(
                    'w-11 h-6 rounded-full transition-colors relative',
                    enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700',
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
                className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-500"
              >
                <Lock size={12} /> Luôn bật
              </span>
            )}
          </div>

          {active.enabledControl === 'notification_settings' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Ở đây chỉ sửa <b>nội dung</b> email. Việc bật/tắt gửi cho sự kiện này — cả qua email lẫn
                chuông thông báo trong hệ thống — nằm ở tab{' '}
                {onOpenNotificationSettings ? (
                  <button
                    onClick={onOpenNotificationSettings}
                    className="font-black text-indigo-600 hover:underline"
                  >
                    Thiết lập thông báo
                  </button>
                ) : <b>Thiết lập thông báo</b>}.
              </p>
            </div>
          )}

          {active.enabledControl === 'locked' && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
              <Lock size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                Đây là email bảo mật nên <b>không thể tắt</b>. Nội dung vẫn sửa được, nhưng nếu ngừng gửi
                thì không ai lấy được mã xác thực để đăng nhập hay khôi phục mật khẩu.
              </p>
            </div>
          )}

          {active.enabledControl === 'self' && !enabled && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
              <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 font-medium">
                Loại email này đang <b>tắt</b> — hệ thống sẽ không gửi. Thông báo trong hệ thống vẫn hoạt động bình thường.
              </p>
            </div>
          )}

          {/* Tiêu đề */}
          <div id="tour-email-subject">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tiêu đề email</label>
            <input
              {...register('subject')}
              className="w-full mt-2 px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm font-medium outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all"
            />
            {errors.subject && <p className="mt-1 text-xs font-bold text-red-500">{errors.subject.message}</p>}
          </div>

          {/* Nội dung */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {fullHtml ? 'Toàn bộ HTML' : 'Nội dung email'}
              </label>
              <button
                onClick={toggleAdvanced}
                title="Chế độ nâng cao dành cho người biết HTML: tự viết toàn bộ tài liệu, hệ thống không bọc khung header/footer"
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors',
                  fullHtml
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600'
                    : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800',
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
                  className="w-full px-4 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[13px] font-mono leading-relaxed outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all resize-y"
                />
                <p className="text-[10px] text-slate-400 font-medium mt-1.5 leading-relaxed">
                  Bạn đang tự viết toàn bộ tài liệu HTML. Thẻ script, iframe và các handler onclick sẽ bị loại bỏ khi lưu.
                  Tắt chế độ nâng cao để quay lại trình soạn trực quan.
                </p>
              </>
            ) : (
              <EmailEditor value={body} onChange={v => setValue('body', v, { shouldValidate: true })} variables={active.variables} />
            )}
          </div>

          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <AlertTriangle size={15} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600 dark:text-red-400 font-medium leading-relaxed">
                Thiếu biến bắt buộc: <b className="font-mono">{missingRequired.map(v => `{{${v}}}`).join(', ')}</b>.
                Không có biến này email sẽ vô dụng với người nhận nên hệ thống sẽ từ chối lưu.
              </p>
            </div>
          )}

          {/* Hành động */}
          <div id="tour-email-actions" className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
              className="flex items-center gap-2 px-5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
            >
              {previewMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              Xem trước
            </button>
            <button
              onClick={() => resetMutation.mutate()}
              disabled={!active.customized || resetMutation.isPending}
              title={active.customized ? undefined : 'Template này đang dùng nội dung mặc định'}
              className="flex items-center gap-2 px-5 h-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} /> Khôi phục mặc định
            </button>
            <button
              onClick={handleSubmit(data => saveMutation.mutate(data))}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-6 h-11 rounded-2xl bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20 active:scale-95 ml-auto disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Lưu template
            </button>
          </div>

          {/* Xem trước — dựng trong iframe sandbox để HTML người dùng nhập
              không chạm được vào trang cấu hình. */}
          {preview !== null && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bản xem trước</label>
                <button onClick={() => setPreview(null)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg">
                  <X size={14} />
                </button>
              </div>
              <iframe
                title="Xem trước email"
                sandbox=""
                srcDoc={preview}
                className="w-full h-[500px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
