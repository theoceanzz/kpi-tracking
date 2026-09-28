import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import i18n from 'i18next'

/**
 * Bọc một nút/khối bị khoá để hiện tooltip giải thích. Nút disabled không nhận sự kiện chuột, nên
 * tooltip gắn vào thẻ span bọc ngoài (có tabIndex để bàn phím cũng mở được).
 */
export function LockedHint({ reason, children, className }: { reason: string | null; children: ReactNode; className?: string }) {
  if (!reason) return <>{children}</>
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={cn('inline-flex cursor-not-allowed', className)} aria-label={reason}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/** Badge "Đã khoá" kèm tooltip lý do. */
export function LockedBadge({ reason, label = i18n.t('kpi:CycleLockHint.locked') }: { reason: string; label?: string }) {
  return (
    <LockedHint reason={reason} className="cursor-help">
      <Badge variant="warning"><Lock className="size-3" aria-hidden="true" />{label}</Badge>
    </LockedHint>
  )
}
