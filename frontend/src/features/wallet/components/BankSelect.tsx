import { useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { VIETQR_BANKS, bankLogoUrl, findBank, type BankOption } from '../constants/banks'

/** Bỏ dấu để gõ "vietcom" hay "kỹ thương" đều ra kết quả. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

/** Logo tải từ CDN của VietQR; hỏng mạng hay sai mã thì rơi về chữ cái đầu. */
function BankLogo({ bank, size = 28 }: { bank?: BankOption; size?: number }) {
  const [failed, setFailed] = useState(false)

  if (!bank || failed) {
    return (
      <span
        className="flex flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[10px] font-black text-[var(--color-muted-foreground)]"
        style={{ width: size, height: size }}
      >
        {(bank?.code ?? '?').slice(0, 2).toUpperCase()}
      </span>
    )
  }

  return (
    <img
      src={bankLogoUrl(bank.id)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="flex-shrink-0 rounded-lg border border-[var(--color-border)] bg-white object-contain p-0.5"
      style={{ width: size, height: size }}
    />
  )
}

interface Props {
  value?: string | null
  onChange: (code: string) => void
  className?: string
}

export default function BankSelect({ value, onChange, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = findBank(value)
  /** Giá trị cũ gõ tay không khớp danh sách: vẫn hiện ra để người dùng biết mình đang lưu gì. */
  const unknown = !selected && !!value?.trim()

  const results = useMemo(() => {
    const q = norm(query.trim())
    if (!q) return VIETQR_BANKS
    return VIETQR_BANKS.filter(
      (b) => norm(b.code).includes(q) || norm(b.name).includes(q) || b.bin.includes(q),
    )
  }, [query])

  const pick = (code: string) => {
    onChange(code)
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm outline-none transition-colors ${
            unknown
              ? 'border-amber-500/60 bg-amber-500/5'
              : 'border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]'
          } ${open ? 'border-[var(--color-primary)]' : ''} ${className}`}
        >
          <BankLogo key={selected?.id ?? 'none'} bank={selected} />
          <span className="min-w-0 flex-1">
            {selected ? (
              <>
                <span className="block truncate font-semibold">{selected.code}</span>
                <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                  {selected.name}
                </span>
              </>
            ) : unknown ? (
              <>
                <span className="block truncate font-semibold">{value}</span>
                <span className="block truncate text-xs text-amber-600">
                  Không có trong danh sách VietQR — chọn lại cho chắc
                </span>
              </>
            ) : (
              <span className="block truncate text-[var(--color-muted-foreground)]">
                Chọn ngân hàng
              </span>
            )}
          </span>
          <ChevronDown
            size={16}
            className={`flex-shrink-0 text-[var(--color-muted-foreground)] transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden rounded-2xl border-[var(--color-border)] bg-[var(--color-card)] p-0 text-[var(--color-foreground)]"
      >
        <div className="relative border-b border-[var(--color-border)]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          />
          <input
            ref={searchRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc mã BIN..."
            className="w-full bg-transparent py-3 pl-10 pr-9 text-sm outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                searchRef.current?.focus()
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              Không tìm thấy ngân hàng nào.
            </p>
          ) : (
            results.map((b) => {
              const active = selected?.code === b.code
              return (
                <button
                  key={b.code}
                  type="button"
                  onClick={() => pick(b.code)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    active ? 'bg-[var(--color-primary)]/10' : 'hover:bg-[var(--color-muted)]'
                  }`}
                >
                  <BankLogo key={b.id} bank={b} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{b.code}</span>
                    <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                      {b.name}
                    </span>
                  </span>
                  <span className="flex-shrink-0 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                    {b.bin}
                  </span>
                  {active && (
                    <Check size={14} className="flex-shrink-0 text-[var(--color-primary)]" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
