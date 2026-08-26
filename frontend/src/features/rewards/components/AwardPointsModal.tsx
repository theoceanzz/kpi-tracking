import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, X, Gift, AlertTriangle, Info, ShieldCheck, Award, ExternalLink } from 'lucide-react'
import { useHasPermission } from '@/components/auth/PermissionGate'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import EmployeePicker, { type PickedEmployee } from './EmployeePicker'
import { useMyBudget, useRewardGrants } from '../hooks/useRewards'
import { useCertificateCatalog } from '../hooks/useCertificates'
import type { RewardGrant } from '../types'

/** Xem ghi chú z-index của `SelectContent` ở EmployeePicker — modal này cũng là z-[1000]. */
const SELECT_CONTENT_Z = 'z-[1100]'

/**
 * "Để hệ thống chọn mẫu mặc định lúc in".
 *
 * <p>Phải là một chuỗi thật chứ không phải `''`: Radix giữ riêng chuỗi rỗng cho trạng
 * thái "chưa chọn gì" và sẽ ném lỗi nếu `SelectItem` mang `value=""`.
 */
const USE_ORG_DEFAULT = '__default__'

/** Tab soạn mẫu chứng nhận, để chỉ đường khi công ty chưa có mẫu nào. */
const CERTIFICATE_TAB_URL = '/settings/tools?section=rewards&tab=certificates'

interface AwardPointsModalProps {
  open: boolean
  onClose: () => void
  /** Điền sẵn người nhận — dùng khi mở từ nút "Thưởng" trên bảng xếp hạng. */
  presetUsers?: { id: string; fullName: string; email?: string }[]
  onSuccess?: (grant: RewardGrant) => void
}

export default function AwardPointsModal({
  open,
  onClose,
  presetUsers,
  onSuccess,
}: AwardPointsModalProps) {
  const [picked, setPicked] = useState<PickedEmployee[]>([])
  const [points, setPoints] = useState<number | ''>('')
  const [reason, setReason] = useState('')
  const [withCertificate, setWithCertificate] = useState(false)
  const [certificateTemplateId, setCertificateTemplateId] = useState('')

  const { data: budget } = useMyBudget(open)
  const { createGrant, isCreating } = useRewardGrants({ size: 1 })
  const { data: certificateCatalog } = useCertificateCatalog(open)
  const certificateTemplates = certificateCatalog?.templates ?? []
  const orgDefaultTemplate = certificateTemplates.find((t) => t.isDefault)

  /**
   * Mẫu thực sự sẽ dùng khi người trao chưa động vào ô chọn.
   *
   * <p>Tính suy ra thay vì nhồi vào state bằng một effect: danh mục mẫu về sau lúc mở
   * modal, mà effect đặt state theo dữ liệu vừa về thì ô chọn nhấp nháy một nhịp từ rỗng
   * sang có giá trị.
   *
   * <p>Không có mẫu mặc định thì chọn sẵn mẫu ĐẦU TIÊN chứ không để trống: để trống nghĩa
   * là lặng lẽ rơi về thiết kế dựng sẵn, trong khi công ty rõ ràng đã có mẫu riêng.
   */
  const effectiveTemplateId =
    certificateTemplateId ||
    (orgDefaultTemplate ? USE_ORG_DEFAULT : (certificateTemplates[0]?.id ?? ''))

  // Người có quyền này (cấp cao nhất) được duyệt thẳng, bỏ qua hạn mức — phải khớp
  // đúng luật ở RewardGrantService, nếu không giao diện sẽ hứa một đằng backend làm một nẻo.
  const { hasPermission } = useHasPermission()
  const canApproveOwn = hasPermission('REWARD:APPROVE_OWN')
  // Chỉ người có quyền cấu hình thưởng mới soạn được mẫu — chỉ đường cho người không có
  // quyền là dẫn họ tới một trang họ mở không nổi.
  const canConfigureCertificates = hasPermission('REWARD:CONFIG')

  useEffect(() => {
    if (!open) return
    setPicked(presetUsers ?? [])
    setPoints('')
    setReason('')
    // Mặc định TẮT ở mỗi lần mở: giấy khen phải là một quyết định có ý thức, nhớ lại
    // lựa chọn của lần trước sẽ biến nó thành thứ phát ra theo quán tính.
    setWithCertificate(false)
    setCertificateTemplateId('')
  }, [open, presetUsers])

  const total = useMemo(
    () => (typeof points === 'number' ? points * picked.length : 0),
    [points, picked.length],
  )

  const noBudget = !budget

  /**
   * Đề nghị VƯỢT hạn mức đang có hay không. Cố ý KHÔNG gộp trạng thái "chưa được cấp
   * hạn mức" vào đây: đó là tình huống khác, và dải thông tin ở đầu modal đã nói rồi —
   * gộp vào sẽ khiến cùng một chuyện hiện hai lần ở hai chỗ.
   */
  const overBudget = useMemo(() => {
    if (!budget) return null
    if (typeof points !== 'number' || points <= 0) return null
    if (budget.maxPerAward != null && points > budget.maxPerAward) {
      return `Vượt mức tối đa ${budget.maxPerAward} điểm/người.`
    }
    if (total > budget.remainingPoints) {
      return `Hạn mức còn ${budget.remainingPoints} điểm nhưng đề nghị cần ${total} điểm.`
    }
    return null
  }, [budget, points, total])

  // Có quyền tự duyệt thì dù chưa có hạn mức hay vượt hạn mức cũng phát ngay.
  const needsApproval = !canApproveOwn && (noBudget || !!overBudget)

  /**
   * Chỉ hiện khi có điều gì đó CHƯA được nói ở dải đầu modal. Người có quyền tự duyệt
   * và chưa có hạn mức thì dải xanh lá ở trên đã giải thích đủ, không cần lặp lại.
   */
  const notice = useMemo(() => {
    if (needsApproval) {
      // `useMyBudget` chỉ trả về hạn mức ĐANG hiệu lực, nên không có nghĩa là "chưa
      // từng được cấp" — có thể hạn mức đã hết hạn. Backend biết rõ hơn và sẽ trả về
      // lý do chính xác sau khi gửi; ở đây nói mở để không khẳng định sai.
      const reason = overBudget ?? 'Bạn không có hạn mức nào đang hiệu lực.'
      return { tone: 'warn' as const, text: `${reason} Đề nghị này sẽ cần cấp trên duyệt.` }
    }
    if (canApproveOwn && overBudget) {
      return {
        tone: 'info' as const,
        text: `${overBudget} Bạn có quyền tự duyệt nên điểm vẫn được phát ngay.`,
      }
    }
    return null
  }, [needsApproval, canApproveOwn, overBudget])

  if (!open) return null

  const canSubmit =
    picked.length > 0 && typeof points === 'number' && points > 0 && reason.trim().length > 0

  const handleSubmit = async () => {
    if (!canSubmit) return
    const grant = await createGrant({
      recipients: picked.map((p) => ({ userId: p.id, points: points as number })),
      reason: reason.trim(),
      pointsPerRecipient: points as number,
      withCertificate,
      // Không kèm giấy khen thì mẫu phải là null — backend có ràng buộc cấm lưu mẫu cho
      // tờ giấy không tồn tại. Sentinel "dùng mẫu mặc định" cũng quy về null: mẫu mặc
      // định được tra lại lúc IN, nên công ty đổi mẫu thì lượt chưa in đi theo mẫu mới.
      certificateTemplateId:
        withCertificate && effectiveTemplateId !== USE_ORG_DEFAULT
          ? effectiveTemplateId || null
          : null,
    })
    onSuccess?.(grant)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Gift size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Thưởng điểm cho nhân viên</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {budget ? (
            <div className="rounded-xl bg-[var(--color-muted)] px-4 py-3 text-sm">
              Hạn mức của bạn:{' '}
              <span className="font-semibold">
                còn {budget.remainingPoints}/{budget.allocatedPoints} điểm
              </span>
              {budget.maxPerAward != null && (
                <span className="text-[var(--color-muted-foreground)]">
                  {' '}· tối đa {budget.maxPerAward} điểm/người mỗi lần
                </span>
              )}
            </div>
          ) : canApproveOwn ? (
            // Không có hạn mức mà vẫn thưởng được ngay — nói rõ một lần ở đây, để người
            // dùng không tưởng hệ thống bỏ sót bước kiểm tra. Dải thông báo phía dưới
            // sẽ không lặp lại chuyện này.
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm">
              <ShieldCheck size={16} className="flex-shrink-0 text-emerald-600" />
              <span>Bạn thưởng được ngay, không bị giới hạn hạn mức.</span>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-medium">Chọn nhân viên</label>

            {picked.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {picked.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)]/10 px-3 py-1 text-sm"
                  >
                    {p.fullName}
                    <button
                      type="button"
                      onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}
                      className="rounded-full hover:bg-[var(--color-primary)]/20"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <EmployeePicker
              selectedIds={picked.map((p) => p.id)}
              onPick={(u) => setPicked((prev) => [...prev, u])}
              enabled={open}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Số điểm mỗi người</label>
              <input
                type="number"
                min={1}
                value={points}
                onChange={(e) => setPoints(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-col justify-end">
              <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2 text-sm">
                Tổng cộng: <span className="font-semibold">{total} điểm</span>
                <span className="text-[var(--color-muted-foreground)]">
                  {' '}({picked.length} người)
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Lý do thưởng</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Ví dụ: Hoàn thành xuất sắc dự án ra mắt sản phẩm quý này"
              className="w-full rounded-lg border border-[var(--color-border)] bg-transparent px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              Lý do được hiện trong lịch sử điểm của nhân viên, nên viết cụ thể. Nếu kèm giấy
              khen, lý do này cũng được in lên đó.
            </p>
          </div>

          {/*
            Giấy khen là quyết định RIÊNG, không phải hệ quả của việc thưởng điểm: thưởng
            10 điểm vì đi họp đúng giờ mà cũng phát ra tờ "Cống hiến xuất sắc" thì giấy
            khen mất hết giá trị. Mặc định tắt, người trao phải chủ động bật.
          */}
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={withCertificate}
                onChange={(e) => setWithCertificate(e.target.checked)}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--color-primary)]"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Award size={15} className="text-amber-600" />
                  Kèm giấy khen
                </span>
                <span className="mt-0.5 block text-xs text-[var(--color-muted-foreground)]">
                  Nhân viên sẽ có một chứng nhận in được ở mục "Điểm thưởng của tôi". Không
                  bật thì lần thưởng này chỉ cộng điểm.
                </span>
              </span>
            </label>

            {withCertificate && (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                <label className="mb-1.5 block text-sm font-medium">Mẫu chứng nhận</label>

                {certificateTemplates.length === 0 ? (
                  // Không dựng ô chọn rỗng: một dropdown chẳng có gì bên trong chỉ khiến
                  // người dùng bấm vào rồi tự hỏi mình làm sai chỗ nào.
                  <div className="rounded-lg bg-[var(--color-muted)] px-3 py-2.5 text-xs">
                    <p className="text-[var(--color-muted-foreground)]">
                      Công ty chưa có mẫu riêng nào — giấy khen sẽ in bằng thiết kế dựng sẵn.
                    </p>
                    {canConfigureCertificates && (
                      <Link
                        to={CERTIFICATE_TAB_URL}
                        className="mt-1.5 inline-flex items-center gap-1 font-medium text-[var(--color-primary)] hover:underline"
                      >
                        Tạo mẫu riêng có logo và chữ ký
                        <ExternalLink size={12} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <Select
                    value={effectiveTemplateId}
                    onValueChange={setCertificateTemplateId}
                  >
                    <SelectTrigger className="w-full rounded-lg border-[var(--color-border)] bg-[var(--color-background)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={SELECT_CONTENT_Z}>
                      {/* Chỉ hiện khi công ty THỰC SỰ có mẫu mặc định — bằng không đây là
                          một lựa chọn hứa hẹn thứ không tồn tại. */}
                      {orgDefaultTemplate && (
                        <SelectItem value={USE_ORG_DEFAULT}>
                          Mẫu mặc định của công ty ({orgDefaultTemplate.name})
                        </SelectItem>
                      )}
                      {certificateTemplates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {certificateTemplates.length > 0 && (
                  <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                    Bạn vẫn đổi được mẫu và khổ giấy ở màn hình in.
                  </p>
                )}
              </div>
            )}
          </div>

          {notice && (
            <div
              className={
                notice.tone === 'warn'
                  ? 'flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm'
                  : 'flex items-start gap-2 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-3 text-sm'
              }
            >
              {notice.tone === 'warn' ? (
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
              ) : (
                <Info size={16} className="mt-0.5 flex-shrink-0 text-sky-600" />
              )}
              <span>{notice.text}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm"
          >
            Huỷ
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isCreating}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isCreating && <Loader2 size={15} className="animate-spin" />}
            {needsApproval ? 'Gửi đề nghị duyệt' : 'Thưởng ngay'}
          </button>
        </div>
      </div>
    </div>
  )
}
