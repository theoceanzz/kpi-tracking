import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  Coins,
  Info,
  Loader2,
  RotateCcw,
  Save,
  Timer,
  Webhook,
  X,
} from 'lucide-react'
import NumberInput from '@/components/common/NumberInput'
import LoadingSkeleton from '@/components/common/LoadingSkeleton'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { useWalletConfig } from '../hooks/useWallet'
import BankSelect from './BankSelect'
import { findBank } from '../constants/banks'
import { walletConfigSchema, type WalletConfigFormData } from '../schemas/walletConfigSchema'
import type { WalletConfig, WalletConfigRequest } from '../types'

const EMPTY: WalletConfigRequest = {
  pointExchangeRate: 1000,
  topupMinAmount: 10_000,
  topupMaxAmount: 50_000_000,
  topupExpireMinutes: 30,
  sepayAccountNumber: '',
  sepayBankCode: '',
  sepayAccountHolder: '',
}

const RATE_PRESETS = [500, 1_000, 2_000, 5_000]
/** Mốc điểm dùng để xem trước tỉ giá. Chọn thưa dần để thấy cả khoản nhỏ lẫn khoản lớn. */
const PREVIEW_POINTS = [10, 50, 100, 500]

const toForm = (c: WalletConfig): WalletConfigRequest => ({
  pointExchangeRate: c.pointExchangeRate,
  topupMinAmount: c.topupMinAmount,
  topupMaxAmount: c.topupMaxAmount,
  topupExpireMinutes: c.topupExpireMinutes,
  sepayAccountNumber: c.sepayAccountNumber ?? '',
  sepayBankCode: c.sepayBankCode ?? '',
  sepayAccountHolder: c.sepayAccountHolder ?? '',
})

const inputCls =
  'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'

function Card({
  id,
  icon,
  title,
  subtitle,
  children,
}: {
  /** Neo cho hướng dẫn — mỗi thẻ cấu hình là một bước riêng trong bài. */
  id?: string
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{title}</h3>
          {subtitle && (
            <p className="truncate text-xs text-[var(--color-muted-foreground)]">{subtitle}</p>
          )}
        </div>
      </header>
      <div className="p-6">{children}</div>
    </section>
  )
}

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
    <div className="min-w-0">
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      {children}
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{hint}</p>
      )}
    </div>
  )
}

/** Ô số có đơn vị dính bên phải. Chữ trong ô căn phải nên phải chừa chỗ bằng padding. */
function NumberField({
  value,
  onChange,
  suffix,
  maxDigits,
}: {
  value: number
  onChange: (v: number) => void
  suffix: string
  maxDigits?: number
}) {
  return (
    <div className="relative">
      <NumberInput
        value={value}
        onChange={onChange}
        maxDigits={maxDigits}
        className={`${inputCls} pr-14 text-right font-bold tabular-nums`}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted-foreground)]">
        {suffix}
      </span>
    </div>
  )
}

function ChecklistRow({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${
          done
            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
            : 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
        }`}
      >
        {done ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0">
        <div className={`text-sm font-medium ${done ? '' : 'text-[var(--color-muted-foreground)]'}`}>
          {label}
        </div>
        <div className="text-xs leading-relaxed text-[var(--color-muted-foreground)]">{hint}</div>
      </div>
    </li>
  )
}

export default function WalletConfigForm() {
  const { data, isLoading, updateConfig, isUpdating } = useWalletConfig()

  const { handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<WalletConfigFormData>({
    resolver: zodResolver(walletConfigSchema),
    defaultValues: EMPTY,
  })

  // Toàn bộ ô ở đây là NumberField / BankSelect tự vẽ, và bảng xem trước bên phải đọc
  // từng giá trị ngay khi gõ, nên theo dõi cả form thay vì đăng ký từng ô.
  const form = watch()

  useEffect(() => {
    if (data) reset(toForm(data))
  }, [data, reset])

  const dirty = useMemo(
    () => (data ? JSON.stringify(form) !== JSON.stringify(toForm(data)) : false),
    [form, data],
  )

  const rangeInvalid = form.topupMaxAmount < form.topupMinAmount
  const bankReady = !!form.sepayAccountNumber?.trim() && !!form.sepayBankCode?.trim()

  if (isLoading) return <LoadingSkeleton type="table" rows={4} />



  return (
    <div className="pb-24">
      {!data?.bankConfigured && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-5 py-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">Chưa nhận được tiền</p>
            <p className="mt-0.5 text-[var(--color-muted-foreground)]">
              Thiếu số tài khoản hoặc mã ngân hàng nên nhân viên chưa tạo được đơn nạp. Đây là hai
              trường bắt buộc để dựng mã VietQR.
            </p>
          </div>
        </div>
      )}

      {/* Điền xong tài khoản mà chưa giao dịch nào về là dấu hiệu điển hình của gõ
          nhầm số tài khoản, hoặc chưa liên kết bên SePay. Cả hai đều im lặng: nhân
          viên vẫn quét được QR, tiền vẫn đi, chỉ là không bao giờ được ghi có. */}
      {data?.bankConfigured && !data?.lastWebhookAt && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-5 py-4 text-sm">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-sky-600" />
          <div>
            <p className="font-semibold">Chưa nhận được giao dịch nào từ tài khoản này</p>
            <p className="mt-0.5 text-[var(--color-muted-foreground)]">
              Kiểm tra lại bên dashboard SePay: tài khoản{' '}
              <span className="font-mono">{data.sepayAccountNumber}</span> đã được liên kết chưa, và
              webhook đã trỏ về hệ thống chưa. Chuyển thử một khoản nhỏ là cách nhanh nhất để biết
              cả chuỗi đã thông.
            </p>
          </div>
        </div>
      )}

      {/* Hai cột trên màn hình rộng: cột trái là thứ phải điền, cột phải là thứ
          giúp điền đúng. Xếp dọc một cột hẹp sẽ bỏ trống nửa màn hình mà vẫn bắt
          người dùng cuộn. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card
            icon={<Coins size={18} />}
            id="tour-wallet-rate"
            title="Tỉ giá quy đổi"
            subtitle="Số tiền nhân viên phải bỏ ra cho mỗi điểm thưởng"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Số tiền đổi được 1 điểm"
                hint="Giao dịch đã thực hiện giữ nguyên tỉ giá cũ trong lịch sử, nên đổi con số này không làm sai số liệu quá khứ."
              >
                <NumberField
                  value={form.pointExchangeRate}
                  onChange={(v) => setValue('pointExchangeRate', v, { shouldValidate: true })}
                  suffix="đ"
                  maxDigits={9}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {RATE_PRESETS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setValue('pointExchangeRate', v, { shouldValidate: true })}
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                        form.pointExchangeRate === v
                          ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:border-[var(--color-primary)]'
                      }`}
                    >
                      {v.toLocaleString('vi-VN')}đ
                    </button>
                  ))}
                </div>
              </Field>

              {/* Con số tỉ giá đơn lẻ khó hình dung. Bảng quy đổi cho thấy ngay hệ
                  quả của nó lên các mức nhân viên hay đổi. */}
              <div className="rounded-2xl bg-[var(--color-muted)]/40 p-4">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
                  Nhân viên sẽ thấy
                </div>
                <ul className="space-y-1.5">
                  {PREVIEW_POINTS.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="w-20 flex-shrink-0 font-semibold tabular-nums">
                        {p.toLocaleString('vi-VN')} điểm
                      </span>
                      <ArrowRight size={13} className="flex-shrink-0 text-[var(--color-muted-foreground)]" />
                      <span className="truncate tabular-nums text-[var(--color-muted-foreground)]">
                        {formatCurrency(p * form.pointExchangeRate)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>

          <Card
            icon={<Timer size={18} />}
            id="tour-wallet-limits"
            title="Hạn mức nạp"
            subtitle="Giới hạn mỗi lần nạp và thời gian hiệu lực của mã QR"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Tối thiểu mỗi lần">
                <NumberField
                  value={form.topupMinAmount}
                  onChange={(v) => setValue('topupMinAmount', v, { shouldValidate: true })}
                  suffix="đ"
                />
              </Field>
              <Field label="Tối đa mỗi lần">
                <NumberField
                  value={form.topupMaxAmount}
                  onChange={(v) => setValue('topupMaxAmount', v, { shouldValidate: true })}
                  suffix="đ"
                />
              </Field>
              <Field label="Hiệu lực của đơn">
                <NumberField
                  value={form.topupExpireMinutes}
                  onChange={(v) => setValue('topupExpireMinutes', v, { shouldValidate: true })}
                  suffix="phút"
                  maxDigits={4}
                />
              </Field>
            </div>

            {rangeInvalid && (
              <p className="mt-4 rounded-xl bg-rose-500/10 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-400">
                Số tiền tối đa đang nhỏ hơn tối thiểu.
              </p>
            )}
            {(errors.pointExchangeRate || errors.topupMinAmount || errors.topupExpireMinutes) && (
              <p className="mt-2 text-xs text-rose-600">
                {errors.pointExchangeRate?.message
                  ?? errors.topupMinAmount?.message
                  ?? errors.topupExpireMinutes?.message}
              </p>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              Hết hạn chỉ để dọn màn hình của nhân viên. Tiền về sau khi đơn hết hạn vẫn được ghi có
              bình thường — hệ thống không bao giờ từ chối tiền đã vào tài khoản.
            </p>
          </Card>

          <Card
            icon={<Building2 size={18} />}
            id="tour-wallet-bank"
            title="Tài khoản nhận tiền"
            subtitle="Dùng để dựng mã VietQR và đối chiếu giao dịch"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Số tài khoản">
                <input
                  value={form.sepayAccountNumber ?? ''}
                  onChange={(e) => setValue('sepayAccountNumber', e.target.value, { shouldValidate: true })}
                  placeholder="0123456789"
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field
                label="Ngân hàng"
                hint="Chọn trong danh sách chuẩn VietQR — gõ tay dễ sai tên viết tắt khiến mã QR trỏ nhầm ngân hàng."
              >
                <BankSelect
                  value={form.sepayBankCode}
                  onChange={(code) => setValue('sepayBankCode', code, { shouldValidate: true })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tên chủ tài khoản">
                  <input
                    value={form.sepayAccountHolder ?? ''}
                    onChange={(e) => setValue('sepayAccountHolder', e.target.value, { shouldValidate: true })}
                    placeholder="CONG TY ABC"
                    className={`${inputCls} uppercase`}
                  />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
              Tình trạng thiết lập
            </h3>
            <ul className="space-y-3.5">
              <ChecklistRow
                done={!!data?.enableCashWallet}
                label="Đã bật tính năng ví tiền"
                hint="Bật ở trang Công ty, tab tính năng."
              />
              <ChecklistRow
                done={bankReady}
                label="Đã có tài khoản nhận tiền"
                hint="Thiếu thì nhân viên không tạo được đơn nạp."
              />
              {/* Ô duy nhất KHÔNG suy được từ dữ liệu trong KeyGo. Không có API nào của
                  SePay để hỏi xem tài khoản đã liên kết bên đó chưa, nên chỉ một giao
                  dịch về thật mới chứng minh được cả chuỗi webhook → khoá API → số tài
                  khoản đều đúng. */}
              <ChecklistRow
                done={!!data?.lastWebhookAt}
                label="Đã nhận giao dịch từ tài khoản này"
                hint={
                  data?.lastWebhookAt
                    ? `Gần nhất lúc ${formatDateTime(data.lastWebhookAt)}.`
                    : 'Chưa có giao dịch nào của tài khoản này về hệ thống. Nếu đã liên kết bên SePay mà ô này vẫn trống, nhiều khả năng số tài khoản gõ ở đây khác số đã liên kết.'
                }
              />
              <ChecklistRow
                done={form.pointExchangeRate > 0}
                label="Đã đặt tỉ giá quy đổi"
                hint={`Hiện ${formatCurrency(form.pointExchangeRate)} đổi được 1 điểm.`}
              />
            </ul>
          </section>

          {/* Cho người cấu hình thấy đúng thứ nhân viên sẽ nhìn, thay vì phải tự
              tạo một đơn nạp thật để kiểm tra mình gõ có đúng không. */}
          <section className="rounded-3xl border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 p-6">
            <h3 className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
              Nhân viên sẽ thấy
            </h3>
            <dl className="space-y-2.5 text-sm">
              {[
                {
                  label: 'Ngân hàng',
                  // Giá trị lưu có thể là mã BIN cũ; đổi về tên viết tắt cho dễ đối chiếu.
                  value: findBank(form.sepayBankCode)?.code ?? form.sepayBankCode?.trim(),
                  mono: false,
                },
                { label: 'Số tài khoản', value: form.sepayAccountNumber?.trim(), mono: true },
                { label: 'Chủ tài khoản', value: form.sepayAccountHolder?.trim(), mono: false },
                { label: 'Nội dung', value: 'NAPK7F3QA2X', mono: true },
              ].map(({ label, value, mono }) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <dt className="flex-shrink-0 text-[var(--color-muted-foreground)]">{label}</dt>
                  <dd
                    className={`truncate font-semibold ${mono ? 'font-mono' : ''} ${
                      value ? '' : 'text-[var(--color-muted-foreground)]'
                    }`}
                  >
                    {value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              Nội dung chuyển khoản là mã sinh riêng cho từng đơn, đây chỉ là ví dụ.
            </p>
          </section>

          <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Webhook size={16} className="text-[var(--color-muted-foreground)]" />
              <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--color-muted-foreground)]">
                Nối với SePay
              </h3>
            </div>
            <ol className="space-y-3">
              {[
                <>
                  Liên kết đúng tài khoản{' '}
                  <strong className="font-mono">{form.sepayAccountNumber?.trim() || '…'}</strong>{' '}
                  ở mục <strong>Ngân hàng</strong> trên dashboard SePay
                </>,
                <>
                  Trỏ webhook về <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-[11px]">/api/v1/webhooks/sepay</code>
                </>,
                <>
                  Đặt tiền tố mã đối soát là <strong>NAP</strong>
                </>,
                <>
                  Đặt khoá API vào biến môi trường{' '}
                  <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-[11px]">SEPAY_WEBHOOK_API_KEY</code>{' '}
                  của máy chủ
                </>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-xs leading-relaxed">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-[10px] font-black">
                    {i + 1}
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              Bước 1 chỉ làm được trên SePay, KeyGo không có API để tự liên kết hộ. Số tài khoản ở
              đây phải trùng số đã liên kết bên đó: lệch nhau thì mã QR trỏ vào một tài khoản SePay
              không theo dõi — tiền đi thật mà không giao dịch nào về hệ thống.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              Khoá API cố ý không cấu hình ở đây: nó nằm ở máy chủ nên không lọt vào giao diện hay
              nhật ký truy cập.
            </p>
          </section>
        </aside>
      </div>

      {/* Thanh lưu dính đáy: form dài hơn một màn hình, để nút ở cuối thì sửa ô đầu
          xong phải cuộn xuống cuối mới lưu được. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
            <div className="flex flex-shrink-0 gap-2">
              <button
                type="button"
                onClick={() => data && reset(toForm(data))}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)]"
              >
                <RotateCcw size={16} />
                Hoàn tác
              </button>
              <button
                type="button"
                onClick={handleSubmit(d => updateConfig(d as WalletConfigRequest))}
                disabled={isUpdating}
                className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              >
                {isUpdating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu cấu hình
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
