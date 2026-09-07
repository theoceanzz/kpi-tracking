import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Award, Download, Loader2, Printer, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CertificateOrientation, type RewardGrant } from '../../types'
import { useCertificateCatalog } from '../../hooks/useCertificates'
import CertificateCanvas from './CertificateCanvas'
import {
  downloadCertificateBatch,
  printCertificateArea,
  toFileSlug,
} from './certificateExport'
import {
  CERTIFICATE_PAGE,
  CERTIFICATE_PRESETS,
  DEFAULT_PRESET,
  resolveDesign,
  type CertificateData,
} from './presets'

interface CertificateModalProps {
  /** null = đóng. */
  grant: RewardGrant | null
  onClose: () => void
  /**
   * Chỉ cho in chứng nhận của đúng người này. Dùng ở trang "Điểm thưởng của tôi" —
   * nhân viên in giấy khen của mình, không phải của cả đợt.
   */
  lockedRecipientId?: string
}

/** `preset:<khoá>` hoặc `tpl:<id>`. Một chuỗi để state chọn mẫu chỉ có một kiểu. */
type PickedTemplate = string

/** Xem ghi chú z-index của `SelectContent` ở EmployeePicker — modal này cũng là z-[1000]. */
const SELECT_CONTENT_Z = 'z-[1100]'

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

/**
 * Màn hình in chứng nhận cho một lượt thưởng.
 *
 * <p>Bản xem trước và bản đem in là HAI cây DOM khác nhau của cùng một component: bản
 * xem trước bị thu nhỏ cho vừa màn hình, còn bản in luôn giữ kích thước A4 thật. Thu nhỏ
 * bằng transform rồi đem chụp ảnh sẽ ra ảnh mờ đúng bằng tỉ lệ đã thu.
 */
export default function CertificateModal({
  grant,
  onClose,
  lockedRecipientId,
}: CertificateModalProps) {
  const { data: catalog, isLoading, isPending } = useCertificateCatalog(!!grant)

  const [picked, setPicked] = useState<PickedTemplate>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [orientation, setOrientation] = useState<CertificateOrientation | null>(null)
  const [busy, setBusy] = useState<'png' | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const printRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const recipients = useMemo(() => {
    const all = grant?.recipients ?? []
    return lockedRecipientId ? all.filter((r) => r.userId === lockedRecipientId) : all
  }, [grant, lockedRecipientId])

  // Mở lượt thưởng mới thì chọn lại từ đầu: giữ lựa chọn cũ sẽ in nhầm người của đợt
  // trước, và giữ nguyên mẫu sẽ bỏ qua mẫu mà người trao đã chọn cho đợt này.
  useEffect(() => {
    if (!grant) return
    setSelectedIds(recipients.map((r) => r.userId))
    setOrientation(null)
    setProgress(null)
    setPicked('')
  }, [grant, recipients])

  /**
   * Thứ tự ưu tiên khi chọn mẫu mở sẵn:
   * 1. Mẫu người trao đã chọn lúc thưởng — đó là ý định của họ, không phải gợi ý.
   * 2. Mẫu mặc định của công ty.
   * 3. Mẫu đầu tiên trong danh sách, rồi cuối cùng là thiết kế dựng sẵn.
   *
   * <p>Bước 1 phải kiểm mẫu có thật sự còn trong danh mục: mẫu bị xoá mềm vẫn giữ id
   * trong lượt thưởng cũ, trỏ vào đó sẽ ra một ô chọn rỗng và bản xem trước trắng trơn.
   *
   * <p>PHẢI đợi danh mục tải xong (`isPending`). Chạy sớm thì `templates` còn rỗng, cả ba
   * bước ưu tiên đều trượt và mẫu rơi về thiết kế dựng sẵn — rồi vì `picked` đã có giá
   * trị, effect không chạy lại nữa lúc dữ liệu thật về. Ai đã mở danh mục trước đó sẽ
   * không thấy lỗi vì có cache sẵn, còn người mở lần đầu thì luôn bị sai mẫu.
   */
  useEffect(() => {
    if (!grant || picked || isPending) return

    const templates = catalog?.templates ?? []
    const chosenByGrantor = grant.certificateTemplateId
      ? templates.find((t) => t.id === grant.certificateTemplateId)
      : undefined
    const preferred = chosenByGrantor ?? templates.find((t) => t.isDefault) ?? templates[0]

    setPicked(preferred ? `tpl:${preferred.id}` : `preset:${DEFAULT_PRESET.key}`)
  }, [grant, catalog, picked, isPending])

  const template = useMemo(() => {
    if (!picked.startsWith('tpl:')) return null
    const id = picked.slice(4)
    return catalog?.templates.find((t) => t.id === id) ?? null
  }, [picked, catalog])

  const design = useMemo(() => {
    const base = template ?? { preset: picked.replace('preset:', '') }
    const resolved = resolveDesign(base)
    // Nút xoay khổ giấy đè lên hướng của mẫu, nhưng chỉ trong lần in này — không ghi
    // ngược vào mẫu đã lưu.
    return orientation ? { ...resolved, orientation } : resolved
  }, [template, picked, orientation])

  const buildData = (recipient: { fullName: string; points: number }): CertificateData => ({
    recipientName: recipient.fullName,
    points: recipient.points,
    reason: grant?.reason ?? '',
    dateLabel: fmtDate(grant?.approvedAt ?? grant?.createdAt),
    grantorName: grant?.grantorName ?? '',
    orgUnitName: grant?.orgUnitName ?? '',
    organizationName: catalog?.organizationName ?? '',
    organizationLogoUrl: catalog?.organizationLogoUrl,
  })

  const chosen = recipients.filter((r) => selectedIds.includes(r.userId))
  const previewRecipient = chosen[0] ?? recipients[0]

  const handleDownload = async () => {
    if (!chosen.length) return
    setBusy('png')
    setProgress({ done: 0, total: chosen.length })
    try {
      const items = chosen
        .map((r) => ({
          node: printRefs.current[r.userId],
          fileName: `Chung-nhan-${toFileSlug(r.fullName)}-${toFileSlug(fmtDate(grant?.approvedAt ?? grant?.createdAt))}`,
        }))
        .filter((i): i is { node: HTMLDivElement; fileName: string } => !!i.node)

      await downloadCertificateBatch(items, (done, total) => setProgress({ done, total }))
      toast.success(
        items.length > 1 ? `Đã tải ${items.length} chứng nhận` : 'Đã tải chứng nhận'
      )
    } catch (error) {
      console.error(error)
      toast.error('Không tạo được ảnh chứng nhận', {
        description:
          'Thường là do logo hoặc ảnh nền không cho phép tải chéo miền. Bạn vẫn in hoặc lưu PDF được bằng nút bên cạnh.',
        duration: 7000,
      })
    } finally {
      setBusy(null)
      setProgress(null)
    }
  }

  if (!grant) return null

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl">
        <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex items-center gap-2">
            <Award size={20} className="text-[var(--color-primary)]" />
            <h2 className="text-lg font-semibold">Chứng nhận khen thưởng</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--color-accent)]">
            <X size={18} />
          </button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 overflow-y-auto lg:grid-cols-[320px_1fr]">
          {/* ── Cột trái: chọn mẫu và người nhận ── */}
          <div className="space-y-5 border-b border-[var(--color-border)] p-5 lg:border-b-0 lg:border-r">
            <div>
              <div className="mb-2 text-sm font-medium">Mẫu chứng nhận</div>
              {isLoading ? (
                <div className="h-9 animate-pulse rounded-lg bg-[var(--color-muted)]" />
              ) : lockedRecipientId ? (
                // Người nhận không đổi mẫu: giấy khen là thứ công ty trao cho họ, không
                // phải tấm thiệp họ tự thiết kế. Hiện tên mẫu cho biết đang in bằng gì.
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm">
                  {template?.name ?? design.preset.name}
                </div>
              ) : (
                <Select value={picked} onValueChange={setPicked}>
                  <SelectTrigger className="w-full rounded-lg border-[var(--color-border)] bg-[var(--color-background)]">
                    {/* Có placeholder vì `picked` rỗng trong nhịp đầu, trước khi effect
                        chốt được mẫu ưu tiên — không có thì ô trống trơn một thoáng. */}
                    <SelectValue placeholder="Chọn mẫu" />
                  </SelectTrigger>
                  <SelectContent className={SELECT_CONTENT_Z}>
                    {!!catalog?.templates.length && (
                      <SelectGroup>
                        <SelectLabel>Mẫu của công ty</SelectLabel>
                        {catalog.templates.map((t) => (
                          <SelectItem key={t.id} value={`tpl:${t.id}`}>
                            {t.name}
                            {t.isDefault ? ' (mặc định)' : ''}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    <SelectGroup>
                      <SelectLabel>Mẫu dựng sẵn</SelectLabel>
                      {CERTIFICATE_PRESETS.map((p) => (
                        <SelectItem key={p.key} value={`preset:${p.key}`}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                {template ? template.name : design.preset.tagline}
              </p>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium">Khổ giấy</div>
              <div className="flex gap-1.5">
                {[
                  { key: CertificateOrientation.LANDSCAPE, label: 'Ngang' },
                  { key: CertificateOrientation.PORTRAIT, label: 'Dọc' },
                ].map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setOrientation(o.key)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      design.orientation === o.key
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 font-medium text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-accent)]'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {recipients.length > 1 && (
              <div>
                <div className="mb-2 flex items-center justify-between text-sm font-medium">
                  <span>Người nhận ({selectedIds.length}/{recipients.length})</span>
                  <button
                    onClick={() =>
                      setSelectedIds(
                        selectedIds.length === recipients.length ? [] : recipients.map((r) => r.userId)
                      )
                    }
                    className="text-xs font-normal text-[var(--color-primary)] hover:underline"
                  >
                    {selectedIds.length === recipients.length ? 'Bỏ chọn hết' : 'Chọn hết'}
                  </button>
                </div>
                <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-1.5">
                  {recipients.map((r) => (
                    <label
                      key={r.userId}
                      className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-accent)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(r.userId)}
                        onChange={(e) =>
                          setSelectedIds((prev) =>
                            e.target.checked
                              ? [...prev, r.userId]
                              : prev.filter((id) => id !== r.userId)
                          )
                        }
                        className="h-4 w-4 accent-[var(--color-primary)]"
                      />
                      <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
                      <span className="flex-shrink-0 text-xs text-[var(--color-muted-foreground)]">
                        {r.points.toLocaleString('vi-VN')}đ
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
                  Mỗi người một tờ riêng, in liền một lượt.
                </p>
              </div>
            )}

            <div className="space-y-2 border-t border-[var(--color-border)] pt-4">
              <button
                onClick={() => printCertificateArea(design.orientation)}
                disabled={!chosen.length}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Printer size={16} />
                In / Lưu PDF
              </button>
              <button
                onClick={handleDownload}
                disabled={!chosen.length || busy === 'png'}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium transition-colors hover:bg-[var(--color-accent)] disabled:opacity-50"
              >
                {busy === 'png' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {progress && progress.total > 1
                  ? `Đang tải ${progress.done}/${progress.total}…`
                  : 'Tải ảnh PNG'}
              </button>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Trong hộp thoại in, chọn máy in là <strong>Lưu thành PDF</strong> nếu bạn muốn
                một tệp PDF thay vì in ra giấy.
              </p>
            </div>
          </div>

          {/* ── Cột phải: xem trước ── */}
          <div className="flex items-start justify-center bg-[var(--color-muted)] p-5">
            {previewRecipient ? (
              <PreviewFrame design={design} data={buildData(previewRecipient)} />
            ) : (
              <p className="py-16 text-sm text-[var(--color-muted-foreground)]">
                Chọn ít nhất một người nhận để xem trước.
              </p>
            )}
          </div>
        </div>
      </div>

      {/*
        Khu vực in: luôn dựng ở kích thước A4 thật, nằm ngoài màn hình. Đây cũng chính là
        cây DOM được chụp thành PNG — nhờ vậy ảnh tải về và bản in không thể lệch nhau.

        Portal thẳng ra `document.body` vì luật in giấu mọi thứ bằng
        `body > *:not(.certificate-print-root)` — nằm lồng trong modal thì chính nó cũng
        bị giấu theo và bản in ra trang trắng.
      */}
      {createPortal(
        <div className="certificate-print-root" aria-hidden>
          {chosen.map((r) => (
            <div key={r.userId} className="certificate-print-page">
              <CertificateCanvas
                ref={(node) => {
                  printRefs.current[r.userId] = node
                }}
                design={design}
                data={buildData(r)}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

/**
 * Bản xem trước co theo bề rộng cột.
 *
 * <p>Tính tỉ lệ từ bề rộng đo được thay vì đặt một con số cố định: cột phải hẹp lại trên
 * laptop 13" và tờ chứng nhận sẽ tràn ra ngoài khung nếu tỉ lệ đóng cứng.
 */
function PreviewFrame({
  design,
  data,
}: {
  design: ReturnType<typeof resolveDesign>
  data: CertificateData
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  const page = CERTIFICATE_PAGE[design.orientation]

  useLayoutEffect(() => {
    const box = boxRef.current
    if (!box) return

    const measure = () => {
      const width = box.clientWidth
      if (width > 0) setScale(Math.min(width / page.width, 0.9))
    }
    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [page.width])

  return (
    <div ref={boxRef} className="flex w-full justify-center">
      <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/10">
        <CertificateCanvas design={design} data={data} scale={scale} />
      </div>
    </div>
  )
}
