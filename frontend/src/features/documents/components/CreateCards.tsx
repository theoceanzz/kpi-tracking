import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bot, ChevronDown, CloudUpload, FilePlus2 } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useAiAvailable } from '@/features/analytics/hooks/useAiAvailable'
import { tourAnchor } from '@/components/common/tours/anchors'
import { FileTypeIcon, FolderIcon } from './docUi'

interface Props {
  /** Menu "Mới" do trang giữ (bài hướng dẫn mở / đóng được). */
  menuOpen: boolean
  onMenuOpenChange: (open: boolean) => void
  canCreate: boolean
  onNewDoc: (kind: 'doc' | 'sheet') => void
  onNewFolder: () => void
  onUpload: () => void
}

/**
 * Hàng thẻ to đầu Trang chủ và Drive như Lark (docs/DOCUMENTS_LARK_REFERENCE.md §2): "Mới ▾" (Tài liệu, Bảng tính — vạch —
 * Thư mục), "Tải lên", và ở chỗ "Templates" của Lark là "Hỏi K.AI" (KeyGo chưa có thư viện mẫu). Tạo ở đâu là việc của
 * trang: đang đứng trong một kho / thư mục thì tạo ngay tại đó.
 */
export default function CreateCards({ menuOpen, onMenuOpenChange, canCreate, onNewDoc, onNewFolder, onUpload }: Props) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const aiAvailable = useAiAvailable()
  const pick = (run: () => void) => () => { onMenuOpenChange(false); run() }

  return (
    <div className={aiAvailable ? 'grid grid-cols-3 gap-2 sm:gap-3' : 'grid grid-cols-2 gap-2 sm:gap-3'}>
      <Popover open={menuOpen} onOpenChange={onMenuOpenChange}>
        <PopoverTrigger asChild>
          <Card {...tourAnchor('docs.new')} icon={<FilePlus2 className="text-[var(--color-primary)]" />} title={t('home.cardCreate')}
                hint={t('home.cardCreateHint')} disabled={!canCreate} aria-haspopup="menu" chevron />
        </PopoverTrigger>
        <PopoverContent {...tourAnchor('docs.new.menu')} align="start" className="w-64 p-1.5" role="menu">
          <MenuItem icon={<FileTypeIcon doc={{ fileName: 'x.kgdoc', contentType: null }} size={13} />} label={t('newMenu.doc')} onClick={pick(() => onNewDoc('doc'))} />
          <MenuItem icon={<FileTypeIcon doc={{ fileName: 'x.kgsheet', contentType: null }} size={13} />} label={t('newMenu.sheet')} onClick={pick(() => onNewDoc('sheet'))} />
          <div className="my-1 h-px bg-[var(--color-border)]" role="separator" />
          <MenuItem icon={<FolderIcon size={20} />} label={t('newMenu.folder')} onClick={pick(onNewFolder)} />
        </PopoverContent>
      </Popover>
      <Card icon={<CloudUpload className="text-[var(--color-warning)]" />} title={t('home.cardUpload')} hint={t('home.cardUploadHint')}
            onClick={onUpload} disabled={!canCreate} />
      {aiAvailable && (
        <Card icon={<Bot className="text-[var(--color-ai)]" />} title={t('home.cardAsk')} hint={t('home.cardAskHint')} onClick={() => navigate('/ai-assistant')} />
      )}
    </div>
  )
}

type CardProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon: ReactNode; title: string; hint: string; chevron?: boolean }

/** Thẻ thao tác to; nhận ref + props để làm nút mở menu (PopoverTrigger asChild). */
const Card = forwardRef<HTMLButtonElement, CardProps>(function Card({ icon, title, hint, chevron, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className="flex min-w-0 items-center gap-2 rounded-card border border-[var(--color-border)] bg-[var(--color-card)] px-3 py-3 text-left sm:gap-3 sm:px-4 sm:py-3.5 transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="shrink-0 [&_svg]:size-6 sm:[&_svg]:size-7" aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--color-foreground)] sm:text-[15px]">{title}</span>
        <span className="hidden truncate text-caption sm:block">{hint}</span>
      </span>
      {chevron && <ChevronDown size={16} className="hidden shrink-0 text-[var(--color-muted-foreground)] sm:block" aria-hidden="true" />}
    </button>
  )
})

function MenuItem({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick}
            className="flex h-9 w-full items-center gap-3 rounded-control px-2.5 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:bg-[var(--color-muted)] focus-visible:outline-none">
      <span className="flex w-5 justify-center">{icon}</span>{label}
    </button>
  )
}
