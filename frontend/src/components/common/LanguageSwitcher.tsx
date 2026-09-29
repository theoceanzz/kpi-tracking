import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { chooseLanguage } from '@/i18n/languageSync'
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES, isSupportedLanguage } from '@/i18n/languages'
import { useLanguageStore } from '@/store/languageStore'
import { cn } from '@/lib/utils'
import FlagIcon from './FlagIcon'

/**
 * Ô chọn ngôn ngữ: nút hiện cờ + mã (VI / EN) cho gọn, danh sách thả xuống hiện cờ + tên đầy đủ. Đặt ở
 * header (đã đăng nhập), trang đăng nhập / đăng ký và trang giới thiệu. Tên ngôn ngữ luôn viết bằng chính ngôn ngữ đó nên không dịch. Lưu theo tài khoản: xem
 * `i18n/languageSync.ts`.
 */
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { t } = useTranslation()
  const language = useLanguageStore((s) => s.language)

  return (
    <Select
      value={language}
      onValueChange={(value) => {
        if (isSupportedLanguage(value) && value !== language) chooseLanguage(value)
      }}
    >
      <SelectTrigger
        aria-label={t('language.label')}
        title={t('language.label')}
        className={cn(
          'h-8 w-auto gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-2.5 text-sm font-medium shadow-none',
          'transition-colors hover:bg-[var(--color-muted)]',
          className,
        )}
      >
        <span className="flex items-center gap-2">
          <FlagIcon language={language} />
          <span className="uppercase tracking-wide">{language}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[10rem]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SelectItem key={lang} value={lang} lang={lang}>
            <span className="flex items-center gap-2.5">
              <FlagIcon language={lang} />
              <span>{LANGUAGE_NAMES[lang]}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
