import type { InsightCard } from '../api/aiApi'

/**
 * Builds the lightweight context for follow-up generation. Only the topical focus is
 * sent (the user's question, optionally prefixed by the active insight subject) — the
 * actual numbers/names are grounded server-side from the cached tool outputs of the
 * just-finished chat turn, so we deliberately do NOT pass the (truncated) answer text,
 * which previously caused the model to fabricate numbers.
 */
export function buildFollowupContext(
  insight: InsightCard | null,
  question: string,
  _answer?: string,
): string {
  const subject = insight?.context?.entityName
  return subject ? `[${subject}] ${question}` : question
}
