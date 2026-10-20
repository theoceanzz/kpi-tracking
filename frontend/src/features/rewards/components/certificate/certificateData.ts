import { intlDateLocale } from '@/i18n/format'
import type { CertificateCatalog, RewardGrant } from '../../types'
import { DEFAULT_PRESET, resolveDesign, type CertificateData } from './presets'

/**
 * Hàm dùng chung giữa màn in giấy khen (`CertificateModal`) và hộp chúc mừng (giấy khen trượt vào),
 * để hai nơi luôn chọn cùng một mẫu và in cùng một nội dung.
 */

/** `preset:<khoá>` hoặc `tpl:<id>`. Một chuỗi để state chọn mẫu chỉ có một kiểu. */
export type PickedTemplate = string

export const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString(intlDateLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

/**
 * Mẫu mở sẵn cho một lượt thưởng, dạng `tpl:<id>` / `preset:<khoá>`. Thứ tự ưu tiên:
 * 1. Mẫu người trao đã chọn lúc thưởng — đó là ý định của họ, không phải gợi ý.
 * 2. Mẫu mặc định của công ty.
 * 3. Mẫu đầu tiên trong danh sách, rồi cuối cùng là thiết kế dựng sẵn.
 *
 * <p>Bước 1 phải kiểm mẫu có thật sự còn trong danh mục: mẫu bị xoá mềm vẫn giữ id trong lượt
 * thưởng cũ, trỏ vào đó sẽ ra một ô chọn rỗng và bản xem trước trắng trơn. Dùng chung với hộp chúc
 * mừng (giấy khen trượt vào) để hai nơi luôn hiện cùng một mẫu.
 */
export function preferredTemplateKey(
  grant: Pick<RewardGrant, 'certificateTemplateId'>,
  catalog: CertificateCatalog | undefined
): PickedTemplate {
  const templates = catalog?.templates ?? []
  const chosenByGrantor = grant.certificateTemplateId
    ? templates.find((t) => t.id === grant.certificateTemplateId)
    : undefined
  const preferred = chosenByGrantor ?? templates.find((t) => t.isDefault) ?? templates[0]
  return preferred ? `tpl:${preferred.id}` : `preset:${DEFAULT_PRESET().key}`
}

/** Bản thiết kế đã giải ra từ khoá mẫu (`preferredTemplateKey`). */
export function designForKey(key: PickedTemplate, catalog: CertificateCatalog | undefined) {
  const template = key.startsWith('tpl:') ? catalog?.templates.find((t) => t.id === key.slice(4)) : undefined
  return resolveDesign(template ?? { preset: key.replace('preset:', '') })
}

/** Nội dung in lên giấy khen của một người nhận trong lượt thưởng. */
export function certificateDataFor(
  grant: RewardGrant | null | undefined,
  recipient: { fullName: string; points: number },
  catalog: CertificateCatalog | undefined
): CertificateData {
  return {
    recipientName: recipient.fullName,
    points: recipient.points,
    reason: grant?.reason ?? '',
    dateLabel: fmtDate(grant?.approvedAt ?? grant?.createdAt),
    grantorName: grant?.grantorName ?? '',
    orgUnitName: grant?.orgUnitName ?? '',
    organizationName: catalog?.organizationName ?? '',
    organizationLogoUrl: catalog?.organizationLogoUrl,
  }
}
