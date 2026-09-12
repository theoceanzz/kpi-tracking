import { useState, useRef } from 'react'
import { useThemeStore, THEME_COLORS, isVioletLike } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { Sun, Moon, Palette, Check, Pipette, Info } from 'lucide-react'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { Button } from '@/components/ui/button'
import { ChoiceChip } from '@/components/ui/choice-chip'

export default function ThemeCustomizer() {
  const { isDark, setDark, primaryColor, setPrimaryColor } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(containerRef, () => setIsOpen(false))

  const isPreset = THEME_COLORS.some(c => c.value.toLowerCase() === primaryColor.toLowerCase())

  return (
    <div className="relative" ref={containerRef}>
      <Button variant="secondary" size="icon" type="button" onClick={() => setIsOpen(!isOpen)} aria-label="Tùy chỉnh giao diện" aria-expanded={isOpen} aria-haspopup="dialog" title="Tùy chỉnh giao diện">
        <Palette aria-hidden="true" />
      </Button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Tùy chỉnh giao diện"
          className="absolute right-0 top-11 z-50 w-72 rounded-card border border-[var(--color-border)] bg-[var(--color-popover)] p-4 shadow-lg animate-in fade-in-0 motion-reduce:animate-none"
        >
          <div className="space-y-5">
            {/* Chế độ sáng / tối */}
            <div className="space-y-2">
              <p className="text-eyebrow">Chế độ</p>
              <div className="grid grid-cols-2 gap-1 rounded-control bg-[var(--color-muted)] p-1">
                {([
                  { dark: false, label: 'Sáng', Icon: Sun },
                  { dark: true, label: 'Tối', Icon: Moon },
                ] as const).map(({ dark, label, Icon }) => {
                  const active = isDark === dark
                  return (
                  <ChoiceChip selected={active} variant="segment" key={label} onClick={() => setDark(dark)} aria-pressed={active}>
                      <Icon /> {label}
                  </ChoiceChip>
                  )
                })}
                </div>
              </div>

            {/* Màu chủ đạo */}
            <div className="space-y-2">
              <p className="text-eyebrow">Màu chủ đạo</p>
              <div className="grid grid-cols-8 gap-1">
                {THEME_COLORS.map((color) => {
                  const active = primaryColor.toLowerCase() === color.value.toLowerCase()
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setPrimaryColor(color.value)}
                      aria-label={color.name}
                      aria-pressed={active}
                      title={color.name}
                      className={cn(
                        'h-7 w-7 rounded-control flex items-center justify-center border-2 transition-colors',
                        active ? 'border-[var(--color-foreground)]' : 'border-transparent hover:border-[var(--color-border-strong)]'
                      )}
                      style={{ backgroundColor: isDark ? color.dark.primary : color.light.primary }}
                    >
                      {active && <Check size={14} style={{ color: isDark ? color.dark.foreground : color.light.foreground }} />}
                    </button>
                  )
                })}
              </div>

              {/* Màu tự chọn */}
              <label className="text-label relative mt-2 flex h-9 items-center gap-2 rounded-control border border-[var(--color-input)] bg-[var(--color-card)] px-3 text-[var(--color-muted-foreground)] focus-within:border-[var(--color-ring)] focus-within:ring-2 focus-within:ring-[var(--color-ring)]">
                <Pipette size={14} aria-hidden="true" />
                <span className="flex-1">{isPreset ? 'Màu tùy chỉnh' : primaryColor.toUpperCase()}</span>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 rounded-sm border border-[var(--color-border)]"
                  style={{ backgroundColor: primaryColor }}
                />
                <input
                  type="color"
                  aria-label="Chọn màu tùy chỉnh"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
              </label>

              {/* Dải tím trùng với nhận diện của K.AI: báo cho người dùng biết vì sao
                  khu vực trợ lý đổi sang màu lam. Với màu tự chọn quá nhạt, chữ trên
                  nút sẽ tự chuyển sang tối để còn đọc được. */}
              {isVioletLike(primaryColor) && (
                <p className="flex items-start gap-1.5 text-caption">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Màu tím trùng với nhận diện của K.AI, nên khu vực trợ lý sẽ dùng màu lam để phân biệt.
                </p>
              )}
                </div>
              </div>

          <p className="mt-4 border-t border-[var(--color-border)] pt-3 text-caption">
            Thiết lập được lưu trên trình duyệt này.
              </p>
          </div>
      )}
    </div>
  )
}
