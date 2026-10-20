// Sinh file Lottie TẠM (vector gốc của dự án, không vướng giấy phép) cho vật thể ăn mừng CHƯA có file đã duyệt.
//
// Hiện cả 4 vật thể (cúp, hộp quà, rương, huy chương) đều đã dùng file LottieFiles được duyệt ngày 2026-10-19
// (xem public/celebrations/LICENSES.md), nên TEMPORARY rỗng và chạy script không ghi gì. Giữ lại để: thêm một
// vật thể mới (vd. thêm cấp hiệu ứng) thì có ngay file tạm cho code chạy trong lúc chờ duyệt file thật — thêm
// builder + tên vào TEMPORARY, chạy, rồi xoá tên khỏi TEMPORARY khi thay bằng file đã duyệt.
//
// Chạy: node tools/celebration-lottie/generate.mjs  → ghi vào public/celebrations/lottie/<tên>.json
//
// Định dạng Lottie (bodymovin 5.x): chỉ dùng shape layer + rect/ellipse/path/star + fill/gradient/stroke —
// đều có trong bản lottie_light (SVG renderer, không expression) mà app nạp.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'celebrations', 'lottie')
const FR = 60
const OP = 150 // 2,5 giây
const W = 400
const H = 400

// ── Giá trị tĩnh / có khung hình ────────────────────────────────────────────
const st = (k) => ({ a: 0, k })
const EASE = { i: { x: [0.33], y: [1] }, o: { x: [0.5], y: [0] } }
/** kfs: [[frame, value], ...] — value là số hoặc mảng. */
const anim = (kfs) => ({
  a: 1,
  k: kfs.map(([t, v], i) => {
    const s = Array.isArray(v) ? v : [v]
    return i < kfs.length - 1 ? { t, s, ...EASE } : { t, s }
  }),
})

const hex = (h, a = 1) => {
  const n = parseInt(h.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a]
}

// ── Hình ────────────────────────────────────────────────────────────────────
const rect = (x, y, w, h, r = 0) => ({ ty: 'rc', d: 1, p: st([x, y]), s: st([w, h]), r: st(r) })
const ellipse = (x, y, w, h) => ({ ty: 'el', d: 1, p: st([x, y]), s: st([w, h]) })
const star = (x, y, outer, inner, points = 5, rot = 0) => ({
  ty: 'sr', sy: 1, d: 1, pt: st(points), p: st([x, y]), r: st(rot), ir: st(inner), is: st(0), or: st(outer), os: st(0),
})
/** Đường thẳng nối các đỉnh; `curves` = {chỉ số: [in, out]} để bo cong. */
const path = (v, closed = true, curves = {}) => ({
  ty: 'sh', d: 1,
  ks: st({
    v,
    i: v.map((_, i) => curves[i]?.[0] ?? [0, 0]),
    o: v.map((_, i) => curves[i]?.[1] ?? [0, 0]),
    c: closed,
  }),
})
const fill = (h, o = 100) => ({ ty: 'fl', c: st(hex(h)), o: st(o), r: 1, bm: 0 })
const stroke = (h, w, o = 100) => ({ ty: 'st', c: st(hex(h)), o: st(o), w: st(w), lc: 2, lj: 2, ml: 4, bm: 0 })
/** Gradient tuyến tính từ (x1,y1) tới (x2,y2); stops = [[vị trí 0..1, '#hex'], ...]. */
const grad = (x1, y1, x2, y2, stops) => ({
  ty: 'gf', o: st(100), r: 1, bm: 0, t: 1,
  s: st([x1, y1]), e: st([x2, y2]),
  g: { p: stops.length, k: st(stops.flatMap(([p, h]) => [p, ...hex(h).slice(0, 3)])) },
})
/** Gradient tròn tâm (0,0) bán kính r, màu đặc ở tâm mờ dần ra mép — quầng sáng mềm, không viền cứng. */
const radialGlow = (r, h) => ({
  ty: 'gf', o: st(100), r: 1, bm: 0, t: 2,
  s: st([0, 0]), e: st([r, 0]), h: st(0), a: st(0),
  g: { p: 2, k: st([0, ...hex(h).slice(0, 3), 1, ...hex(h).slice(0, 3), 0, 0.85, 0.55, 0.35, 1, 0]) },
})
const tr = (o = {}) => ({
  ty: 'tr', p: o.p ?? st([0, 0]), a: o.a ?? st([0, 0]), s: o.s ?? st([100, 100]),
  r: o.r ?? st(0), o: o.o ?? st(100), sk: st(0), sa: st(0),
})
const group = (items, t = {}) => ({ ty: 'gr', it: [...items, tr(t)] })

let nextInd = 1
/** Shape layer; ks = transform của cả lớp (vị trí tính theo khung 400×400). */
const layer = (nm, shapes, ks = {}) => ({
  ddd: 0, ind: nextInd++, ty: 4, nm, sr: 1, ao: 0, bm: 0, ip: 0, op: OP, st: 0,
  ks: {
    o: ks.o ?? st(100), r: ks.r ?? st(0), p: ks.p ?? st([W / 2, H / 2, 0]),
    a: ks.a ?? st([0, 0, 0]), s: ks.s ?? st([100, 100, 100]),
  },
  shapes,
})

const doc = (nm, layers) => ({ v: '5.7.4', fr: FR, ip: 0, op: OP, w: W, h: H, nm, ddd: 0, assets: [], layers })

// ── Chuyển động dùng chung ──────────────────────────────────────────────────
/** Bật vào: 0 → 118% → 94% → 100%, xoay nhẹ rồi về thẳng, sau đó lơ lửng lên xuống. */
const popIn = (y = 210) => ({
  s: anim([[0, [0, 0, 100]], [22, [118, 118, 100]], [34, [94, 94, 100]], [44, [100, 100, 100]]]),
  r: anim([[0, -14], [22, 6], [40, 0]]),
  p: anim([[0, [200, y + 30, 0]], [22, [200, y - 6, 0]], [44, [200, y, 0]], [90, [200, y - 8, 0]], [OP, [200, y, 0]]]),
})

/** Quầng sáng phía sau vật thể, đập nhịp. */
const glow = (color) =>
  layer('glow', [group([ellipse(0, 0, 360, 360), radialGlow(180, color)])], {
    p: st([200, 205, 0]),
    o: anim([[0, 0], [20, 55], [60, 30], [100, 50], [OP, 35]]),
    s: anim([[0, [40, 40, 100]], [24, [110, 110, 100]], [80, [95, 95, 100]], [OP, [105, 105, 100]]]),
  })

/** Lấp lánh: ngôi sao 4 cánh bật lên rồi tắt, rải quanh vật thể. */
const sparkles = (spots) =>
  spots.map(([x, y, start, size = 26], i) =>
    layer(`sparkle-${i}`, [group([star(0, 0, size, size * 0.28, 4), fill('#FFFFFF')])], {
      p: st([x, y, 0]),
      s: anim([[start, [0, 0, 100]], [start + 10, [100, 100, 100]], [start + 22, [0, 0, 100]]]),
      r: anim([[start, 0], [start + 22, 90]]),
      o: anim([[start, 0], [start + 4, 100], [start + 20, 100], [start + 22, 0]]),
    }))

const SPARKS = [[95, 110, 40], [310, 95, 52], [330, 250, 64], [80, 270, 58], [205, 55, 76, 20], [140, 330, 88, 18], [270, 335, 100, 18]]

// ── Cúp ─────────────────────────────────────────────────────────────────────
function trophy() {
  nextInd = 1
  const gold = grad(-80, -90, 80, 60, [[0, '#FFE58A'], [0.5, '#FFC93C'], [1, '#D9961A']])
  const cup = layer('cup', [
    group([star(0, -42, 26, 11), fill('#FFF7D6')]),
    group([ellipse(-38, -46, 14, 56), fill('#FFFFFF', 45)]),
    group([path([[-72, -88], [72, -88], [44, 18], [-44, 18]], true, { 1: [[0, 0], [2, 70]], 2: [[30, 0], [0, 0]], 3: [[0, 0], [-30, 0]], 0: [[-2, 70], [0, 0]] }), gold]),
    group([rect(0, -90, 160, 16, 8), fill('#FFD95E')]),
    group([ellipse(-80, -42, 52, 64), stroke('#E8AE2A', 13)]),
    group([ellipse(80, -42, 52, 64), stroke('#E8AE2A', 13)]),
    group([rect(0, 42, 26, 46, 4), fill('#E0A21B')]),
    group([rect(0, 74, 104, 22, 8), fill('#F2B732')]),
    group([rect(0, 98, 144, 26, 6), grad(-72, 0, 72, 0, [[0, '#5B3A1E'], [1, '#8B5A2B']])]),
    group([rect(0, 98, 70, 10, 3), fill('#FFD95E')]),
  ], popIn(205))
  return doc('trophy', [...sparkles(SPARKS), cup, glow('#FFD95E')])
}

// ── Hộp quà (nắp bật ra, tia sáng phụt lên) ─────────────────────────────────
function gift() {
  nextInd = 1
  const lid = layer('lid', [
    group([ellipse(-30, -66, 54, 30), fill('#FFC93C')], { r: st(-28), p: st([-30, -66]), a: st([-30, -66]) }),
    group([ellipse(30, -66, 54, 30), fill('#FFC93C')], { r: st(28), p: st([30, -66]), a: st([30, -66]) }),
    group([ellipse(0, -60, 22, 22), fill('#E8A51F')]),
    group([rect(0, -32, 28, 44), fill('#FFD95E')]),
    group([rect(0, -32, 186, 44, 8), grad(-93, 0, 93, 0, [[0, '#F05252'], [1, '#C81E1E']])]),
  ], {
    p: anim([[0, [200, 210, 0]], [52, [200, 210, 0]], [64, [178, 150, 0]], [80, [170, 166, 0]], [OP, [170, 162, 0]]]),
    r: anim([[0, 0], [52, 0], [64, -24], [80, -16], [OP, -18]]),
    s: anim([[0, [0, 0, 100]], [22, [118, 118, 100]], [34, [94, 94, 100]], [44, [100, 100, 100]]]),
  })
  const box = layer('box', [
    group([rect(0, 52, 28, 120), fill('#FFD95E')]),
    group([rect(-46, 30, 16, 60, 4), fill('#FFFFFF', 22)]),
    group([rect(0, 52, 164, 120, 10), grad(-82, 0, 82, 0, [[0, '#EF4444'], [1, '#B91C1C']])]),
  ], popIn(210))
  const rays = layer('rays', [
    ...[-38, -18, 0, 18, 38].map((deg) =>
      group([path([[-10, 0], [10, 0], [26, -150], [-26, -150]]), fill('#FFF3B0', 80)], { r: st(deg) })),
  ], {
    p: st([200, 228, 0]),
    o: anim([[0, 0], [56, 0], [66, 90], [OP, 40]]),
    s: anim([[56, [20, 10, 100]], [70, [100, 100, 100]], [OP, [108, 110, 100]]]),
  })
  return doc('gift', [...sparkles(SPARKS.map(([x, y, t, s]) => [x, y - 20, t + 20, s])), lid, box, rays, glow('#FCA5A5')])
}

// ── Rương xu (nắp mở, xu bay ra) ────────────────────────────────────────────
function chest() {
  nextInd = 1
  const wood = grad(-95, 0, 95, 0, [[0, '#7A4A22'], [0.5, '#A0632F'], [1, '#6B3F1C']])
  const coins = [[-60, -150, 58], [-22, -175, 62], [20, -168, 66], [58, -148, 70], [0, -200, 74]].map(([dx, top, start], i) =>
    layer(`coin-${i}`, [
      group([star(0, 0, 9, 4), fill('#FFF3B0')]),
      group([ellipse(0, 0, 34, 34), fill('#FFC93C'), stroke('#D9961A', 4)]),
    ], {
      p: anim([[start, [200, 215, 0]], [start + 16, [200 + dx, 215 + top + 40, 0]], [start + 30, [200 + dx * 1.15, 215 + top + 20, 0]], [OP, [200 + dx * 1.15, 215 + top + 26, 0]]]),
      s: anim([[start, [0, 0, 100]], [start + 10, [100, 100, 100]]]),
      o: anim([[0, 0], [start, 0], [start + 2, 100]]),
    }))
  const lid = layer('lid', [
    group([rect(0, -28, 30, 30, 4), fill('#FFC93C')]),
    group([rect(-62, -28, 18, 60), fill('#E8AE2A')]),
    group([rect(62, -28, 18, 60), fill('#E8AE2A')]),
    group([rect(0, -28, 196, 60, 26), wood]),
  ], {
    // Nhấc nắp lên và ngả ra sau quanh bản lề bên trái.
    p: anim([[0, [200, 210, 0]], [50, [200, 210, 0]], [62, [188, 150, 0]], [76, [184, 162, 0]], [OP, [184, 160, 0]]]),
    r: anim([[0, 0], [50, 0], [62, -22], [76, -14], [OP, -16]]),
    s: anim([[0, [0, 0, 100]], [22, [118, 118, 100]], [34, [94, 94, 100]], [44, [100, 100, 100]]]),
  })
  const body = layer('body', [
    group([rect(0, 30, 34, 38, 6), fill('#FFD95E')]),
    group([rect(-62, 54, 18, 104), fill('#E8AE2A')]),
    group([rect(62, 54, 18, 104), fill('#E8AE2A')]),
    group([rect(0, 54, 196, 104, 10), wood]),
  ], popIn(210))
  return doc('chest', [...sparkles(SPARKS), ...coins, lid, body, glow('#FFD95E')])
}

// ── Huy chương (lật như đồng xu) ────────────────────────────────────────────
function medal() {
  nextInd = 1
  const ribbon = layer('ribbon', [
    group([path([[-70, -175], [-30, -175], [22, -40], [-18, -40]]), fill('#2563EB')]),
    group([path([[70, -175], [30, -175], [-22, -40], [18, -40]]), fill('#DC2626')]),
  ], popIn(215))
  const disc = layer('disc', [
    group([star(0, 18, 34, 15), fill('#FFF7D6')]),
    group([ellipse(0, 18, 112, 112), grad(-56, -40, 56, 76, [[0, '#F2B732'], [1, '#C9861A']])]),
    group([ellipse(0, 18, 148, 148), grad(-74, -56, 74, 92, [[0, '#FFE58A'], [0.55, '#FFC93C'], [1, '#D9961A']])]),
  ], {
    ...popIn(215),
    // Lật quanh trục đứng: co bề ngang về gần 0 rồi mở lại, hai lần.
    s: anim([[0, [0, 0, 100]], [22, [118, 118, 100]], [34, [94, 94, 100]], [44, [100, 100, 100]], [56, [6, 100, 100]], [68, [100, 100, 100]], [80, [6, 100, 100]], [92, [100, 100, 100]]]),
  })
  return doc('medal', [...sparkles(SPARKS), disc, ribbon, glow('#BFDBFE')])
}

/** Chỉ những vật thể CHƯA có file đã duyệt. Bỏ tên khỏi đây ngay khi thay bằng file thật — không thì đè mất file đã duyệt. */
const TEMPORARY = []

mkdirSync(OUT, { recursive: true })
for (const [name, build] of Object.entries({ trophy, gift, chest, medal })) {
  if (!TEMPORARY.includes(name)) continue
  const json = JSON.stringify(build())
  writeFileSync(join(OUT, `${name}.json`), json)
  console.log(`${name}.json  ${(json.length / 1024).toFixed(1)} KB`)
}
if (TEMPORARY.length === 0) console.log('Không có vật thể tạm nào — mọi file trong public/celebrations/lottie/ đã là file được duyệt.')
