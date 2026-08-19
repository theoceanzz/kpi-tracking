import { findNavItem } from '@/config/navigation'
import { useNavLabels } from './useNavLabels'

/**
 * Tiêu đề trang lấy theo nhãn tuỳ chỉnh mà tổ chức đặt cho mục điều hướng tương ứng —
 * đổi tên trên menu thì tiêu đề trang đổi theo, không lệch nhau.
 *
 * `key` là `id` của mục nav (kể cả mục nằm trong trang), hoặc một path. Trước đây mỗi
 * trang tự viết lại đoạn đọc `customLabels[path]` này; gom về một chỗ để chỉ còn một
 * quy ước, và để các khoá cũ trong DB vẫn tra được qua `legacyKeys`.
 */
export function usePageTitle(key: string, defaultLabel: string): string {
  const { labelOf, customLabels } = useNavLabels()

  const item = findNavItem(key)
  const label = item
    ? labelOf({ ...item, label: defaultLabel })
    : customLabels[key] || defaultLabel

  return label
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}
