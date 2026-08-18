import { useState } from 'react'
import { cn, getInitials } from '@/lib/utils'

interface UserAvatarProps {
  fullName?: string | null
  avatarUrl?: string | null
  /** Lớp kích thước/bo góc dùng chung cho cả ảnh lẫn vòng chữ cái, để hai trạng thái không nhảy kích cỡ. */
  className?: string
  /** Lớp riêng cho vòng chữ cái: màu nền, màu chữ, viền. Không ảnh hưởng khi có ảnh. */
  fallbackClassName?: string
}

/**
 * Ảnh đại diện của một người, tự lùi về vòng chữ cái khi không có ảnh.
 *
 * <p>Có component này vì trước đó mỗi màn hình tự vẽ lấy một vòng chữ cái, và phần lớn
 * KHÔNG bao giờ đọc tới {@code avatarUrl} — nên người dùng đổi ảnh xong vẫn thấy chữ cái
 * ở khắp nơi và tưởng hệ thống chưa lưu. Chỗ nào hiện mặt người thì dùng cái này, đừng
 * viết lại vòng chữ cái nữa.
 */
export default function UserAvatar({
  fullName,
  avatarUrl,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  // Link Cloudinary hỏng hoặc ảnh bị xoá sẽ ra ô ảnh vỡ — xấu hơn hẳn vòng chữ cái.
  // Nhớ ĐÚNG url đã hỏng chứ không phải một cờ true/false: người dùng vừa đổi ảnh xong
  // thì phải được thử lại ảnh mới, chứ không dính luôn kết quả hỏng của ảnh cũ.
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null)

  if (avatarUrl && brokenUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={fullName ?? ''}
        onError={() => setBrokenUrl(avatarUrl)}
        className={cn('shrink-0 object-cover', className)}
      />
    )
  }

  return (
    <div className={cn('shrink-0 flex items-center justify-center', className, fallbackClassName)}>
      {getInitials(fullName || '?')}
    </div>
  )
}
