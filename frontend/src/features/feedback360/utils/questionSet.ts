import type { F360QuestionInput, F360Template, F360TemplateInput } from '../api/feedback360Api'
import i18n from 'i18next'

/** Bản nháp bộ câu hỏi đang soạn trong form chiến dịch. `key` chỉ để React giữ ô nhập, không gửi đi. */
export interface DraftQuestion extends F360QuestionInput { key: string }
export interface DraftCompetency { key: string; name: string; description: string; weight: number; questions: DraftQuestion[] }
export interface QuestionSetDraft { scaleMax: number; competencies: DraftCompetency[]; openQuestions: DraftQuestion[] }

let seq = 0
export const nextKey = () => `q${++seq}`

export const blankQuestion = (open = false): DraftQuestion =>
  ({ key: nextKey(), text: '', required: !open, allowNa: true })
export const blankCompetency = (weight: number): DraftCompetency =>
  ({ key: nextKey(), name: '', description: '', weight, questions: [blankQuestion()] })

/** Bộ có sẵn → bản nháp. Không có bộ nào thì bắt đầu bằng một năng lực trống 100%. */
export function toDraft(t: F360Template | null | undefined): QuestionSetDraft {
  if (!t) return { scaleMax: 5, competencies: [blankCompetency(100)], openQuestions: [] }
  const q = (x: F360QuestionInput): DraftQuestion =>
    ({ key: nextKey(), text: x.text, relationships: x.relationships, required: x.required, allowNa: x.allowNa })
  return {
    scaleMax: t.scaleMax,
    competencies: t.competencies.map(c => ({
      key: nextKey(), name: c.name, description: c.description ?? '', weight: c.weight, questions: c.questions.map(q),
    })),
    openQuestions: t.openQuestions.map(q),
  }
}

const toQuestionInput = (q: DraftQuestion): F360QuestionInput => ({
  text: q.text.trim(), relationships: q.relationships, required: q.required, allowNa: q.allowNa,
})

/** Bản nháp → body API. Tên bộ lấy theo tên chiến dịch (bộ riêng, người dùng không phải đặt tên). */
export function toTemplateInput(d: QuestionSetDraft, campaignName: string): F360TemplateInput {
  return {
    name: campaignName.trim() || i18n.t('feedback360:questionSet.n360Campaign'),
    scaleMax: d.scaleMax,
    competencies: d.competencies.map(c => ({
      name: c.name.trim(), description: c.description.trim() || null, weight: Number(c.weight),
      questions: c.questions.map(toQuestionInput),
    })),
    openQuestions: d.openQuestions.map(toQuestionInput),
  }
}

export const totalWeight = (d: QuestionSetDraft) =>
  Math.round(d.competencies.reduce((s, c) => s + (Number(c.weight) || 0), 0) * 100) / 100

export const questionCount = (d: QuestionSetDraft) =>
  d.competencies.reduce((n, c) => n + c.questions.length, 0) + d.openQuestions.length

/** Lý do bộ câu hỏi chưa lưu được, hoặc null. Hiện ở chân form như các lý do khác. */
export function questionSetBlocker(d: QuestionSetDraft): string | null {
  if (d.competencies.length === 0) return i18n.t('feedback360:questionSet.addAtLeastOneCompetencyTo')
  if (d.competencies.some(c => !c.name.trim())) return i18n.t('feedback360:questionSet.someCompetenciesHaveNoName')
  if (d.competencies.some(c => !(Number(c.weight) > 0))) return i18n.t('feedback360:questionSet.eachCompetencysWeightMustBeGreater')
  const total = totalWeight(d)
  if (Math.abs(total - 100) >= 0.01) return i18n.t('feedback360:questionSet.theTotalCompetencyWeightIsIt', { total })
  if (d.competencies.some(c => c.questions.length === 0 || c.questions.some(q => !q.text.trim())))
    return i18n.t('feedback360:questionSet.someQuestionsHaveNoContent')
  if (d.openQuestions.some(q => !q.text.trim())) return i18n.t('feedback360:questionSet.someOpenEndedCommentQuestionsHave')
  return null
}

/** Chia đều 100% cho các năng lực; phần lẻ dồn vào năng lực cuối để tổng đúng 100. */
export function evenWeights(d: QuestionSetDraft): QuestionSetDraft {
  const n = d.competencies.length
  if (n === 0) return d
  const each = Math.floor((100 / n) * 100) / 100
  return {
    ...d,
    competencies: d.competencies.map((c, i) => ({
      ...c, weight: i === n - 1 ? Math.round((100 - each * (n - 1)) * 100) / 100 : each,
    })),
  }
}

const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Chỉ lấy các câu được tích (theo id) từ một bộ có sẵn → bản nháp. Năng lực không còn câu nào bị
 * bỏ; trọng số giữ như nguồn (người dùng cân lại bằng "Chia đều" nếu tổng lệch 100).
 */
export function pickFromTemplate(t: F360Template, picked: ReadonlySet<string>): QuestionSetDraft {
  const q = (x: F360Template['openQuestions'][number]): DraftQuestion =>
    ({ key: nextKey(), text: x.text, relationships: x.relationships, required: x.required, allowNa: x.allowNa })
  return {
    scaleMax: t.scaleMax,
    competencies: t.competencies
      .map(c => ({ c, qs: c.questions.filter(x => picked.has(x.id)) }))
      .filter(({ qs }) => qs.length > 0)
      .map(({ c, qs }) => ({ key: nextKey(), name: c.name, description: c.description ?? '', weight: c.weight, questions: qs.map(q) })),
    openQuestions: t.openQuestions.filter(x => picked.has(x.id)).map(q),
  }
}

/**
 * Gộp phần chép vào bộ đang soạn: năng lực trùng tên thì dồn câu vào năng lực đó (bỏ câu trùng nội
 * dung), năng lực mới thì thêm cuối. Thang điểm giữ của bộ đang soạn.
 */
export function mergeInto(base: QuestionSetDraft, add: QuestionSetDraft): QuestionSetDraft {
  const competencies = base.competencies.map(c => ({ ...c, questions: [...c.questions] }))
  for (const a of add.competencies) {
    const hit = competencies.find(c => sameText(c.name, a.name))
    if (hit) {
      hit.questions.push(...a.questions.filter(q => !hit.questions.some(x => sameText(x.text, q.text))))
    } else {
      competencies.push(a)
    }
  }
  const openQuestions = [...base.openQuestions, ...add.openQuestions.filter(q => !base.openQuestions.some(x => sameText(x.text, q.text)))]
  // Bộ đang soạn chỉ là một năng lực trống (chiến dịch mới chưa gõ gì) thì bỏ nó đi cho gọn.
  const cleaned = competencies.filter(c => c.name.trim() || c.questions.some(q => q.text.trim()))
  return { ...base, competencies: cleaned.length ? cleaned : competencies, openQuestions }
}
