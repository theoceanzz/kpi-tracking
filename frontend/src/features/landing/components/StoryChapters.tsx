import { type ReactNode } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Eyebrow, Headline, MoreToggle, Reveal, Screenshot } from './primitives'

/**
 * Bốn chương của "bộ phim", mỗi chương một ảnh chụp thật của app.
 * Mặc định chỉ hiện tiêu đề + một câu tóm tắt; phần giải thích và gạch đầu dòng
 * nằm sau nút "Xem chi tiết" để người xem lướt nhanh vẫn hiểu hệ thống.
 */
export function StoryChapters() {
  return (
    <div id="story" className="scroll-mt-24">
      <Chapter
        no="01"
        eyebrow="Đặt mục tiêu"
        title={<>Một mục tiêu công ty, <em>phân rã</em> tới từng người.</>}
        summary="Bật đúng các bước của luồng KPI; chỉ tiêu chảy từ ban giám đốc xuống phòng ban, xuống từng cá nhân."
        detail="OKR, KPI và thẻ điểm cân bằng BSC trên cùng một trục. Ai cũng thấy mình đang góp vào điều gì. Cơ cấu tổ chức, OKR, BSC nhập từ Excel — xem trước rồi mới ghi."
        bullets={['OKR · KPI · BSC', 'Thác nước chỉ tiêu theo cơ cấu', 'Nhập từ Excel, xem trước rồi mới ghi']}
        shot={{ src: '/landing/kpi-workflow.webp', title: 'Luồng KPI · Thiết lập', alt: 'Màn hình Luồng KPI: chọn các bước quản lý kỳ, đợt, chỉ tiêu, duyệt' }}
      />
      <Chapter
        no="02"
        eyebrow="Đo lường & đánh giá"
        title={<>Nhân viên nộp, quản lý duyệt, <em>hệ thống tổng hợp</em>.</>}
        summary="Tự chấm kèm minh chứng, quản lý chấm từng đợt — nhiều đợt gộp thành kết quả cả kỳ."
        detail="Có luồng xin điều chỉnh chỉ tiêu giữa kỳ. Chấm hạnh kiểm và ma trận xếp loại đi kèm, nên đo cả kết quả lẫn hành vi chứ không chỉ con số."
        bullets={['Đánh giá theo đợt & theo kỳ', 'Minh chứng đính kèm, xin điều chỉnh giữa kỳ', 'Hạnh kiểm & ma trận xếp loại']}
        shot={{ src: '/landing/evaluation-batch.webp', title: 'Quản lý hiệu suất · Đánh giá đợt', alt: 'Màn hình Đánh giá đợt: danh sách nhân sự, bài chờ duyệt, điểm và xếp loại' }}
        flip
      />
      <Chapter
        no="03"
        eyebrow="Nhìn thấy kết quả"
        title={<>Kết quả kỳ <em>tự tổng hợp</em>, thưởng ngay khi có.</>}
        summary="Điểm kỳ = trung bình các đợt + hạnh kiểm; luồng duyệt theo cấp và bell curve so sánh trong đơn vị."
        detail="Dashboard kéo thả, ghim thẻ quan trọng lên đầu. Điểm thưởng, điểm danh, quà tặng và chứng nhận trao ngay khi chốt kết quả — ghi nhận đúng lúc, không chờ cuối năm. Export báo cáo một chạm."
        bullets={['Dashboard tùy biến, ghim thẻ quan trọng', 'Thưởng, điểm danh, quà tặng, ví tiền', 'Export báo cáo một chạm']}
        shot={{ src: '/landing/evaluation-period.webp', title: 'Quản lý hiệu suất · Đánh giá kỳ', alt: 'Màn hình Đánh giá kỳ: tổng hợp điểm, luồng duyệt theo cấp, bell curve của đơn vị' }}
      />
      <Chapter
        no="04"
        eyebrow="Trợ lý K.AI"
        title={<>Hỏi số liệu như <em>hỏi đồng nghiệp</em>.</>}
        summary="K.AI đọc dữ liệu của chính tổ chức bạn: ai đang có nguy cơ, phòng nào cần can thiệp, duyệt gì đang chờ."
        detail="Trả lời theo đúng quyền của người hỏi, điền hộ biểu mẫu đánh giá, gợi ý nhận xét. Chạy được với Ollama nội bộ, OpenAI hoặc Gemini — tự chọn mô hình."
        bullets={['Hỏi đáp số liệu theo quyền của người hỏi', 'Điền hộ biểu mẫu KPI, gợi ý nhận xét', 'Tự chọn mô hình: nội bộ hoặc cloud']}
        shot={{ src: '/landing/kai.webp', title: 'K.AI · Trợ lý dữ liệu', alt: 'Màn hình Trợ lý K.AI: gợi ý câu hỏi và phân tích nổi bật từ dữ liệu' }}
        flip
      />
    </div>
  )
}

function Chapter({
  no,
  eyebrow,
  title,
  summary,
  detail,
  bullets,
  shot,
  flip,
}: {
  no: string
  eyebrow: string
  title: ReactNode
  summary: string
  detail: string
  bullets: string[]
  shot: { src: string; title: string; alt: string }
  flip?: boolean
}) {
  return (
    <section className={cn('relative border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36', flip && 'lp-section-alt')}>
      <div className="lp-dots pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_50%_60%_at_50%_50%,#000,transparent)]" />
      <div className={cn('mx-auto grid max-w-[1440px] items-center gap-12 lg:grid-cols-[2fr_3fr] lg:gap-16', flip && 'lg:grid-cols-[3fr_2fr] lg:[&>*:first-child]:order-2')}>
        <div>
          <Reveal>
            <div className="mb-5 flex items-center gap-4">
              <span className="text-6xl font-black leading-none text-slate-900/[0.06] sm:text-7xl">{no}</span>
              <Eyebrow>Chương {no} · {eyebrow}</Eyebrow>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <Headline>{title}</Headline>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-700 text-pretty">{summary}</p>
          </Reveal>
          <Reveal delay={300}>
            <MoreToggle className="mt-2">
              <p className="pt-3 max-w-xl text-base leading-relaxed text-slate-600 text-pretty">{detail}</p>
              <ul className="mt-4 space-y-2.5 pb-1">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-sm font-semibold text-slate-700 sm:text-base">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </MoreToggle>
          </Reveal>
        </div>

        <Reveal from={flip ? 'left' : 'right'} delay={150} className="lg:sticky lg:top-28">
          <Screenshot src={shot.src} alt={shot.alt} title={shot.title} />
        </Reveal>
      </div>
    </section>
  )
}
