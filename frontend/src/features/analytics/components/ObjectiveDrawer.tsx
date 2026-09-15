import { Target, TrendingUp } from 'lucide-react'
import React from 'react'
import { Drawer } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

interface DrawerProps {
  isOpen: boolean
  onClose: () => void
  title: React.ReactNode
  /** Indicates whether the drawer is showing an Objective, a Key Result or a KPI. */
  type?: 'OBJECTIVE' | 'KR' | 'KPI'
  children: React.ReactNode
}

/**
 * Bảng trượt bên phải cho chi tiết Mục tiêu / Key Result / KPI, mở từ widget trang chủ.
 *
 * Dùng khung `Drawer` chuẩn (UX_PATTERNS.md §P0): portal ra body (ô react-grid-layout có
 * `transform` nên `position: fixed` bên trong sẽ bị căn theo ô), khoá cuộn, Esc/bấm nền
 * để đóng, bẫy focus. Chiều rộng 60vw ở màn rộng, toàn màn ở mobile.
 */
export default function ObjectiveDrawer({
  isOpen,
  onClose,
  title,
  type,
  children,
}: DrawerProps) {
  const typeBadge =
    type === 'OBJECTIVE' ? (
      <Badge variant="secondary"><Target size={10} aria-hidden="true" /> Mục tiêu</Badge>
    ) : type === 'KR' ? (
      <Badge variant="secondary"><TrendingUp size={10} aria-hidden="true" /> Key Result</Badge>
    ) : type === 'KPI' ? (
      <Badge variant="info"><TrendingUp size={10} aria-hidden="true" /> KPI</Badge>
    ) : null

  return (
    <Drawer
      open={isOpen}
      onClose={onClose}
      size="full"
      className="md:w-[60vw]"
      title={title}
      headerExtra={typeBadge}
    >
      {children}
    </Drawer>
  )
}
