import { forwardRef } from 'react'
import { CertificateOrientation } from '../../types'
import {
  CERTIFICATE_PAGE,
  fillPlaceholders,
  withAlpha,
  type CertificateData,
  type ResolvedDesign,
} from './presets'

/**
 * Tờ chứng nhận, vẽ đúng kích thước in thật (A4 ở 96dpi).
 *
 * <p>Mọi khoảng cách và cỡ chữ đều là px tuyệt đối, KHÔNG dùng rem hay class Tailwind:
 * bản in và ảnh PNG phải giống hệt nhau trên mọi máy, mà rem thì phụ thuộc cỡ chữ gốc
 * của trình duyệt còn class Tailwind lại đi kèm biến chủ đề sáng/tối. Chứng nhận luôn
 * là "giấy trắng mực đen" theo bảng màu của mẫu, không đổi theo chủ đề của ứng dụng.
 *
 * <p>Thu nhỏ để xem trước bằng `scale` ở lớp bọc ngoài — phần tử bên trong luôn giữ kích
 * thước thật để lúc chụp ảnh không phải gỡ transform ra.
 */

interface CertificateCanvasProps {
  design: ResolvedDesign
  data: CertificateData
  /** 1 = kích thước in thật. Nhỏ hơn để xem trước. */
  scale?: number
}

const CertificateCanvas = forwardRef<HTMLDivElement, CertificateCanvasProps>(
  ({ design, data, scale = 1 }, ref) => {
    const page = CERTIFICATE_PAGE[design.orientation] ?? CERTIFICATE_PAGE[CertificateOrientation.LANDSCAPE]
    const { preset, ink, accent, surface } = design
    const portrait = design.orientation === CertificateOrientation.PORTRAIT
    const centered = preset.align === 'CENTER'

    // Khổ dọc hẹp hơn khổ ngang 30%: giữ nguyên cỡ chữ sẽ tràn dòng ở tiêu đề và tên.
    const t = (n: number) => Math.round(n * (portrait ? 0.86 : 1))
    const padX = portrait ? 76 : 108
    const padY = portrait ? 88 : 72

    const soft = (alpha: number) => withAlpha(ink, alpha)

    const title = fillPlaceholders(design.title, data)
    const body = fillPlaceholders(design.body, data)
    const subtitle = fillPlaceholders(design.subtitle, data)
    const eyebrow = fillPlaceholders(design.eyebrow, data)
    const footnote = fillPlaceholders(design.footnote, data)
    const signerName = design.signerName || data.grantorName
    const logo = design.logoUrl || data.organizationLogoUrl

    // Tên dài (họ tên đầy đủ tiếng Việt dễ vượt 24 ký tự) phải nhỏ lại, nếu không nó
    // đẩy chữ tràn ra ngoài khung viền — lỗi chỉ lộ ra sau khi đã in.
    const scriptName = preset.fonts.name.includes('Great Vibes')
    const baseNameSize = scriptName ? 92 : 62
    const nameSize = t(
      data.recipientName.length > 28
        ? baseNameSize * 0.66
        : data.recipientName.length > 20
          ? baseNameSize * 0.8
          : baseNameSize
    )

    return (
      <div
        style={{
          width: page.width * scale,
          height: page.height * scale,
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          ref={ref}
          style={{
            width: page.width,
            height: page.height,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'relative',
            backgroundColor: surface,
            color: ink,
            fontFamily: preset.fonts.body,
            // Nền màu là toàn bộ thiết kế của mấy mẫu tối — trình duyệt mặc định BỎ nền
            // khi in để tiết kiệm mực, và sẽ in ra một tờ giấy trắng trơn.
            printColorAdjust: 'exact',
            WebkitPrintColorAdjust: 'exact',
          }}
        >
          {design.backgroundUrl && (
            <img
              src={design.backgroundUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          )}
          {/* Màng phủ màu nền: ảnh nền của người dùng gần như luôn quá tương phản để đọc
              chữ trực tiếp lên trên. Chỉ phủ khi CÓ ảnh nền. */}
          {design.backgroundUrl && (
            <div style={{ position: 'absolute', inset: 0, backgroundColor: withAlpha(surface, 0.82) }} />
          )}

          <Frame design={design} width={page.width} height={page.height} />

          <div
            style={{
              position: 'relative',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: `${padY}px ${padX}px`,
              textAlign: centered ? 'center' : 'left',
              alignItems: centered ? 'center' : 'flex-start',
            }}
          >
            {/* ── Đầu trang: nhận diện công ty ── */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                justifyContent: centered ? 'center' : 'flex-start',
              }}
            >
              {design.showLogo && logo && (
                <img
                  src={logo}
                  alt=""
                  crossOrigin="anonymous"
                  style={{ height: t(46), width: 'auto', maxWidth: t(150), objectFit: 'contain' }}
                />
              )}
              <span
                style={{
                  fontSize: t(14),
                  fontWeight: 600,
                  letterSpacing: '0.24em',
                  textTransform: 'uppercase',
                  color: soft(0.62),
                }}
              >
                {data.organizationName}
              </span>
            </div>

            {/* ── Thân: đẩy giãn để chân trang luôn nằm sát đáy ── */}
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: centered ? 'center' : 'flex-start',
                justifyContent: 'center',
                width: '100%',
                gap: 0,
              }}
            >
              {eyebrow && <Eyebrow design={design} text={eyebrow} size={t(14)} />}

              {title && (
                <h1
                  style={{
                    margin: `${t(14)}px 0 0`,
                    fontFamily: preset.fonts.display,
                    fontSize: t(preset.fonts.display.includes('Playfair') ? 50 : 46),
                    fontWeight: preset.fonts.display.includes('Playfair') ? 700 : 800,
                    lineHeight: 1.14,
                    letterSpacing: title === title.toUpperCase() ? '0.04em' : '-0.01em',
                    maxWidth: portrait ? 620 : 820,
                  }}
                >
                  {title}
                </h1>
              )}

              {subtitle && (
                <p
                  style={{
                    margin: `${t(18)}px 0 0`,
                    fontSize: t(17),
                    color: soft(0.66),
                    letterSpacing: '0.02em',
                  }}
                >
                  {subtitle}
                </p>
              )}

              {/* ── Tên người nhận ── */}
              <div
                style={{
                  marginTop: t(subtitle ? 6 : 22),
                  display: 'flex',
                  alignItems: 'center',
                  gap: t(20),
                  maxWidth: '100%',
                }}
              >
                {preset.frame === 'LAUREL' && <LaurelBranch side="left" accent={accent} height={t(112)} />}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: preset.fonts.name,
                      fontSize: nameSize,
                      // Font script có phần bụng chữ tràn xuống dưới; line-height chật
                      // sẽ cắt mất đuôi chữ "g", "y" lúc rasterise ra PNG.
                      lineHeight: scriptName ? 1.35 : 1.18,
                      fontWeight: scriptName ? 400 : 700,
                      letterSpacing: scriptName ? '0.01em' : '-0.015em',
                      color: preset.frame === 'HAIRLINE' ? ink : accent,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {data.recipientName}
                  </div>
                  <div
                    style={{
                      marginTop: t(10),
                      height: 2,
                      backgroundColor: withAlpha(accent, 0.45),
                      borderRadius: 2,
                    }}
                  />
                </div>
                {preset.frame === 'LAUREL' && <LaurelBranch side="right" accent={accent} height={t(112)} />}
              </div>

              {body && (
                <p
                  style={{
                    margin: `${t(24)}px 0 0`,
                    fontSize: t(17),
                    lineHeight: 1.75,
                    color: soft(0.78),
                    maxWidth: portrait ? 560 : 700,
                  }}
                >
                  {body}
                </p>
              )}

              {design.showReason && data.reason && (
                <ReasonQuote
                  text={data.reason}
                  accent={accent}
                  color={soft(0.9)}
                  centered={centered}
                  size={t(16)}
                  marginTop={t(18)}
                  maxWidth={portrait ? 560 : 700}
                />
              )}

              {design.showPoints && (
                <PointsBadge
                  points={data.points}
                  accent={accent}
                  dark={preset.dark}
                  size={t(15)}
                  marginTop={t(26)}
                />
              )}
            </div>

            {/* ── Chân trang: ngày trao bên trái, chữ ký bên phải ── */}
            <div
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 32,
                textAlign: 'left',
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <div
                  style={{
                    fontSize: t(11),
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: soft(0.45),
                  }}
                >
                  Ngày trao
                </div>
                <div style={{ marginTop: 4, fontSize: t(15), fontWeight: 600 }}>{data.dateLabel}</div>
              </div>

              {footnote && (
                <div
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: t(11),
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: soft(0.42),
                  }}
                >
                  {footnote}
                </div>
              )}

              <div style={{ textAlign: 'center', minWidth: t(220), flexShrink: 0 }}>
                {/* Ô chữ ký luôn cao bằng nhau dù có ảnh chữ ký hay không — nếu không,
                    hai chứng nhận in cùng lúc sẽ có đường kẻ ký nằm lệch nhau. */}
                <div
                  style={{
                    height: t(52),
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                >
                  {design.signatureUrl && (
                    <img
                      src={design.signatureUrl}
                      alt=""
                      crossOrigin="anonymous"
                      style={{ maxHeight: t(52), maxWidth: t(200), objectFit: 'contain' }}
                    />
                  )}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    height: 1,
                    backgroundColor: soft(0.28),
                  }}
                />
                <div style={{ marginTop: 8, fontSize: t(15), fontWeight: 700 }}>{signerName}</div>
                {design.signerTitle && (
                  <div style={{ marginTop: 2, fontSize: t(12), color: soft(0.55) }}>
                    {design.signerTitle}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
)

CertificateCanvas.displayName = 'CertificateCanvas'
export default CertificateCanvas

// ── Các mảnh nhỏ ─────────────────────────────────────────────────

/** Dòng dẫn phía trên tiêu đề. Mẫu "Rực rỡ" bọc nó trong một dải băng. */
function Eyebrow({ design, text, size }: { design: ResolvedDesign; text: string; size: number }) {
  const pill = design.preset.frame === 'CONFETTI'

  const base: React.CSSProperties = {
    fontSize: size,
    fontWeight: 700,
    letterSpacing: '0.4em',
    textTransform: 'uppercase',
  }

  if (pill) {
    return (
      <span
        style={{
          ...base,
          // Lùi lề trái bằng đúng letter-spacing: chữ cuối cùng vẫn kéo theo một khoảng
          // trống, không bù lại thì chữ trong dải băng trông lệch sang trái.
          padding: `${Math.round(size * 0.6)}px ${Math.round(size * 1.5)}px`,
          paddingRight: Math.round(size * 1.5 + size * 0.4),
          borderRadius: 999,
          backgroundColor: design.accent,
          color: '#FFFFFF',
        }}
      >
        {text}
      </span>
    )
  }

  return (
    <span style={{ ...base, color: withAlpha(design.accent, 0.95), paddingRight: '0.4em' }}>
      {text}
    </span>
  )
}

/** Lý do khen thưởng, trích nguyên văn của người trao. */
function ReasonQuote({
  text,
  accent,
  color,
  centered,
  size,
  marginTop,
  maxWidth,
}: {
  text: string
  accent: string
  color: string
  centered: boolean
  size: number
  marginTop: number
  maxWidth: number
}) {
  return (
    <div
      style={{
        marginTop,
        maxWidth,
        display: 'flex',
        gap: 12,
        alignItems: 'stretch',
        justifyContent: centered ? 'center' : 'flex-start',
      }}
    >
      {!centered && <div style={{ width: 3, borderRadius: 3, backgroundColor: withAlpha(accent, 0.7) }} />}
      <p
        style={{
          margin: 0,
          fontSize: size,
          fontStyle: 'italic',
          lineHeight: 1.65,
          color,
          // Lý do do sếp gõ tay, có thể dài vài dòng. Cắt ở 3 dòng thay vì để nó đẩy
          // phần chữ ký ra khỏi trang giấy.
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        “{text}”
      </p>
    </div>
  )
}

/** Huy hiệu số điểm. */
function PointsBadge({
  points,
  accent,
  dark,
  size,
  marginTop,
}: {
  points: number
  accent: string
  dark: boolean
  size: number
  marginTop: number
}) {
  return (
    <div
      style={{
        marginTop,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: `${Math.round(size * 0.6)}px ${Math.round(size * 1.2)}px`,
        borderRadius: 999,
        border: `1.5px solid ${withAlpha(accent, 0.5)}`,
        // Nền tối cần nền huy hiệu đậm hơn mới tách được khỏi mặt giấy.
        backgroundColor: withAlpha(accent, dark ? 0.16 : 0.08),
        color: accent,
      }}
    >
      <StarIcon size={Math.round(size * 1.1)} color={accent} />
      <span style={{ fontSize: Math.round(size * 1.35), fontWeight: 800, letterSpacing: '-0.01em' }}>
        {points.toLocaleString('vi-VN')}
      </span>
      <span style={{ fontSize: size, fontWeight: 600, opacity: 0.85 }}>điểm thưởng</span>
    </div>
  )
}

function StarIcon({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 2.5l2.9 5.9 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.4l1.2-6.5L2.5 9.3l6.6-.9L12 2.5z" />
    </svg>
  )
}

/**
 * Một nhánh nguyệt quế.
 *
 * <p>Lá vẽ bằng vòng lặp theo cung tròn chứ không phải một đường path chép sẵn: nhờ vậy
 * nhánh co giãn theo cỡ chữ của tên người nhận mà không méo.
 */
function LaurelBranch({ side, accent, height }: { side: 'left' | 'right'; accent: string; height: number }) {
  const width = Math.round(height * 0.5)
  const cx = side === 'left' ? width : 0
  const cy = height / 2
  const radius = height * 0.42

  const leaves = Array.from({ length: 9 }, (_, i) => {
    const ratio = i / 8
    // Nửa cung: từ dưới vòng lên trên, phía trong ôm lấy tên.
    const deg = side === 'left' ? 108 + ratio * 144 : 72 - ratio * 144
    const rad = (deg * Math.PI) / 180
    const x = cx + Math.cos(rad) * radius
    const y = cy + Math.sin(rad) * radius
    const rotate = (deg + (side === 'left' ? -90 : 90)) % 360
    const rx = height * 0.1 * (1 - ratio * 0.35)
    const ry = height * 0.042

    return (
      <ellipse
        key={i}
        cx={x}
        cy={y}
        rx={rx}
        ry={ry}
        transform={`rotate(${rotate} ${x} ${y})`}
        fill={withAlpha(accent, 0.28 + ratio * 0.24)}
      />
    )
  })

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
      <path
        d={
          side === 'left'
            ? `M ${cx} ${cy + radius} A ${radius} ${radius} 0 0 0 ${cx + Math.cos((252 * Math.PI) / 180) * radius} ${cy + Math.sin((252 * Math.PI) / 180) * radius}`
            : `M ${cx} ${cy + radius} A ${radius} ${radius} 0 0 1 ${cx + Math.cos((-72 * Math.PI) / 180) * radius} ${cy + Math.sin((-72 * Math.PI) / 180) * radius}`
        }
        fill="none"
        stroke={withAlpha(accent, 0.45)}
        strokeWidth={1.5}
      />
      {leaves}
    </svg>
  )
}

// ── Khung viền theo từng kiểu thiết kế ───────────────────────────

function Frame({ design, width, height }: { design: ResolvedDesign; width: number; height: number }) {
  const { accent, ink } = design
  const common: React.CSSProperties = { position: 'absolute', inset: 0 }

  switch (design.preset.frame) {
    case 'GOLD_DOUBLE':
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect
            x={26}
            y={26}
            width={width - 52}
            height={height - 52}
            fill="none"
            stroke={accent}
            strokeWidth={3}
          />
          <rect
            x={40}
            y={40}
            width={width - 80}
            height={height - 80}
            fill="none"
            stroke={withAlpha(accent, 0.4)}
            strokeWidth={1}
          />
          {[
            [26, 26],
            [width - 26, 26],
            [26, height - 26],
            [width - 26, height - 26],
          ].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(45)`}>
              <rect x={-9} y={-9} width={18} height={18} fill={design.surface} stroke={accent} strokeWidth={2} />
              <rect x={-3.5} y={-3.5} width={7} height={7} fill={accent} />
            </g>
          ))}
        </svg>
      )

    case 'GRADIENT_ARC':
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <defs>
            <linearGradient id="cert-arc" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.9} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={14} height={height} fill={accent} />
          <circle cx={-40} cy={-60} r={300} fill="url(#cert-arc)" opacity={0.14} />
          <circle cx={width + 60} cy={height + 40} r={260} fill="url(#cert-arc)" opacity={0.12} />
          <circle
            cx={width - 130}
            cy={130}
            r={64}
            fill="none"
            stroke={withAlpha(accent, 0.35)}
            strokeWidth={12}
          />
        </svg>
      )

    case 'DECO_CORNERS': {
      const inset = 34
      const arm = 54
      const corners = [
        { x: inset, y: inset, sx: 1, sy: 1 },
        { x: width - inset, y: inset, sx: -1, sy: 1 },
        { x: inset, y: height - inset, sx: 1, sy: -1 },
        { x: width - inset, y: height - inset, sx: -1, sy: -1 },
      ]
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect
            x={inset}
            y={inset}
            width={width - inset * 2}
            height={height - inset * 2}
            fill="none"
            stroke={withAlpha(accent, 0.55)}
            strokeWidth={1.5}
          />
          <rect
            x={inset + 9}
            y={inset + 9}
            width={width - (inset + 9) * 2}
            height={height - (inset + 9) * 2}
            fill="none"
            stroke={withAlpha(accent, 0.22)}
            strokeWidth={1}
          />
          {corners.map((c, i) => (
            <g key={i} transform={`translate(${c.x} ${c.y}) scale(${c.sx} ${c.sy})`}>
              <path d={`M 0 ${arm} L 0 0 L ${arm} 0`} fill="none" stroke={accent} strokeWidth={3} />
              <path d={`M 14 ${arm - 14} L 14 14 L ${arm - 14} 14`} fill="none" stroke={withAlpha(accent, 0.5)} strokeWidth={1} />
            </g>
          ))}
          {[-1, 0, 1].map((offset) => (
            <g key={offset} transform={`translate(${width / 2 + offset * 22} ${inset}) rotate(45)`}>
              <rect
                x={-5}
                y={-5}
                width={10}
                height={10}
                fill={design.surface}
                stroke={accent}
                strokeWidth={offset === 0 ? 2 : 1}
              />
            </g>
          ))}
        </svg>
      )
    }

    case 'HAIRLINE':
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect x={0} y={0} width={width} height={8} fill={accent} />
          <line
            x1={72}
            y1={height - 128}
            x2={width - 72}
            y2={height - 128}
            stroke={withAlpha(ink, 0.14)}
            strokeWidth={1}
          />
        </svg>
      )

    case 'CONFETTI':
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect
            x={22}
            y={22}
            width={width - 44}
            height={height - 44}
            rx={18}
            fill="none"
            stroke={withAlpha(accent, 0.35)}
            strokeWidth={2}
          />
          {confettiPieces(width, height, accent).map((p, i) =>
            p.kind === 'circle' ? (
              <circle key={i} cx={p.x} cy={p.y} r={p.size / 2} fill={p.color} opacity={p.opacity} />
            ) : (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.size}
                height={p.size * 0.42}
                rx={p.size * 0.18}
                fill={p.color}
                opacity={p.opacity}
                transform={`rotate(${p.rotate} ${p.x} ${p.y})`}
              />
            )
          )}
        </svg>
      )

    case 'LAUREL':
      return (
        <svg style={common} width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
          <rect
            x={28}
            y={28}
            width={width - 56}
            height={height - 56}
            rx={10}
            fill="none"
            stroke={withAlpha(accent, 0.5)}
            strokeWidth={2}
          />
          <rect
            x={38}
            y={38}
            width={width - 76}
            height={height - 76}
            rx={6}
            fill="none"
            stroke={withAlpha(accent, 0.2)}
            strokeWidth={1}
          />
        </svg>
      )

    default:
      return null
  }
}

/**
 * Vị trí các mảnh kim tuyến — cố định, không random lúc chạy.
 *
 * <p>Random mỗi lần render sẽ cho ra bản xem trước, ảnh PNG và bản in ba kiểu khác nhau;
 * người dùng chỉnh một chữ trong mẫu là cả trận kim tuyến nhảy chỗ.
 *
 * <p>Chỉ rải ở dải rìa: đè lên vùng chữ giữa trang thì tên người nhận đọc không nổi.
 */
function confettiPieces(width: number, height: number, accent: string) {
  const palette = [accent, '#FACC15', '#34D399', '#60A5FA', '#F472B6', '#A78BFA']

  // Bộ số cố định trong [0,1): tọa độ theo tỉ lệ nên đổi khổ giấy vẫn rải đều.
  const seeds = [
    0.04, 0.11, 0.19, 0.27, 0.33, 0.41, 0.49, 0.55, 0.63, 0.71, 0.78, 0.86, 0.93, 0.97,
    0.07, 0.15, 0.23, 0.31, 0.38, 0.46, 0.53, 0.61, 0.68, 0.75, 0.83, 0.9, 0.95, 0.99,
  ]

  return seeds.map((seed, i) => {
    const edge = i % 4
    const along = seed
    const depth = 0.02 + ((i * 37) % 11) / 190

    const x =
      edge === 0 || edge === 1
        ? width * along
        : edge === 2
          ? width * depth
          : width * (1 - depth)
    const y =
      edge === 0
        ? height * depth
        : edge === 1
          ? height * (1 - depth)
          : height * along

    return {
      x,
      y,
      size: 7 + ((i * 13) % 9),
      rotate: (i * 47) % 180,
      color: palette[i % palette.length],
      opacity: 0.55 + ((i * 17) % 30) / 100,
      kind: i % 3 === 0 ? ('circle' as const) : ('rect' as const),
    }
  })
}
