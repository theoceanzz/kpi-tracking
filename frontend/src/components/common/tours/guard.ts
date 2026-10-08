import i18n from 'i18next'
import { toast } from 'sonner'
import { isTourRunning } from '@/store/tourStore'

/**
 * Chốt chặn cuối của mọi form được hướng dẫn: đang có bài chạy thì KHÔNG gửi, chỉ báo một dòng.
 * Bước "nút Lưu" vốn chặn bấm, nhưng Enter trong một ô vẫn gửi form — nên onSubmit phải tự hỏi:
 *
 *   const onSubmit = (data) => { if (blockedByTour()) return; … }
 */
export function blockedByTour(): boolean {
  if (!isTourRunning()) return false
  toast.info(i18n.t('shared:TourHost.noSubmit'))
  return true
}
