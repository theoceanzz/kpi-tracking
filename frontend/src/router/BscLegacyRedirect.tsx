import { usePermission } from '@/hooks/usePermission'
import RedirectToSection from './RedirectToSection'

/**
 * Link cũ của BSC (`/bsc`, `/bsc/dashboard`, `/bsc/strategy-map`) còn nằm trong email, bookmark.
 *
 * Người quản lý BSC về mục Quản lý BSC như trước; người chỉ có quyền xem (nhân viên, phó đơn vị) về
 * "BSC của tôi" — đưa họ vào trang thiết lập công cụ thì chỉ gặp trang 403.
 */
export default function BscLegacyRedirect() {
  const { hasPermission } = usePermission()
  const canManage = hasPermission('BSC:MANAGE') || hasPermission('BSC:MANAGE_UNIT')
  return canManage
    ? <RedirectToSection to="/settings/tools" params={{ section: 'bsc' }} />
    : <RedirectToSection to="/me" params={{ section: 'my-bsc' }} />
}
