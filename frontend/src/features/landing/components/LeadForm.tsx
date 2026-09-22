import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, CheckCircle2, Loader2, Mail, Phone, Send, ShieldCheck, User } from 'lucide-react'
import { toast } from 'sonner'
import axiosInstance from '@/lib/axios'
import { getApiErrorMessage } from '@/lib/apiError'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eyebrow, Headline, Reveal } from './primitives'

const HEADCOUNTS = [
  { value: '<50', label: 'Dưới 50 nhân sự' },
  { value: '50-200', label: '50 – 200 nhân sự' },
  { value: '200-500', label: '200 – 500 nhân sự' },
  { value: '>500', label: 'Trên 500 nhân sự' },
]

const schema = z.object({
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(120, 'Tối đa 120 ký tự'),
  phone: z
    .string()
    .trim()
    .regex(/^(\+84|0)[0-9\s.-]{8,14}$/, 'Số điện thoại không hợp lệ'),
  email: z.union([z.literal(''), z.string().trim().email('Email không hợp lệ').max(160)]),
  company: z.string().trim().max(200, 'Tối đa 200 ký tự'),
  headcount: z.string(),
  note: z.string().trim().max(1000, 'Tối đa 1000 ký tự'),
  // Bẫy bot: người thật không thấy ô này nên luôn rỗng
  website: z.string().max(200),
})
type FormValues = z.infer<typeof schema>

/** Form "Đăng ký tư vấn" cuối trang (như 1office): gửi về POST /public/leads, không cần đăng nhập. */
export function LeadForm() {
  const [sent, setSent] = useState(false)
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { fullName: '', phone: '', email: '', company: '', headcount: '', note: '', website: '' },
  })

  const onSubmit = async (values: FormValues) => {
    try {
      await axiosInstance.post('/public/leads', { ...values, source: 'landing' })
      setSent(true)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không gửi được, vui lòng gọi hotline 090 4871813'))
    }
  }

  return (
    <section id="contact" className="lp-section-alt relative scroll-mt-24 overflow-hidden border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-aurora left-[-5%] top-[10%] h-[420px] w-[700px] bg-blue-200 opacity-60" />
        <div className="lp-aurora right-[-5%] bottom-[0%] h-[360px] w-[560px] bg-sky-200 opacity-60" style={{ animationDelay: '-9s' }} />
      </div>

      <div className="mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-20">
        {/* Cột trái: lời mời + cam kết */}
        <div>
          <Reveal><Eyebrow>Đăng ký tư vấn · miễn phí</Eyebrow></Reveal>
          <Reveal delay={100}>
            <Headline className="mt-4">Bắt đầu kỳ đánh giá tới <em>với KeyGo</em>.</Headline>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
              Để lại thông tin, chuyên viên sẽ gọi lại trong 24 giờ làm việc để demo theo đúng quy trình
              đánh giá của doanh nghiệp bạn.
            </p>
          </Reveal>
          <ul className="mt-8 space-y-4">
            {[
              ['Demo 1:1 trên dữ liệu mẫu của ngành bạn', 'Không phải xem video chung chung'],
              ['Dùng thử 14 ngày, đủ module', 'Nhập cơ cấu từ Excel, chạy đợt đánh giá thật'],
              ['Không ràng buộc, không cần thẻ', 'Chỉ liên hệ đúng nhu cầu, không gọi làm phiền'],
            ].map(([t, d], i) => (
              <Reveal key={t} as="li" delay={300 + i * 90} from="left" className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-bold text-slate-900">{t}</span>
                  <span className="block text-sm text-slate-500">{d}</span>
                </span>
              </Reveal>
            ))}
          </ul>
          <Reveal delay={600} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold text-slate-700">
            <a href="tel:0904871813" className="inline-flex items-center gap-2 hover:text-blue-700">
              <Phone className="h-4 w-4 text-emerald-600" /> Hotline 090 4871813
            </a>
            <a href="https://zalo.me/0904871813" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-blue-700">
              <Mail className="h-4 w-4 text-blue-600" /> Chat Zalo
            </a>
          </Reveal>
        </div>

        {/* Cột phải: form */}
        <Reveal from="right" delay={150}>
          <div className="relative rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-24px_rgba(30,64,175,0.25)] sm:p-8">
            <div className="lp-border-glow" aria-hidden />
            {sent ? (
              <SentPanel />
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Đăng ký tư vấn & dùng thử</h3>
                  <p className="mt-1 text-sm text-slate-500">Điền 2 trường bắt buộc là đủ, còn lại giúp chúng tôi chuẩn bị demo sát hơn.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Họ và tên" required error={errors.fullName?.message}>
                    <Input size="lg" prefix={<User className="h-4 w-4" />} placeholder="Nguyễn Văn A" autoComplete="name" invalid={!!errors.fullName} {...register('fullName')} />
                  </Field>
                  <Field label="Số điện thoại" required error={errors.phone?.message}>
                    <Input size="lg" type="tel" prefix={<Phone className="h-4 w-4" />} placeholder="0904 xxx xxx" autoComplete="tel" invalid={!!errors.phone} {...register('phone')} />
                  </Field>
                  <Field label="Email công việc" error={errors.email?.message}>
                    <Input size="lg" type="email" prefix={<Mail className="h-4 w-4" />} placeholder="ban@congty.vn" autoComplete="email" invalid={!!errors.email} {...register('email')} />
                  </Field>
                  <Field label="Tên công ty" error={errors.company?.message}>
                    <Input size="lg" prefix={<Building2 className="h-4 w-4" />} placeholder="Công ty ABC" autoComplete="organization" invalid={!!errors.company} {...register('company')} />
                  </Field>
                </div>

                <Field label="Quy mô nhân sự">
                  <Controller
                    control={control}
                    name="headcount"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Chọn quy mô" />
                        </SelectTrigger>
                        <SelectContent>
                          {HEADCOUNTS.map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field label="Bạn đang cần gì?" error={errors.note?.message}>
                  <Textarea rows={3} placeholder="VD: Đang chấm KPI bằng Excel, muốn chuyển sang đánh giá theo đợt có minh chứng…" invalid={!!errors.note} {...register('note')} />
                </Field>

                {/* Honeypot: ẩn khỏi người thật (không dùng display:none để bot khỏi nhận ra) */}
                <div className="absolute -left-[9999px] top-0 h-px w-px overflow-hidden" aria-hidden>
                  <label htmlFor="lead-website">Website</label>
                  <input id="lead-website" type="text" tabIndex={-1} autoComplete="off" {...register('website')} />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    'lp-sheen relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-3.5 text-base font-bold text-white',
                    'bg-gradient-to-r from-blue-600 via-sky-500 to-blue-600 bg-[length:200%_auto] shadow-lg shadow-blue-500/30 transition-all hover:bg-right hover:shadow-blue-500/50 active:scale-[0.99] disabled:opacity-70',
                  )}
                >
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  {isSubmitting ? 'Đang gửi…' : 'Đăng ký tư vấn miễn phí'}
                </button>
                <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-500">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Thông tin chỉ dùng để liên hệ tư vấn, không chia sẻ cho bên thứ ba.
                </p>
              </form>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  )
}

function SentPanel() {
  return (
    <div className="lp-pop flex flex-col items-center py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-2xl font-black text-slate-900">Đã nhận đăng ký!</h3>
      <p className="mt-2 max-w-sm text-slate-600">
        Chuyên viên KeyGo sẽ gọi lại trong 24 giờ làm việc. Cần gấp hơn, gọi thẳng hotline bên dưới.
      </p>
      <a href="tel:0904871813" className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 font-bold text-white shadow-lg shadow-emerald-500/30 hover:bg-emerald-600">
        <Phone className="h-4 w-4" /> 090 4871813
      </a>
    </div>
  )
}
