import { useEffect, useMemo, useState } from 'react'
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
import { formatCurrency } from '@/lib/utils'
import { useWalletConfig } from '../hooks/useWallet'
import BankSelect from './BankSelect'
import { findBank } from '../constants/banks'
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
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-3xl border border-[var(--color-border)] bg-[var(--color-card)]">
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
  const [form, setForm] = useState<WalletConfigRequest>(EMPTY)

  useEffect(() => {
    if (data) setForm(toForm(data))
  }, [data])

  const dirty = useMemo(
    () => (data ? JSON.stringify(form) !== JSON.stringify(toForm(data)) : false),
    [form, data],
  )

  const rangeInvalid = form.topupMaxAmount < form.topupMinAmount
  const bankReady = !!form.sepayAccountNumber?.trim() && !!form.sepayBankCode?.trim()

  if (isLoading) return <LoadingSkeleton type="table" rows={4} />

  const set = <K extends keyof WalletConfigRequest>(k: K, v: WalletConfigRequest[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

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

      {/* Hai cột trên màn hình rộng: cột trái là thứ phải điền, cột phải là thứ
          giúp điền đúng. Xếp dọc một cột hẹp sẽ bỏ trống nửa màn hình mà vẫn bắt
          người dùng cuộn. */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card
            icon={<Coins size={18} />}
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
                  onChange={(v) => set('pointExchangeRate', v)}
                  suffix="đ"
                  maxDigits={9}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {RATE_PRESETS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set('pointExchangeRate', v)}
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
            title="Hạn mức nạp"
            subtitle="Giới hạn mỗi lần nạp và thời gian hiệu lực của mã QR"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Tối thiểu mỗi lần">
                <NumberField
                  value={form.topupMinAmount}
                  onChange={(v) => set('topupMinAmount', v)}
                  suffix="đ"
                />
              </Field>
              <Field label="Tối đa mỗi lần">
                <NumberField
                  value={form.topupMaxAmount}
                  onChange={(v) => set('topupMaxAmount', v)}
                  suffix="đ"
                />
              </Field>
              <Field label="Hiệu lực của đơn">
                <NumberField
                  value={form.topupExpireMinutes}
                  onChange={(v) => set('topupExpireMinutes', v)}
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

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              Hết hạn chỉ để dọn màn hình của nhân viên. Tiền về sau khi đơn hết hạn vẫn được ghi có
              bình thường — hệ thống không bao giờ từ chối tiền đã vào tài khoản.
            </p>
          </Card>

          <Card
            icon={<Building2 size={18} />}
            title="Tài khoản nhận tiền"
            subtitle="Dùng để dựng mã VietQR và đối chiếu giao dịch"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Số tài khoản">
                <input
                  value={form.sepayAccountNumber ?? ''}
                  onChange={(e) => set('sepayAccountNumber', e.target.value)}
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
                  onChange={(code) => set('sepayBankCode', code)}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Tên chủ tài khoản">
                  <input
                    value={form.sepayAccountHolder ?? ''}
                    onChange={(e) => set('sepayAccountHolder', e.target.value)}
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
                onClick={() => data && setForm(toForm(data))}
                className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--color-muted)]"
              >
                <RotateCcw size={16} />
                Hoàn tác
              </button>
              <button
                type="button"
                onClick={() => updateConfig(form)}
                disabled={isUpdating || rangeInvalid}
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
