import { intlLocale } from '@/i18n/format'
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
  Receipt,
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
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'
import { useTranslation } from 'react-i18next'

const EMPTY: WalletConfigFormData = {
  pointExchangeRate: 1000,
  topupMinAmount: 10_000,
  topupMaxAmount: 50_000_000,
  topupExpireMinutes: 30,
  sepayAccountNumber: '',
  sepayBankCode: '',
  sepayAccountHolder: '',
  legalName: '',
  taxCode: '',
  businessAddress: '',
  contactPhone: '',
  receiptEnabled: true,
  receiptSeriesPrefix: 'PT',
  receiptVatRate: 0,
  receiptIssuerName: '',
  receiptIssuerTitle: '',
}

const RATE_PRESETS = [500, 1_000, 2_000, 5_000]
/** Mốc điểm dùng để xem trước tỉ giá. Chọn thưa dần để thấy cả khoản nhỏ lẫn khoản lớn. */
const PREVIEW_POINTS = [10, 50, 100, 500]

const toForm = (c: WalletConfig): WalletConfigFormData => ({
  pointExchangeRate: c.pointExchangeRate,
  topupMinAmount: c.topupMinAmount,
  topupMaxAmount: c.topupMaxAmount,
  topupExpireMinutes: c.topupExpireMinutes,
  sepayAccountNumber: c.sepayAccountNumber ?? '',
  sepayBankCode: c.sepayBankCode ?? '',
  sepayAccountHolder: c.sepayAccountHolder ?? '',
  legalName: c.legalName ?? '',
  taxCode: c.taxCode ?? '',
  businessAddress: c.businessAddress ?? '',
  contactPhone: c.contactPhone ?? '',
  receiptEnabled: c.receiptEnabled ?? true,
  receiptSeriesPrefix: c.receiptSeriesPrefix ?? 'PT',
  receiptVatRate: c.receiptVatRate ?? 0,
  receiptIssuerName: c.receiptIssuerName ?? '',
  receiptIssuerTitle: c.receiptIssuerTitle ?? '',
})

const inputCls =
  'w-full rounded-card border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2.5 text-sm outline-none transition-colors focus:border-[var(--color-primary)]'

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
    <section id={id} className="rounded-widget border border-[var(--color-border)] bg-[var(--color-card)]">
      <header className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-section-title">{title}</h3>
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
      <label className="text-label mb-1.5 block font-medium">{label}</label>
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
        className={`${inputCls} no-edit-hint pr-14 text-right font-semibold tabular-nums`}
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
            ? 'bg-[var(--color-success-bg)] text-[var(--color-success)] dark:bg-[var(--color-success-bg)] dark:text-[var(--color-success)]'
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
  const { t } = useTranslation('wallet')
  const { data, isLoading, updateConfig, isUpdating } = useWalletConfig()

  const { handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<WalletConfigFormData>({
    resolver: zodResolver(walletConfigSchema()),
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
        <div className="mb-6 flex items-start gap-3 rounded-card border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] px-5 py-4 text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-[var(--color-warning)]" />
          <div>
            <p className="font-semibold">{t('WalletConfigForm.moneyNotReceivedYet')}</p>
            <p className="mt-0.5 text-[var(--color-muted-foreground)]">
              {t('WalletConfigForm.theAccountNumberOrBankCode')}
            </p>
          </div>
        </div>
      )}

      {/* Điền xong tài khoản mà chưa giao dịch nào về là dấu hiệu điển hình của gõ
          nhầm số tài khoản, hoặc chưa liên kết bên SePay. Cả hai đều im lặng: nhân
          viên vẫn quét được QR, tiền vẫn đi, chỉ là không bao giờ được ghi có. */}
      {data?.bankConfigured && !data?.lastWebhookAt && (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-[var(--color-info-border)] bg-[var(--color-info-bg)] px-5 py-4 text-sm">
          <Info size={18} className="mt-0.5 flex-shrink-0 text-[var(--color-info)]" />
          <div>
            <p className="font-semibold">{t('WalletConfigForm.noTransactionsReceivedFromThisAccount')}</p>
            <p className="mt-0.5 text-[var(--color-muted-foreground)]">
              {t('WalletConfigForm.checkOnTheSepayDashboardWhether')}{' '}
              <span className="font-mono">{data.sepayAccountNumber}</span> {t('WalletConfigForm.hasBeenLinkedAndWhetherThe')}
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
            title={t('WalletConfigForm.exchangeRate')}
            subtitle={t('WalletConfigForm.theAmountEmployeesPayForEach')}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t('WalletConfigForm.amountFor1Point')}
                hint={t('WalletConfigForm.pastTransactionsKeepTheOldRate')}
              >
                <NumberField
                  value={form.pointExchangeRate}
                  onChange={(v) => setValue('pointExchangeRate', v, { shouldValidate: true })}
                  suffix={t('WalletConfigForm.pts')}
                  maxDigits={9}
                />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {RATE_PRESETS.map((v) => (
                    <ChoiceChip selected={form.pointExchangeRate === v} variant="solid" className="py-1" key={v} onClick={() => setValue('pointExchangeRate', v, { shouldValidate: true })}>
                      {v.toLocaleString(intlLocale())}{t('WalletConfigForm.pts')}
                    </ChoiceChip>
                  ))}
                </div>
              </Field>

              {/* Con số tỉ giá đơn lẻ khó hình dung. Bảng quy đổi cho thấy ngay hệ
                  quả của nó lên các mức nhân viên hay đổi. */}
              <div className="rounded-card bg-[var(--color-muted)]/40 p-4">
                <div className="mb-2 text-eyebrow">
                  {t('WalletConfigForm.employeesWillSee')}
                </div>
                <ul className="space-y-1.5">
                  {PREVIEW_POINTS.map((p) => (
                    <li key={p} className="flex items-center gap-2 text-sm">
                      <span className="w-20 flex-shrink-0 font-semibold tabular-nums">
                        {p.toLocaleString(intlLocale())} {t('WalletConfigForm.points')}
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
            title={t('WalletConfigForm.topUpLimits')}
            subtitle={t('WalletConfigForm.limitPerTopUpAndThe')}
          >
            <div className="grid gap-5 sm:grid-cols-3">
              <Field label={t('WalletConfigForm.minimumPerTopUp')}>
                <NumberField
                  value={form.topupMinAmount}
                  onChange={(v) => setValue('topupMinAmount', v, { shouldValidate: true })}
                  suffix={t('WalletConfigForm.pts')}
                />
              </Field>
              <Field label={t('WalletConfigForm.maximumPerTopUp')}>
                <NumberField
                  value={form.topupMaxAmount}
                  onChange={(v) => setValue('topupMaxAmount', v, { shouldValidate: true })}
                  suffix={t('WalletConfigForm.pts')}
                />
              </Field>
              <Field label={t('WalletConfigForm.orderValidity')}>
                <NumberField
                  value={form.topupExpireMinutes}
                  onChange={(v) => setValue('topupExpireMinutes', v, { shouldValidate: true })}
                  suffix={t('WalletConfigForm.minutes')}
                  maxDigits={4}
                />
              </Field>
            </div>

            {rangeInvalid && (
              <p className="mt-4 rounded-card bg-[var(--color-error-bg)] px-4 py-2.5 text-sm text-[var(--color-error)]">
                {t('WalletConfigForm.theMaximumAmountIsLessThan')}
              </p>
            )}
            {(errors.pointExchangeRate || errors.topupMinAmount || errors.topupExpireMinutes) && (
              <p className="mt-2 text-xs text-[var(--color-error)]">
                {errors.pointExchangeRate?.message
                  ?? errors.topupMinAmount?.message
                  ?? errors.topupExpireMinutes?.message}
              </p>
            )}

            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              <Info size={14} className="mt-0.5 flex-shrink-0" />
              {t('WalletConfigForm.expiryOnlyClearsTheEmployeesScreen')}
            </p>
          </Card>

          <Card
            icon={<Building2 size={18} />}
            id="tour-wallet-bank"
            title={t('WalletConfigForm.receivingAccount')}
            subtitle={t('WalletConfigForm.usedToBuildTheVietqrCode')}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('WalletConfigForm.accountNumber')}>
                <input
                  value={form.sepayAccountNumber ?? ''}
                  onChange={(e) => setValue('sepayAccountNumber', e.target.value, { shouldValidate: true })}
                  placeholder="0123456789"
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field
                label={t('WalletConfigForm.bank')}
                hint={t('WalletConfigForm.chooseFromTheStandardVietqrList')}
              >
                <BankSelect
                  value={form.sepayBankCode}
                  onChange={(code) => setValue('sepayBankCode', code, { shouldValidate: true })}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('WalletConfigForm.accountHolderName')}>
                  <input
                    value={form.sepayAccountHolder ?? ''}
                    onChange={(e) => setValue('sepayAccountHolder', e.target.value, { shouldValidate: true })}
                    placeholder="CONG TY ABC"
                    className={`${inputCls}`}
                  />
                </Field>
              </div>
            </div>
          </Card>

          <Card
            icon={<Receipt size={18} />}
            id="tour-wallet-receipt"
            title={t('WalletConfigForm.paymentReceipt')}
            subtitle={t('WalletConfigForm.documentsSentToEmployeesAfterEach')}
          >
            <label className="mb-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.receiptEnabled}
                onChange={(e) => setValue('receiptEnabled', e.target.checked, { shouldValidate: true })}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{t('WalletConfigForm.sendAReceiptForEachTop')}</span>
                <span className="block text-xs leading-relaxed text-[var(--color-muted-foreground)]">
                  {t('WalletConfigForm.turnOffIfTheUnitAlready')}
                </span>
              </span>
            </label>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label={t('WalletConfigForm.organizationNameOnDocuments')}
                hint={t('WalletConfigForm.theLegalEntityNamePerThe')}
              >
                <input
                  value={form.legalName ?? ''}
                  onChange={(e) => setValue('legalName', e.target.value, { shouldValidate: true })}
                  placeholder={t('WalletConfigForm.abcCompanyLimited')}
                  className={inputCls}
                />
              </Field>
              <Field label={t('WalletConfigForm.taxCode')}>
                <input
                  value={form.taxCode ?? ''}
                  onChange={(e) => setValue('taxCode', e.target.value, { shouldValidate: true })}
                  placeholder="0101234567"
                  className={`${inputCls} font-mono`}
                />
                {errors.taxCode && (
                  <p className="mt-1.5 text-xs text-[var(--color-error)]">{errors.taxCode.message}</p>
                )}
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('WalletConfigForm.organizationAddress')}>
                  <input
                    value={form.businessAddress ?? ''}
                    onChange={(e) => setValue('businessAddress', e.target.value, { shouldValidate: true })}
                    placeholder={t('WalletConfigForm.no1StreetAWardB')}
                    className={inputCls}
                  />
                  {errors.businessAddress && (
                    <p className="mt-1.5 text-xs text-[var(--color-error)]">{errors.businessAddress.message}</p>
                  )}
                </Field>
              </div>
              <Field label={t('WalletConfigForm.contactPhone')}>
                <input
                  value={form.contactPhone ?? ''}
                  onChange={(e) => setValue('contactPhone', e.target.value, { shouldValidate: true })}
                  placeholder="024 1234 5678"
                  className={inputCls}
                />
              </Field>
              <Field
                label={t('WalletConfigForm.taxRateAppliedToTopUps')}
                hint={t('WalletConfigForm.default0AWalletTopUp')}
              >
                <NumberField
                  value={form.receiptVatRate}
                  onChange={(v) => setValue('receiptVatRate', v, { shouldValidate: true })}
                  suffix="%"
                  maxDigits={3}
                />
              </Field>
              <Field
                label={t('WalletConfigForm.documentNumberPrefix')}
                hint={t('WalletConfigForm.theFullNumberIsThePrefix', { value: form.receiptSeriesPrefix || 'PT', getFullYear: new Date().getFullYear() })}
              >
                <input
                  value={form.receiptSeriesPrefix ?? ''}
                  onChange={(e) =>
                    setValue('receiptSeriesPrefix', e.target.value.toUpperCase(), { shouldValidate: true })
                  }
                  placeholder="PT"
                  maxLength={10}
                  className={`${inputCls} font-mono`}
                />
                {errors.receiptSeriesPrefix && (
                  <p className="mt-1.5 text-xs text-[var(--color-error)]">{errors.receiptSeriesPrefix.message}</p>
                )}
              </Field>
              <Field label={t('WalletConfigForm.personDepartmentIssuingDocuments')}>
                <input
                  value={form.receiptIssuerName ?? ''}
                  onChange={(e) => setValue('receiptIssuerName', e.target.value, { shouldValidate: true })}
                  placeholder={t('WalletConfigForm.accountingDepartment')}
                  className={inputCls}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label={t('WalletConfigForm.issuersTitle')}>
                  <input
                    value={form.receiptIssuerTitle ?? ''}
                    onChange={(e) => setValue('receiptIssuerTitle', e.target.value, { shouldValidate: true })}
                    placeholder={t('WalletConfigForm.chiefAccountant')}
                    className={inputCls}
                  />
                </Field>
              </div>
            </div>

            {/* Nói thẳng giới hạn pháp lý ngay tại chỗ cấu hình. Người bật tính năng này cần
                biết họ đang phát cái gì trước khi tờ đầu tiên rời khỏi hệ thống. */}
            <p className="mt-5 flex items-start gap-2 rounded-card bg-[var(--color-warning-bg)] px-4 py-3 text-xs leading-relaxed text-[var(--color-warning)]">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
              <span>
                {t('WalletConfigForm.thisIsA')} <strong>{t('WalletConfigForm.paymentReceipt2')}</strong> {t('WalletConfigForm.containingAllMandatoryContentUnderArticle')} <strong>{t('WalletConfigForm.notAVatInvoice')}</strong>{t('WalletConfigForm.eInvoicesWithATaxAuthority')}
              </span>
            </p>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-6 xl:self-start">
          <section className="rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h3 className="mb-4 text-eyebrow">
              {t('WalletConfigForm.setupStatus')}
            </h3>
            <ul className="space-y-3.5">
              <ChecklistRow
                done={!!data?.enableCashWallet}
                label={t('WalletConfigForm.walletFeatureTurnedOn')}
                hint={t('WalletConfigForm.turnOnInTheCompanyPage')}
              />
              <ChecklistRow
                done={bankReady}
                label={t('WalletConfigForm.receivingAccountSet')}
                hint={t('WalletConfigForm.withoutItEmployeesCannotCreateTop')}
              />
              {/* Ô duy nhất KHÔNG suy được từ dữ liệu trong KeyGo. Không có API nào của
                  SePay để hỏi xem tài khoản đã liên kết bên đó chưa, nên chỉ một giao
                  dịch về thật mới chứng minh được cả chuỗi webhook → khoá API → số tài
                  khoản đều đúng. */}
              <ChecklistRow
                done={!!data?.lastWebhookAt}
                label={t('WalletConfigForm.transactionsReceivedFromThisAccount')}
                hint={
                  data?.lastWebhookAt
                    ? t('WalletConfigForm.latestAt', { lastWebhookAt: formatDateTime(data.lastWebhookAt) })
                    : t('WalletConfigForm.noTransactionFromThisAccountHas')
                }
              />
              <ChecklistRow
                done={!form.receiptEnabled || (!!form.taxCode?.trim() && !!form.businessAddress?.trim())}
                label={t('WalletConfigForm.legalEntityProfileCompleteForIssuing')}
                hint={
                  form.receiptEnabled
                    ? t('WalletConfigForm.aTaxCodeAndOrganizationAddress')
                    : t('WalletConfigForm.receiptsAreOffSoThisIs')
                }
              />
              <ChecklistRow
                done={form.pointExchangeRate > 0}
                label={t('WalletConfigForm.exchangeRateSet')}
                hint={t('WalletConfigForm.currentlyConvertsTo1Point', { pointExchangeRate: formatCurrency(form.pointExchangeRate) })}
              />
            </ul>
          </section>

          {/* Cho người cấu hình thấy đúng thứ nhân viên sẽ nhìn, thay vì phải tự
              tạo một đơn nạp thật để kiểm tra mình gõ có đúng không. */}
          <section className="rounded-widget border border-dashed border-[var(--color-border)] bg-[var(--color-muted)]/20 p-6">
            <h3 className="mb-4 text-eyebrow">
              {t('WalletConfigForm.employeesWillSee')}
            </h3>
            <dl className="space-y-2.5 text-sm">
              {[
                {
                  label: t('WalletConfigForm.bank'),
                  // Giá trị lưu có thể là mã BIN cũ; đổi về tên viết tắt cho dễ đối chiếu.
                  value: findBank(form.sepayBankCode)?.code ?? form.sepayBankCode?.trim(),
                  mono: false,
                },
                { label: t('WalletConfigForm.accountNumber'), value: form.sepayAccountNumber?.trim(), mono: true },
                { label: t('WalletConfigForm.accountHolder'), value: form.sepayAccountHolder?.trim(), mono: false },
                { label: t('WalletConfigForm.description'), value: 'NAPK7F3QA2X', mono: true },
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
              {t('WalletConfigForm.theTransferDescriptionIsACode')}
            </p>
          </section>

          <section className="rounded-widget border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <div className="mb-4 flex items-center gap-2">
              <Webhook size={16} className="text-[var(--color-muted-foreground)]" />
              <h3 className="text-eyebrow">
                {t('WalletConfigForm.connectToSepay')}
              </h3>
            </div>
            <ol className="space-y-3">
              {[
                <>
                  {t('WalletConfigForm.linkExactlyTheAccount')}{' '}
                  <strong className="font-mono">{form.sepayAccountNumber?.trim() || '…'}</strong>{' '}
                  {t('WalletConfigForm.inTheSection')} <strong>{t('WalletConfigForm.bank')}</strong> {t('WalletConfigForm.onTheSepayDashboard')}
                </>,
                <>
                  {t('WalletConfigForm.pointTheWebhookTo')} <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs">/api/v1/webhooks/sepay</code>
                </>,
                <>
                  {t('WalletConfigForm.setTheReconciliationCodePrefixTo')} <strong>NAP</strong>
                </>,
                <>
                  {t('WalletConfigForm.putTheApiKeyInThe')}{' '}
                  <code className="rounded bg-[var(--color-muted)] px-1 py-0.5 text-xs">SEPAY_WEBHOOK_API_KEY</code>{' '}
                  {t('WalletConfigForm.ofTheServer')}
                </>,
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-xs leading-relaxed">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-muted)] text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span className="text-[var(--color-muted-foreground)]">{step}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {t('WalletConfigForm.step1CanOnlyBeDone')}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-[var(--color-muted-foreground)]">
              {t('WalletConfigForm.theApiKeyIsDeliberatelyNot')}
            </p>
          </section>
        </aside>
      </div>

      {/* Thanh lưu dính đáy: form dài hơn một màn hình, để nút ở cuối thì sửa ô đầu
          xong phải cuộn xuống cuối mới lưu được. */}
      {dirty && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-7xl items-center justify-end gap-3">
            <div className="flex flex-shrink-0 gap-2">
              <Button variant="outline" type="button" onClick={() => data && reset(toForm(data))}>
                <RotateCcw aria-hidden="true" />
                {t('WalletConfigForm.undo')}
              </Button>
              <Button type="button" onClick={handleSubmit(d => updateConfig(d as WalletConfigRequest))} disabled={isUpdating}>
                {isUpdating ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
                {t('WalletConfigForm.saveSettings')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
