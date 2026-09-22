import { Link } from "react-router-dom";
import { Check, Key, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Eyebrow, Headline, Lead, MoreToggle, Reveal } from "./primitives";

type Feature = { text: string; included: boolean | string };

const PLANS: Array<{
  tier: string;
  who: string;
  features: Feature[];
  cta: string;
  popular?: boolean;
}> = [
  {
    tier: "Standard",
    who: "Nhóm nhỏ dưới 200 người, số hoá đánh giá cơ bản.",
    features: [
      { text: "SaaS dùng chung domain", included: true },
      { text: "Phân quyền & quản trị người dùng", included: true },
      { text: "Đánh giá KPI theo đợt & kỳ", included: true },
      { text: "Hạnh kiểm & ma trận xếp loại", included: true },
      { text: "Dashboard & báo cáo mặc định", included: true },
      { text: "OKR, BSC, Thưởng, Ví", included: false },
    ],
    cta: "Bắt đầu dùng thử",
  },
  {
    tier: "Professional",
    who: "Doanh nghiệp tầm trung dưới 500 người, quản trị OKR & KPI.",
    features: [
      { text: "Mọi thứ ở Standard", included: true },
      { text: "OKR, BSC, Thưởng & điểm danh", included: true },
      { text: "Dashboard động, báo cáo tự tạo", included: true },
      { text: "White label (logo riêng)", included: true },
      { text: "Hỗ trợ SLA 24h", included: true },
      { text: "Trợ lý K.AI · API / SSO Lark", included: "Tính phí riêng" },
    ],
    cta: "Đăng ký ngay",
    popular: true,
  },
  {
    tier: "Enterprise",
    who: "Tổ chức lớn trên 500 người, bảo mật cao, triển khai riêng.",
    features: [
      { text: "Subdomain riêng hoặc onsite", included: true },
      { text: "Tenant & database riêng biệt", included: true },
      { text: "Trọn bộ module + Ví tiền (SePay)", included: true },
      { text: "White label toàn diện", included: true },
      { text: "SLA 12h · online meeting", included: true },
      { text: "Tùy chỉnh luồng nghiệp vụ sâu", included: true },
    ],
    cta: "Liên hệ chuyên viên",
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative scroll-mt-24 overflow-hidden border-t border-slate-200 px-5 py-20 sm:px-8 sm:py-28 lg:px-12 lg:py-36"
    >
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="lp-aurora left-[20%] top-[20%] h-[360px] w-[600px] bg-sky-200 opacity-60" />
      </div>
      <div className="mx-auto max-w-[1440px]">
        <div className="mx-auto mb-12 max-w-2xl text-center sm:mb-16">
          <Reveal>
            <Eyebrow className="justify-center">Bảng giá</Eyebrow>
          </Reveal>
          <Reveal delay={100}>
            <Headline className="mt-4">
              Chọn gói theo <em>quy mô</em> của bạn.
            </Headline>
          </Reveal>
          <Reveal delay={200}>
            <Lead className="mx-auto mt-4 text-center">
              Liên hệ để nhận báo giá chi tiết. AI Assistant / AI Insight tư vấn
              theo nhu cầu thực tế.
            </Lead>
          </Reveal>
        </div>

        <div className="grid items-stretch gap-4 lg:grid-cols-3 lg:gap-6">
          {PLANS.map((p, i) => (
            <Reveal
              key={p.tier}
              delay={i * 120}
              className={cn(p.popular && "lg:-my-4")}
            >
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-3xl border p-6 transition-transform duration-500 hover:-translate-y-1 sm:p-8",
                  p.popular
                    ? "border-blue-300 bg-gradient-to-b from-blue-50 to-white shadow-[0_30px_80px_-30px_rgba(37,99,235,0.45)]"
                    : "border-slate-200 bg-white shadow-sm",
                )}
              >
                {p.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-sky-500 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white shadow-lg">
                    Phổ biến nhất
                  </div>
                )}
                <div className="text-sm font-bold uppercase tracking-widest text-slate-400">
                  {p.tier}
                </div>
                <div className="mt-2 text-4xl font-black text-slate-900">
                  Liên hệ
                </div>
                <p className="mt-2 text-sm text-slate-500">{p.who}</p>

                {/* Chỉ hiện 4 dòng đầu, phần còn lại sau nút "Xem đầy đủ" */}
                <ul className="mt-6 space-y-3">
                  {p.features.slice(0, 4).map((f) => (
                    <FeatureRow key={f.text} f={f} />
                  ))}
                </ul>
                <MoreToggle
                  className="flex-1"
                  labelOpen="Xem đầy đủ"
                  labelClose="Thu gọn"
                >
                  <ul className="space-y-3 pt-3">
                    {p.features.slice(4).map((f) => (
                      <FeatureRow key={f.text} f={f} />
                    ))}
                  </ul>
                </MoreToggle>

                <Link
                  to="/login"
                  className={cn(
                    "mt-8 rounded-2xl py-3.5 text-center text-sm font-bold transition-all active:scale-95",
                    p.popular
                      ? "bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                      : "border border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700",
                  )}
                >
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({ f }: { f: Feature }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          f.included === true && "bg-emerald-50 text-emerald-600",
          f.included === false && "bg-slate-100 text-slate-400",
          typeof f.included === "string" && "bg-amber-50 text-amber-600",
        )}
      >
        {f.included === true ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : f.included === false ? (
          <Minus className="h-3 w-3" strokeWidth={3} />
        ) : (
          <Key className="h-3 w-3" strokeWidth={3} />
        )}
      </span>
      <span
        className={cn(
          f.included === false
            ? "text-slate-400 line-through"
            : "text-slate-700",
        )}
      >
        {f.text}
        {typeof f.included === "string" && (
          <span className="ml-1.5 text-[10px] font-bold uppercase text-amber-600">
            ({f.included})
          </span>
        )}
      </span>
    </li>
  );
}
