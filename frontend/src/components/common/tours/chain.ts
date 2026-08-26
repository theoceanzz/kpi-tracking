import { tourKeyOf, type TourKey, type TourScope } from '@/store/tourStore'
import { hasTour } from './registry'

/**
 * Các bài hướng dẫn ứng với MÀN HÌNH ĐANG HIỆN, từ ngoài vào trong.
 *
 * Chuỗi này dựng theo thứ đang được vẽ ra chứ không theo toàn bộ đường dẫn. Lý do: bài
 * cấp trang trỏ vào lưới thẻ, mà lưới thẻ chỉ tồn tại khi CHƯA mở mục nào — mở một mục
 * là lưới bị thay bằng hàng tab mảnh. Nếu cứ bám đường dẫn thì người vào thẳng bằng
 * bookmark `?section=...` sẽ được chạy một bài trỏ vào phần tử không có trên trang.
 *
 * Vì vậy: đang ở lưới thì chỉ có bài cấp trang; đã mở một mục thì có bài cấp mục, cộng
 * bài cấp tab nếu mục đó có hàng tab bên trong.
 */
function tourChainOf(scope: TourScope): TourKey[] {
  if (!scope.navId) return []
  if (!scope.sectionId) return [tourKeyOf(scope.navId)]

  const chain = [tourKeyOf(scope.navId, scope.sectionId)]
  if (scope.tabKey) chain.push(tourKeyOf(scope.navId, scope.sectionId, scope.tabKey))
  return chain
}

/** Chuỗi trên, chỉ giữ những khoá thực sự có bài viết sẵn. */
export function availableTourChain(scope: TourScope): TourKey[] {
  return tourChainOf(scope).filter(hasTour)
}
