import { toPng } from 'html-to-image'
import { CertificateOrientation } from '../../types'

/**
 * Xuất chứng nhận thành ảnh PNG và in ra giấy / PDF.
 *
 * <p>Hai đường ra dùng CÙNG một cây DOM đã dựng ở kích thước in thật, nên ảnh tải về và
 * bản in luôn khớp nhau. Không có đường thứ ba nào tự vẽ lại tờ giấy.
 */

/** Bội số độ phân giải khi chụp ảnh. 2× trên khổ A4 ≈ 190dpi — in ra vẫn nét. */
const PIXEL_RATIO = 2

/** Bỏ dấu tiếng Việt và ký tự lạ để tên tệp mở được trên mọi hệ điều hành. */
export function toFileSlug(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'chung-nhan'
  )
}

/**
 * Chụp một tờ chứng nhận thành PNG.
 *
 * <p>Ảnh nền, logo và chữ ký nằm trên Cloudinary. Nếu một trong số đó trả về không kèm
 * header CORS thì canvas bị "nhiễm" và trình duyệt CẤM đọc ngược dữ liệu ra — lỗi ném ra
 * ở đây, không phải ảnh hỏng. Người gọi bắt lỗi và chỉ đường sang nút In.
 */
export async function certificateToPngBlob(node: HTMLElement): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio: PIXEL_RATIO,
    // Bỏ qua bộ nhớ đệm ảnh: logo vừa đổi mà vẫn lấy bản cũ là lỗi rất khó hiểu.
    cacheBust: true,
    // Nền trắng phòng khi mẫu để nền trong suốt — PNG trong suốt in ra sẽ mất nền màu.
    backgroundColor: '#ffffff',
  })

  const response = await fetch(dataUrl)
  return response.blob()
}

/** Chụp rồi tải về máy. */
export async function downloadCertificatePng(node: HTMLElement, fileName: string): Promise<void> {
  const blob = await certificateToPngBlob(node)
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  document.body.appendChild(link)
  link.click()
  link.remove()

  // Thu hồi sau một nhịp: gọi ngay lập tức thì Safari huỷ luôn lượt tải đang bắt đầu.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * Tải nhiều chứng nhận, mỗi người một tệp.
 *
 * <p>Chụp và tải TUẦN TỰ chứ không `Promise.all`: chụp song song nhiều tờ A4 ở 2× làm
 * trình duyệt dựng cùng lúc mấy canvas cỡ 2246×1588 và tab treo trên máy yếu. Giãn nhịp
 * giữa hai lượt tải cũng để trình duyệt kịp hỏi "cho phép tải nhiều tệp?" một lần thay
 * vì chặn im lặng các lượt sau.
 */
export async function downloadCertificateBatch(
  items: { node: HTMLElement; fileName: string }[],
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue

    await downloadCertificatePng(item.node, item.fileName)
    onProgress?.(i + 1, items.length)
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
  }
}

const PAGE_STYLE_ID = 'certificate-page-style'
const PRINTING_CLASS = 'certificate-printing'

/**
 * Mở hộp thoại in của trình duyệt cho khu vực chứng nhận đang ẩn.
 *
 * <p>In THẲNG cây DOM chứ không in ảnh PNG: chữ giữ nguyên dạng vector nên nét ở mọi cỡ
 * giấy, và người dùng chọn "Lưu thành PDF" thì ra một tệp PDF chữ chọn được.
 *
 * <p>`@page size` là thuộc tính của cả tài liệu, không đặt được cho riêng một phần tử —
 * nên hướng giấy phải bơm vào bằng một thẻ style tạm ngay trước khi in rồi gỡ đi.
 */
export function printCertificateArea(orientation: CertificateOrientation): void {
  const previous = document.getElementById(PAGE_STYLE_ID)
  previous?.remove()

  const style = document.createElement('style')
  style.id = PAGE_STYLE_ID
  style.textContent = `@page { size: A4 ${
    orientation === CertificateOrientation.PORTRAIT ? 'portrait' : 'landscape'
  }; margin: 0; }`
  document.head.appendChild(style)

  document.body.classList.add(PRINTING_CLASS)

  const cleanup = () => {
    document.body.classList.remove(PRINTING_CLASS)
    document.getElementById(PAGE_STYLE_ID)?.remove()
    window.removeEventListener('afterprint', cleanup)
  }
  window.addEventListener('afterprint', cleanup)

  // Một nhịp để trình duyệt kịp áp lại layout theo class vừa thêm; in ngay lập tức thì
  // Safari chụp lại trạng thái CŨ và in ra trang trắng.
  setTimeout(() => {
    window.print()
    // Firefox không phải lúc nào cũng bắn `afterprint`; dọn thêm một lần cho chắc.
    setTimeout(cleanup, 1500)
  }, 60)
}
