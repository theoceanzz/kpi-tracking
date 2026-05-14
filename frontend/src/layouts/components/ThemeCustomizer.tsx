import { useState, useRef } from 'react'
import { useThemeStore, THEME_COLORS } from '@/store/themeStore'
import { cn } from '@/lib/utils'
import { Sun, Moon, Palette, Check, Pipette } from 'lucide-react'
import { useOnClickOutside } from '@/hooks/useOnClickOutside'


export default function ThemeCustomizer() {
  const { isDark, setDark, primaryColor, setPrimaryColor } = useThemeStore()
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useOnClickOutside(containerRef, () => setIsOpen(false))

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[var(--color-accent)] transition-all active:scale-95"
        title="Tùy chỉnh giao diện"
      >
        <Palette size={18} className="text-[var(--color-primary)]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-72 bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl border border-slate-200 dark:border-slate-800 p-6 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="space-y-6">
              {/* Theme Mode */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Giao diện</p>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setDark(false)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                      !isDark ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Sun size={14} /> Sáng
                  </button>
                  <button
                    onClick={() => setDark(true)}
                    className={cn(
                      "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
                      isDark ? "bg-white dark:bg-slate-700 text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    <Moon size={14} /> Tối
                  </button>
                </div>
              </div>

              {/* Primary Color */}
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Màu chủ đạo</p>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={cn(
                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 border-2",
                        primaryColor === color.value ? "border-slate-900 dark:border-white" : "border-transparent"
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    >
                      {primaryColor === color.value && <Check size={16} className="text-white drop-shadow-md" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Color */}
              <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Màu tùy chỉnh</p>
                  <div className="w-5 h-5 rounded-full border border-slate-200 dark:border-slate-700 shadow-inner" style={{ backgroundColor: primaryColor }} />
                </div>
                <div className="relative group">
                  <Pipette size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-indigo-600" />
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-full h-10 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 cursor-pointer focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all pl-9"
                  />
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[9px] text-center text-slate-400 font-medium leading-relaxed">
                Các thiết lập sẽ được lưu tự động cho tài khoản của bạn.
              </p>
            </div>
          </div>
      )}
    </div>
  )
}
