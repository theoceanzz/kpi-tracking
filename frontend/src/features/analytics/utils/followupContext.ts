import type { InsightCard } from '../api/aiApi'

/**
 * Builds the compact context string sent to the follow-up generator: the active
 * insight (if the thread started from a card), the user's question, and a trimmed
 * snippet of the assistant's answer. Gives the LLM names/numbers to anchor questions on.
 */
export function buildFollowupContext(
  insight: InsightCard | null,
  question: string,
  answer?: string,
): string {
  const parts: string[] = []
  if (insight) {
    parts.push(`Insight: ${insight.insightText}`)
    const c = insight.context
    if (c?.entityName) parts.push(`Đối tượng: ${c.entityName}`)
    if (c?.value != null) parts.push(`Giá trị: ${c.value}%`)
    if (c?.deltaPct != null) parts.push(`Biến động: ${c.deltaPct}%`)
    if (c?.periodLabel) parts.push(`Kỳ: ${c.periodLabel}`)
    if (c?.daysLeft != null) parts.push(`Còn lại: ${c.daysLeft} ngày`)
  }
  parts.push(`Câu hỏi: ${question}`)
  if (answer) parts.push(`Trả lời: ${answer.slice(0, 600)}`)
  return parts.join('\n')
}
